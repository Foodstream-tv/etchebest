import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import {
    createRoom,
    disconnectRoom,
    fetchRenegotiationOffer,
    reserveRoom,
    sendICECandidate,
    sendOffer,
    sendRenegotiationAnswer,
    type CreateRoomOptions,
} from '@/services/streaming';
import {
    isNativeWebRTC,
    mediaDevices,
    MediaStream,
    RTCPeerConnection,
    RTCSessionDescription,
} from '@/utils/webrtc';
import { preferH264 } from '@/utils/webrtcSdp';

const ICE_SERVERS = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const RENEGOTIATION_POLL_MS = 1200;
/**
 * `disconnected` is transient in WebRTC (ICE can recover by itself, e.g. wifi -> 4G):
 * wait this long for ICE to recover before replacing the peer connection.
 */
export const DISCONNECT_GRACE_MS = 5000;
/**
 * Delays before each re-publish attempt once the peer connection is lost. The whole sequence stays
 * under the backend's ICE failure timeout (~30 s): past it the room is closed and retrying is useless.
 */
export const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 8000] as const;

/** True for UDP ICE candidates (`candidate:... 1 udp ...`). */
export function isUdpCandidate(candidate: string | null | undefined): boolean {
    return typeof candidate === 'string' && /\sudp\s/i.test(candidate);
}

export type StreamingState =
    | 'idle'
    | 'creating'
    | 'connecting'
    | 'live'
    | 'reconnecting'
    | 'error'
    | 'disconnected';

/** Machine-readable failure reason; the screen maps it to a localized message. */
export type WebRTCErrorCode =
    | 'unsupported'
    | 'permission'
    | 'device'
    | 'conflict'
    | 'unauthorized'
    /** The connection dropped and could not be re-established in time. */
    | 'connection'
    /** The live is over (room closed on the backend) while we were trying to reconnect. */
    | 'ended'
    | 'generic';

export class WebRTCError extends Error {
    readonly code: WebRTCErrorCode;

    constructor(code: WebRTCErrorCode, message: string) {
        super(message);
        this.name = 'WebRTCError';
        this.code = code;
    }
}

/** Maps anything thrown during start/join to a code + a technical message. */
export function classifyError(err: unknown, fallback: string): { code: WebRTCErrorCode; message: string } {
    const anyErr = err as { name?: string; message?: string; status?: number; code?: WebRTCErrorCode } | null;
    const message = (anyErr && typeof anyErr.message === 'string' && anyErr.message) || fallback;

    if (err instanceof WebRTCError) return { code: err.code, message };
    if (anyErr?.name === 'UnauthorizedError') return { code: 'unauthorized', message };
    if (anyErr?.status === 409) return { code: 'conflict', message };
    if (
        anyErr?.name === 'NotAllowedError' ||
        anyErr?.name === 'PermissionDeniedError' ||
        /permission|not allowed|denied/i.test(message)
    ) {
        return { code: 'permission', message };
    }
    if (
        anyErr?.name === 'NotFoundError' ||
        anyErr?.name === 'NotReadableError' ||
        anyErr?.name === 'OverconstrainedError' ||
        anyErr?.name === 'AbortError' ||
        anyErr?.name === 'DevicesNotFoundError'
    ) {
        return { code: 'device', message };
    }
    return { code: 'generic', message };
}

/** A reconnect attempt that can never succeed: stop retrying and tell the user why. */
function terminalReconnectCode(err: unknown): WebRTCErrorCode | null {
    const anyErr = err as { name?: string; status?: number } | null;
    if (anyErr?.name === 'UnauthorizedError' || anyErr?.status === 401) return 'unauthorized';
    if (anyErr?.status === 404 || anyErr?.status === 403) return 'ended';
    return null;
}

/** Thrown internally when a start/join was cancelled (stop, unmount, new attempt) while awaiting. */
class StaleSessionError extends Error {
    constructor() {
        super('stale session');
        this.name = 'StaleSessionError';
    }
}

function devWarn(...args: unknown[]) {
    if (__DEV__) console.warn(...args);
}

export type StartLiveOptions = CreateRoomOptions;

export interface UseWebRTCReturn {
    /** Current streaming state */
    state: StreamingState;
    /** Room ID once created/joined */
    roomId: string | null;
    /** Local camera/mic stream for preview */
    localStream: MediaStream | null;
    /** Remote streams from other co-streamers */
    remoteStreams: MediaStream[];
    /** Technical error message if state === 'error' */
    error: string | null;
    /** Failure reason if state === 'error' */
    errorCode: WebRTCErrorCode | null;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
    /** True while the front camera is selected (preview mirrored) */
    isFrontCamera: boolean;
    /** Create a new room & start streaming */
    startLive: (roomName: string, options?: StartLiveOptions) => Promise<void>;
    /** Stream into a room that already exists (e.g. the user's scheduled live) */
    hostExistingRoom: (roomId: string) => Promise<void>;
    /** Join an existing room as co-streamer */
    joinAsCoStreamer: (roomId: string) => Promise<void>;
    /** Cleanly disconnect (idempotent) */
    stopLive: () => Promise<void>;
    toggleAudio: () => void;
    toggleVideo: () => void;
    switchCamera: () => void;
}

type SessionKind = 'create' | 'host-existing' | 'join';

export function useWebRTC(): UseWebRTCReturn {
    const [state, setState] = useState<StreamingState>('idle');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<WebRTCErrorCode | null>(null);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isFrontCamera, setIsFrontCamera] = useState(true);

    const mountedRef = useRef(true);
    /** Bumped on every start and every release: invalidates in-flight async work. */
    const sessionRef = useRef(0);
    /** True between a successful `begin()` and the next `release()`. */
    const activeRef = useRef(false);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const roomIdRef = useRef<string | null>(null);
    /** Whether leaving must notify the backend (room we created, joined, or whose offer was accepted). */
    const disconnectOnReleaseRef = useRef(false);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamsRef = useRef<Map<string, any>>(new Map());
    const trackCleanupsRef = useRef<Array<() => void>>([]);
    /** Outgoing ICE candidates waiting for the offer to be posted (kept in generation order). */
    const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
    const offerPostedRef = useRef(false);
    const drainingRef = useRef(false);
    const renegotiationInFlightRef = useRef(false);
    const renegotiationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const videoMutedByUserRef = useRef(false);
    /** True once the media connection was established: only then is a drop worth reconnecting. */
    const hasConnectedRef = useRef(false);
    /** True while the reconnect loop is running (re-publishing into the same room). */
    const reconnectingRef = useRef(false);

    const ifMounted = useCallback((fn: () => void) => {
        if (mountedRef.current) fn();
    }, []);

    // Background: stop sending video frames; foreground: resume unless the user turned the camera off.
    useEffect(() => {
        if (Platform.OS === 'web') return;

        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            const stream = localStreamRef.current;
            if (!stream) return;
            const enable = nextAppState === 'active' && !videoMutedByUserRef.current;
            if (nextAppState === 'active' || nextAppState === 'background' || nextAppState === 'inactive') {
                stream.getVideoTracks().forEach((track: any) => {
                    if (track && 'enabled' in track) {
                        track.enabled = enable;
                    }
                });
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const getRenderableStreams = useCallback(() => {
        const streams = Array.from(remoteStreamsRef.current.values());
        return streams.filter((s: any) => {
            const videoTracks: any[] = typeof s?.getVideoTracks === 'function' ? s.getVideoTracks() : [];
            // A track that ended (sender left, transceiver stopped) is a ghost tile: nothing will ever play.
            const hasVideo = videoTracks.some((track) => track?.readyState !== 'ended');
            const hasUrl = Platform.OS === 'web' || typeof s?.toURL === 'function';
            return hasVideo && hasUrl;
        });
    }, []);

    const publishRemoteStreams = useCallback(() => {
        // New array reference forces a re-render when a track un-mutes.
        ifMounted(() => setRemoteStreams([...getRenderableStreams()]));
    }, [getRenderableStreams, ifMounted]);

    const ensureNativeWebRTC = useCallback(() => {
        if (Platform.OS !== 'web' && !isNativeWebRTC) {
            throw new WebRTCError(
                'unsupported',
                "WebRTC is not available in Expo Go, use a development build (expo run:android / expo run:ios)."
            );
        }
    }, []);

    const stopRenegotiationPolling = useCallback(() => {
        if (renegotiationPollRef.current) {
            clearInterval(renegotiationPollRef.current);
            renegotiationPollRef.current = null;
        }
        renegotiationInFlightRef.current = false;
    }, []);

    const clearGraceTimer = useCallback(() => {
        if (graceTimerRef.current) {
            clearTimeout(graceTimerRef.current);
            graceTimerRef.current = null;
        }
    }, []);

    const assertActive = useCallback((sid: number) => {
        if (sid !== sessionRef.current) throw new StaleSessionError();
    }, []);

    /**
     * Synchronously stops everything (poll, listeners, peer connection, camera + mic) and
     * invalidates in-flight work. Returns the room to disconnect on the backend, if any.
     * Safe to call repeatedly: the room id is consumed, so the backend is notified once.
     */
    const release = useCallback((): string | null => {
        sessionRef.current += 1;
        activeRef.current = false;

        stopRenegotiationPolling();
        clearGraceTimer();

        trackCleanupsRef.current.forEach((cleanup) => {
            try {
                cleanup();
            } catch {
                // ignore: the track may already be gone
            }
        });
        trackCleanupsRef.current = [];

        const pc: any = pcRef.current;
        pcRef.current = null;
        if (pc) {
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.onconnectionstatechange = null;
            try {
                pc.close();
            } catch (err) {
                devWarn('peer connection close failed:', err);
            }
        }

        const stream = localStreamRef.current;
        localStreamRef.current = null;
        if (stream) {
            try {
                stream.getTracks().forEach((track: any) => track.stop());
            } catch (err) {
                devWarn('stopping local tracks failed:', err);
            }
        }

        // Remote audio must go silent right away, not only when the native layer eventually frees it.
        remoteStreamsRef.current.forEach((remote: any) => {
            try {
                remote?.getTracks?.().forEach((track: any) => {
                    track.enabled = false;
                    track.stop?.();
                });
            } catch {
                // stream already released
            }
        });
        remoteStreamsRef.current.clear();
        iceQueueRef.current = [];
        offerPostedRef.current = false;
        drainingRef.current = false;
        videoMutedByUserRef.current = false;
        hasConnectedRef.current = false;
        reconnectingRef.current = false;

        const rid = roomIdRef.current;
        const mustNotify = disconnectOnReleaseRef.current;
        roomIdRef.current = null;
        disconnectOnReleaseRef.current = false;
        return rid && mustNotify ? rid : null;
    }, [clearGraceTimer, stopRenegotiationPolling]);

    const resetUiState = useCallback(
        (nextState: StreamingState) => {
            ifMounted(() => {
                setLocalStream(null);
                setRemoteStreams([]);
                setRoomId(null);
                setIsAudioMuted(false);
                setIsVideoMuted(false);
                setIsFrontCamera(true);
                setState(nextState);
            });
        },
        [ifMounted]
    );

    const notifyBackend = useCallback(async (rid: string) => {
        try {
            await disconnectRoom(rid);
        } catch (err) {
            devWarn('disconnect call failed:', err);
        }
    }, []);

    /** Starts a new session; returns its id, or null when one is already running (double tap guard). */
    const begin = useCallback((): number | null => {
        if (activeRef.current) return null;
        activeRef.current = true;
        sessionRef.current += 1;
        return sessionRef.current;
    }, []);

    const fail = useCallback(
        async (sid: number, err: unknown, fallback: string) => {
            if (err instanceof StaleSessionError || sid !== sessionRef.current) {
                return; // cancelled on purpose: release() already ran
            }
            devWarn('broadcast failed:', err);
            const { code, message } = classifyError(err, fallback);
            const rid = release();
            resetUiState('error');
            ifMounted(() => {
                setError(message);
                setErrorCode(code);
            });
            if (rid) await notifyBackend(rid);
        },
        [ifMounted, notifyBackend, release, resetUiState]
    );

    /** Terminal end of a live connection: frees camera/mic/room. With a code the screen shows why. */
    const giveUp = useCallback(
        (sid: number, code: WebRTCErrorCode | null) => {
            if (sid !== sessionRef.current) return;
            const rid = release();
            if (code) {
                resetUiState('error');
                ifMounted(() => {
                    setError(`Live connection lost (${code})`);
                    setErrorCode(code);
                });
            } else {
                resetUiState('disconnected');
            }
            if (rid) void notifyBackend(rid);
        },
        [ifMounted, notifyBackend, release, resetUiState]
    );

    /** Late-bound: the reconnect loop needs createPeerConnection, which needs the connection handler. */
    const startReconnectRef = useRef<((sid: number) => void) | null>(null);

    // Acquire camera + mic
    const getLocalMedia = useCallback(
        async (sid: number): Promise<MediaStream> => {
            ensureNativeWebRTC();

            // Resolve mediaDevices lazily: the imported binding may have been
            // evaluated during SSR where navigator is undefined.
            const devices = mediaDevices ?? (typeof navigator === 'undefined' ? undefined : navigator.mediaDevices);

            if (!devices?.getUserMedia) {
                throw new WebRTCError(
                    Platform.OS === 'web' ? 'device' : 'unsupported',
                    Platform.OS === 'web'
                        ? 'Camera/microphone are not available in this browser (HTTPS and permissions required).'
                        : 'Camera is not available: WebRTC is not available in Expo Go, use a development build.'
                );
            }

            const stream = (await devices.getUserMedia({
                audio: true,
                video: {
                    facingMode: 'user',
                    width: 1280,
                    height: 720,
                    frameRate: 30,
                },
            })) as unknown as MediaStream;

            if (sid !== sessionRef.current) {
                // Cancelled while the permission prompt / camera were opening: never leave them on.
                stream.getTracks().forEach((track: any) => track.stop());
                throw new StaleSessionError();
            }

            localStreamRef.current = stream;
            ifMounted(() => setLocalStream(stream));
            return stream;
        },
        [ensureNativeWebRTC, ifMounted]
    );

    /** Sends queued ICE candidates one by one, in order. Errors never break the call. */
    const drainIceQueue = useCallback(async (sid: number) => {
        if (drainingRef.current) return;
        drainingRef.current = true;
        try {
            while (iceQueueRef.current.length > 0 && sid === sessionRef.current) {
                const candidate = iceQueueRef.current.shift() as RTCIceCandidateInit;
                const rid = roomIdRef.current;
                if (!rid) break;
                try {
                    await sendICECandidate(rid, candidate);
                } catch (err) {
                    devWarn('ICE send failed:', err);
                }
            }
        } finally {
            if (sid === sessionRef.current) drainingRef.current = false;
        }
    }, []);

    // Build peer connection, add local tracks, wire events
    const createPeerConnection = useCallback(
        (stream: any, sid: number) => {
            // Resolve lazily: imported binding may be undefined from SSR
            const PeerConnection =
                RTCPeerConnection ?? (typeof globalThis === 'undefined' ? undefined : (globalThis as any).RTCPeerConnection);
            if (!PeerConnection) {
                throw new WebRTCError('unsupported', 'RTCPeerConnection is not available in this environment.');
            }
            const pc: any = new PeerConnection(ICE_SERVERS);

            stream.getTracks().forEach((track: any) => {
                pc.addTrack(track, stream);
            });

            // ICE candidates go to the backend only once the offer was posted, in generation order.
            pc.onicecandidate = (event: any) => {
                if (!event?.candidate || sid !== sessionRef.current) return;
                // The media server only speaks UDP: TCP and other candidates would each cost a request
                // that the backend rejects (same filter as the web client).
                if (!isUdpCandidate(event.candidate.candidate)) return;
                iceQueueRef.current.push({
                    candidate: event.candidate.candidate,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    sdpMid: event.candidate.sdpMid,
                });
                if (offerPostedRef.current) {
                    void drainIceQueue(sid);
                }
            };

            pc.ontrack = (event: any) => {
                if (sid !== sessionRef.current) return;
                const track = event?.track;
                if (!track || track.kind !== 'video') {
                    return;
                }

                // Prefer the stream delivered by ontrack; RN binds decoders to it.
                let renderStream = event.streams?.[0] ?? null;
                if (!renderStream && MediaStream) {
                    const rebuilt = new (MediaStream as any)();
                    if (typeof rebuilt?.addTrack === 'function') {
                        rebuilt.addTrack(track);
                    }
                    renderStream = rebuilt;
                }

                // Ignore loopback/self-echo streams (negotiated but non-rendering placeholder).
                if (renderStream?.id && stream?.id && renderStream.id === stream.id) {
                    return;
                }
                if (!renderStream) {
                    return;
                }

                // One tile per remote *source stream*: the SFU may deliver the same source more than once
                // (renegotiations, duplicated forwards) with new track ids, which used to show as ghost users.
                const remoteKey = event.streams?.[0]?.id || track.id || renderStream.id || `${Date.now()}`;
                remoteStreamsRef.current.set(remoteKey, renderStream);

                const onStateChange = () => publishRemoteStreams();
                const onEnded = () => {
                    // A newer delivery of the same source may have replaced this one: leave it alone.
                    if (remoteStreamsRef.current.get(remoteKey) === renderStream) {
                        remoteStreamsRef.current.delete(remoteKey);
                    }
                    publishRemoteStreams();
                };

                publishRemoteStreams();

                // Listen for state changes (media arriving or stopping) and remove them on release.
                if (typeof track.addEventListener === 'function') {
                    track.addEventListener('unmute', onStateChange);
                    track.addEventListener('mute', onStateChange);
                    track.addEventListener('ended', onEnded);
                    trackCleanupsRef.current.push(() => {
                        track.removeEventListener?.('unmute', onStateChange);
                        track.removeEventListener?.('mute', onStateChange);
                        track.removeEventListener?.('ended', onEnded);
                    });
                } else {
                    track.onunmute = onStateChange;
                    track.onmute = onStateChange;
                    track.onended = onEnded;
                    trackCleanupsRef.current.push(() => {
                        track.onunmute = null;
                        track.onmute = null;
                        track.onended = null;
                    });
                }
            };

            pc.onconnectionstatechange = () => {
                if (sid !== sessionRef.current || pc !== pcRef.current) return;
                const connState = pc.connectionState;
                if (connState === 'connected') {
                    hasConnectedRef.current = true;
                    clearGraceTimer();
                    ifMounted(() => setState('live'));
                    return;
                }
                // The reconnect loop owns the lifecycle until it has published a new peer connection.
                if (reconnectingRef.current) return;

                if (connState === 'disconnected') {
                    // Transient: ICE may recover. Show "reconnecting" and only replace the peer after a grace period.
                    ifMounted(() => setState(hasConnectedRef.current ? 'reconnecting' : 'connecting'));
                    clearGraceTimer();
                    graceTimerRef.current = setTimeout(() => {
                        graceTimerRef.current = null;
                        if (sid !== sessionRef.current) return;
                        if (hasConnectedRef.current) {
                            startReconnectRef.current?.(sid);
                        } else {
                            giveUp(sid, null);
                        }
                    }, DISCONNECT_GRACE_MS);
                } else if (connState === 'failed' || connState === 'closed') {
                    clearGraceTimer();
                    if (hasConnectedRef.current) {
                        startReconnectRef.current?.(sid);
                    } else {
                        // Never connected: nothing to recover, free the camera/mic and the room.
                        giveUp(sid, null);
                    }
                }
            };

            pcRef.current = pc;
            return pc as RTCPeerConnection;
        },
        [clearGraceTimer, drainIceQueue, giveUp, ifMounted, publishRemoteStreams]
    );

    // SDP offer/answer exchange
    const negotiate = useCallback(
        async (pc: RTCPeerConnection, sid: number) => {
            const rid = roomIdRef.current;
            if (!rid) throw new StaleSessionError();

            // On native (react-native-webrtc), forcing extra recvonly transceivers can
            // create unstable offers/ghost tracks; keep negotiation minimal there.
            if (Platform.OS === 'web' && typeof pc.addTransceiver === 'function') {
                pc.addTransceiver('video', { direction: 'recvonly' });
                pc.addTransceiver('audio', { direction: 'recvonly' });
            }

            const offer = await pc.createOffer();
            assertActive(sid);
            const originalSdp = offer.sdp || '';
            const reorderedSdp = preferH264(originalSdp);

            const SessionDesc: any =
                RTCSessionDescription ?? (typeof globalThis === 'undefined' ? undefined : (globalThis as any).RTCSessionDescription);
            const makeDesc = (type: 'offer' | 'answer', sdp: string) =>
                SessionDesc ? new SessionDesc({ type, sdp }) : { type, sdp };

            let outboundSdp = reorderedSdp;
            try {
                await pc.setLocalDescription(makeDesc('offer', reorderedSdp) as any);
            } catch (err) {
                devWarn('setLocalDescription with preferred H264 SDP failed; retrying with original SDP', err);
                outboundSdp = originalSdp;
                await pc.setLocalDescription(makeDesc('offer', originalSdp) as any);
            }
            assertActive(sid);

            const { sdp: answerSdp } = await sendOffer(rid, outboundSdp);
            assertActive(sid);

            // The backend now knows this peer: candidates generated so far can be flushed.
            offerPostedRef.current = true;
            void drainIceQueue(sid);

            await pc.setRemoteDescription(makeDesc('answer', answerSdp) as any);
            assertActive(sid);
        },
        [assertActive, drainIceQueue]
    );

    /**
     * After a renegotiation, forget the remote streams whose tracks are no longer received: react-native-webrtc
     * does not always fire `ended` when the SFU removes a sender, which left stale tiles behind.
     */
    const pruneStaleRemoteStreams = useCallback(
        (pc: any) => {
            if (typeof pc?.getReceivers !== 'function') return;
            const receivers: any[] = pc.getReceivers() ?? [];
            const active = new Set(receivers.map((receiver) => receiver?.track?.id).filter(Boolean));
            let changed = false;
            remoteStreamsRef.current.forEach((remote: any, key: string) => {
                const tracks: any[] = typeof remote?.getVideoTracks === 'function' ? remote.getVideoTracks() : [];
                if (!tracks.some((track) => active.has(track?.id))) {
                    remoteStreamsRef.current.delete(key);
                    changed = true;
                }
            });
            if (changed) publishRemoteStreams();
        },
        [publishRemoteStreams]
    );

    const pollRenegotiationOffer = useCallback(
        async (sid: number) => {
            if (renegotiationInFlightRef.current) return;

            const pc: any = pcRef.current;
            const currentRoomId = roomIdRef.current;
            if (!pc || !currentRoomId) return;

            renegotiationInFlightRef.current = true;
            try {
                const pendingOffer = await fetchRenegotiationOffer(currentRoomId);
                if (!pendingOffer || sid !== sessionRef.current) return;

                const SessionDesc: any =
                    RTCSessionDescription ?? (typeof globalThis === 'undefined' ? undefined : (globalThis as any).RTCSessionDescription);
                const inboundOffer = SessionDesc
                    ? new SessionDesc({ type: 'offer', sdp: pendingOffer.sdp })
                    : { type: 'offer', sdp: pendingOffer.sdp };
                await pc.setRemoteDescription(inboundOffer);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                if (sid !== sessionRef.current) return;

                const answerSdp = pc.localDescription?.sdp || answer.sdp || '';
                if (!answerSdp) {
                    throw new Error('Renegotiation answer SDP is empty.');
                }

                await sendRenegotiationAnswer(currentRoomId, answerSdp);
                if (sid === sessionRef.current) pruneStaleRemoteStreams(pc);
            } catch (err) {
                devWarn('renegotiation poll/apply failed:', err);
            } finally {
                if (sid === sessionRef.current) renegotiationInFlightRef.current = false;
            }
        },
        [pruneStaleRemoteStreams]
    );

    const startRenegotiationPolling = useCallback(
        (sid: number) => {
            stopRenegotiationPolling();
            renegotiationPollRef.current = setInterval(() => {
                void pollRenegotiationOffer(sid);
            }, RENEGOTIATION_POLL_MS);
            void pollRenegotiationOffer(sid);
        },
        [pollRenegotiationOffer, stopRenegotiationPolling]
    );

    /** Drops the current peer connection but keeps camera, mic and room: the next one replaces it. */
    const detachPeer = useCallback(() => {
        stopRenegotiationPolling();
        trackCleanupsRef.current.forEach((cleanup) => {
            try {
                cleanup();
            } catch {
                // ignore: the track may already be gone
            }
        });
        trackCleanupsRef.current = [];

        const pc: any = pcRef.current;
        pcRef.current = null;
        if (pc) {
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.onconnectionstatechange = null;
            try {
                pc.close();
            } catch (err) {
                devWarn('peer connection close failed:', err);
            }
        }

        // The remote streams belonged to that connection: the new one delivers them again.
        remoteStreamsRef.current.clear();
        publishRemoteStreams();
        iceQueueRef.current = [];
        offerPostedRef.current = false;
        drainingRef.current = false;
    }, [publishRemoteStreams, stopRenegotiationPolling]);

    /**
     * The media connection is lost: keep the camera and the room, and re-publish with a brand new
     * peer connection (the backend replaces the stale one of the same user) with growing delays.
     */
    const startReconnect = useCallback(
        (sid: number) => {
            if (reconnectingRef.current || sid !== sessionRef.current) return;
            reconnectingRef.current = true;
            clearGraceTimer();
            ifMounted(() => setState('reconnecting'));

            const run = async () => {
                for (const delay of RECONNECT_BACKOFF_MS) {
                    await new Promise<void>((resolve) => setTimeout(resolve, delay));
                    assertActive(sid);
                    const stream = localStreamRef.current;
                    if (!stream) throw new StaleSessionError();

                    detachPeer();
                    try {
                        const pc: any = createPeerConnection(stream, sid);
                        await negotiate(pc, sid);
                        // Died while negotiating: count it as a failed attempt.
                        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                            throw new Error('peer connection failed during reconnection');
                        }
                        startRenegotiationPolling(sid);
                        reconnectingRef.current = false;
                        return;
                    } catch (err) {
                        if (err instanceof StaleSessionError || sid !== sessionRef.current) throw err;
                        const code = terminalReconnectCode(err);
                        if (code) {
                            giveUp(sid, code);
                            return;
                        }
                        devWarn('reconnect attempt failed:', err);
                    }
                }
                giveUp(sid, 'connection');
            };

            run().catch((err) => {
                if (!(err instanceof StaleSessionError)) devWarn('reconnect loop crashed:', err);
            });
        },
        [
            assertActive,
            clearGraceTimer,
            createPeerConnection,
            detachPeer,
            giveUp,
            ifMounted,
            negotiate,
            startRenegotiationPolling,
        ]
    );

    useEffect(() => {
        startReconnectRef.current = startReconnect;
    }, [startReconnect]);

    // ---- Public API ----

    const prepareStart = useCallback(
        (sid: number) => {
            ifMounted(() => {
                setState('creating');
                setError(null);
                setErrorCode(null);
                setIsAudioMuted(false);
                setIsVideoMuted(false);
                setIsFrontCamera(true);
            });
            ensureNativeWebRTC();
            assertActive(sid);
        },
        [assertActive, ensureNativeWebRTC, ifMounted]
    );

    const connect = useCallback(
        async (sid: number, kind: SessionKind) => {
            ifMounted(() => setState('connecting'));
            const stream = await getLocalMedia(sid);
            const pc = createPeerConnection(stream, sid);
            await negotiate(pc, sid);
            if (kind === 'host-existing') {
                // Before the offer was accepted we do not own the room: leaving must not cancel it.
                disconnectOnReleaseRef.current = true;
            }
            startRenegotiationPolling(sid);
        },
        [createPeerConnection, getLocalMedia, ifMounted, negotiate, startRenegotiationPolling]
    );

    const startLive = useCallback(
        async (roomName: string, options?: StartLiveOptions) => {
            const sid = begin();
            if (sid === null) return;
            try {
                prepareStart(sid);

                // 1. Create room
                const { roomId: newRoomId } = await createRoom(roomName, options);
                if (sid !== sessionRef.current) {
                    // Cancelled while the request was in flight: do not leave an orphan room behind.
                    void notifyBackend(newRoomId);
                    return;
                }
                roomIdRef.current = newRoomId;
                disconnectOnReleaseRef.current = true;
                ifMounted(() => setRoomId(newRoomId));

                // 2-4. Camera/mic, peer connection, SDP exchange
                await connect(sid, 'create');
            } catch (err) {
                await fail(sid, err, 'Failed to start live');
            }
        },
        [begin, connect, fail, ifMounted, notifyBackend, prepareStart]
    );

    const hostExistingRoom = useCallback(
        async (existingRoomId: string) => {
            const sid = begin();
            if (sid === null) return;
            try {
                prepareStart(sid);
                roomIdRef.current = existingRoomId;
                ifMounted(() => setRoomId(existingRoomId));
                await connect(sid, 'host-existing');
            } catch (err) {
                await fail(sid, err, 'Failed to host stream');
            }
        },
        [begin, connect, fail, ifMounted, prepareStart]
    );

    const joinAsCoStreamer = useCallback(
        async (targetRoomId: string) => {
            const sid = begin();
            if (sid === null) return;
            try {
                prepareStart(sid);
                roomIdRef.current = targetRoomId;
                // From here on, leaving must release the reservation / participant slot.
                disconnectOnReleaseRef.current = true;
                ifMounted(() => setRoomId(targetRoomId));

                // 1. Reserve a spot
                await reserveRoom(targetRoomId);
                assertActive(sid);

                // 2-4. Camera/mic, peer connection, SDP exchange
                await connect(sid, 'join');
            } catch (err) {
                await fail(sid, err, 'Failed to join stream');
            }
        },
        [assertActive, begin, connect, fail, ifMounted, prepareStart]
    );

    const stopLive = useCallback(async () => {
        const rid = release();
        resetUiState('idle');
        ifMounted(() => {
            setError(null);
            setErrorCode(null);
        });
        if (rid) await notifyBackend(rid);
    }, [ifMounted, notifyBackend, release, resetUiState]);

    const toggleAudio = useCallback(() => {
        const tracks = localStreamRef.current?.getAudioTracks() ?? [];
        if (tracks.length === 0) return;
        const nextEnabled = !(tracks[0] as any).enabled;
        tracks.forEach((track: any) => {
            track.enabled = nextEnabled;
        });
        setIsAudioMuted(!nextEnabled);
    }, []);

    const toggleVideo = useCallback(() => {
        const tracks = localStreamRef.current?.getVideoTracks() ?? [];
        if (tracks.length === 0) return;
        const nextEnabled = !(tracks[0] as any).enabled;
        tracks.forEach((track: any) => {
            track.enabled = nextEnabled;
        });
        videoMutedByUserRef.current = !nextEnabled;
        setIsVideoMuted(!nextEnabled);
    }, []);

    const switchingCameraRef = useRef(false);

    const switchCamera = useCallback(() => {
        const track: any = localStreamRef.current?.getVideoTracks()[0];
        // react-native-webrtc only (no-op on web, where facingMode would need a new getUserMedia).
        if (!track || typeof track._switchCamera !== 'function') return;
        // A disabled or ended track means the native camera is stopped: switching would reject
        // with "camera is not running".
        if (track.enabled === false || track.readyState === 'ended') return;
        if (switchingCameraRef.current) return;

        switchingCameraRef.current = true;
        // `_switchCamera` returns a promise on device; it must never go unhandled.
        Promise.resolve()
            .then(() => track._switchCamera())
            .then(() => ifMounted(() => setIsFrontCamera((prev) => !prev)))
            .catch((err: unknown) => {
                if (__DEV__) console.warn('switchCamera failed:', err);
            })
            .finally(() => {
                switchingCameraRef.current = false;
            });
    }, [ifMounted]);

    // Unmount (hardware back, swipe back, navigation): camera, mic, polling and backend room are released.
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            const rid = release();
            if (rid) void notifyBackend(rid);
        };
    }, [notifyBackend, release]);

    return {
        state,
        roomId,
        localStream,
        remoteStreams,
        error,
        errorCode,
        isAudioMuted,
        isVideoMuted,
        isFrontCamera,
        startLive,
        hostExistingRoom,
        joinAsCoStreamer,
        stopLive,
        toggleAudio,
        toggleVideo,
        switchCamera,
    };
}
