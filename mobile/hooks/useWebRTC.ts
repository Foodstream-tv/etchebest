import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
    createRoom,
    disconnectRoom,
    reserveRoom,
    sendICECandidate,
    sendOffer,
} from '../services/streaming';
import {
    mediaDevices,
    RTCPeerConnection,
    RTCSessionDescription,
    MediaStream,
    isNativeWebRTC,
} from '../utils/webrtc';

const ICE_SERVERS = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

// Prioritize exactly H264 Constrained Baseline Profile (42e01f) with packetization-mode=1.
function preferH264(sdp: string): string {
    if (!sdp) return sdp;
    const lines = sdp.split('\n');
    let targetPt = '';

    // 1. First, try to find an exact H264 profile match (42e01f).
    for (const line of lines) {
        const match = line.match(/^a=fmtp:(\d+)\s+.*profile-level-id=42e01f/i);
        if (match && line.includes('packetization-mode=1')) {
            targetPt = match[1];
            break;
        }
    }

    // 2. Fallback to any H264 payload type.
    if (!targetPt) {
        for (const line of lines) {
            const match = line.match(/^a=rtpmap:(\d+)\s+H264\//i);
            if (match) {
                targetPt = match[1];
                break;
            }
        }
    }
    
    if (!targetPt) return sdp;

    const videoPts = new Set<string>();
    for (const line of lines) {
        if (!line.startsWith('m=video ')) continue;
        const parts = line.trim().split(/\s+/);
        parts.slice(3).forEach((pt) => videoPts.add(pt));
    }

    // Keep H264 target PT and its RTX PT (if present).
    const keepPts = new Set<string>([targetPt]);
    for (const line of lines) {
        const rtxMatch = line.match(/^a=fmtp:(\d+)\s+apt=(\d+)/i);
        if (!rtxMatch) continue;
        if (rtxMatch[2] === targetPt) {
            keepPts.add(rtxMatch[1]);
        }
    }

    // 3. Reorder the m=video line to put the target PT first.
    const filtered = sdp.replace(/^(m=video\s+\S+\s+\S+)\s+(.+)$/gm, (match: string, prefix: string, pts: string) => {
        const all = pts.trim().split(/\s+/).filter((pt: string) => keepPts.has(pt));
        if (all.includes(targetPt)) {
            const others = all.filter((pt: string) => pt !== targetPt);
            return `${prefix} ${[targetPt, ...others].join(' ')}`;
        }
        return match;
    });

    // 4. Remove non-H264 video codec attributes from the offer.
    const filteredLines = filtered
        .split('\n')
        .filter((line) => {
            const m = line.match(/^a=(rtpmap|fmtp|rtcp-fb):(\d+)/i);
            if (!m) return true;
            const pt = m[2];
            if (!videoPts.has(pt)) return true;
            return keepPts.has(pt);
        });

    return filteredLines.join('\n');
}

export type StreamingState =
    | 'idle'
    | 'creating'
    | 'connecting'
    | 'live'
    | 'error'
    | 'disconnected';

interface UseWebRTCReturn {
    /** Current streaming state */
    state: StreamingState;
    /** Room ID once created/joined */
    roomId: string | null;
    /** Local camera/mic stream for preview */
    localStream: MediaStream | null;
    /** Remote streams from other co-streamers */
    remoteStreams: MediaStream[];
    /** Error message if state === 'error' */
    error: string | null;
    /** Create a new room & start streaming */
    startLive: (roomName: string) => Promise<void>;
    /** Join an existing room as co-streamer */
    joinAsCoStreamer: (roomId: string) => Promise<void>;
    /** Cleanly disconnect */
    stopLive: () => Promise<void>;
}

export function useWebRTC(): UseWebRTCReturn {
    const [state, setState] = useState<StreamingState>('idle');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
    const [error, setError] = useState<string | null>(null);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const roomIdRef = useRef<string | null>(null);
    const iceCandidateQueue = useRef<RTCIceCandidate[]>([]);
    const remoteStreamsRef = useRef<Map<string, any>>(new Map());

    const getRenderableStreams = useCallback(() => {
        const streams = Array.from(remoteStreamsRef.current.values());
        return streams.filter((s: any) => {
            const hasVideo = typeof s?.getVideoTracks === 'function' && s.getVideoTracks().length > 0;
            const hasUrl = Platform.OS === 'web' || typeof s?.toURL === 'function';
            return hasVideo && hasUrl;
        });
    }, []);

    const ensureNativeWebRTC = useCallback(() => {
        if (Platform.OS !== 'web' && !isNativeWebRTC) {
            throw new Error(
                'WebRTC n\'est pas disponible dans Expo Go. Utilise un development build (expo run:android / expo run:ios) pour la visio mobile.'
            );
        }
    }, []);

    // Acquire camera + mic
    const getLocalMedia = useCallback(async (): Promise<MediaStream> => {
        ensureNativeWebRTC();

        // Resolve mediaDevices lazily — the imported binding may have been
        // evaluated during SSR where navigator is undefined.
        const devices = mediaDevices
            ?? (typeof navigator === 'undefined' ? undefined : navigator.mediaDevices);

        if (!devices?.getUserMedia) {
            if (Platform.OS === 'web') {
                throw new Error(
                    'La camera/micro ne sont pas disponibles dans ce navigateur. Sur mobile web, utilise HTTPS (ou localhost), autorise les permissions camera/micro et recharge la page.'
                );
            }

            throw new Error(
                'La caméra n\'est pas disponible. Le streaming nécessite un build natif (npx expo run:android). Expo Go ne supporte pas react-native-webrtc.'
            );
        }

        const stream = await devices.getUserMedia({
            audio: true,
            video: {
                facingMode: 'user',
                width: 1280,
                height: 720,
                frameRate: 30,
            },
        });
        setLocalStream(stream as unknown as MediaStream);
        return stream as unknown as MediaStream;
    }, [ensureNativeWebRTC]);

    // Build peer connection, add local tracks, wire events
    const createPeerConnection = useCallback(

        (stream: any, currentRoomId: string) => {
            // Resolve lazily — imported binding may be undefined from SSR
            const PeerConnection = RTCPeerConnection
                ?? (typeof globalThis === 'undefined' ? undefined : (globalThis as any).RTCPeerConnection);
            if (!PeerConnection) {
                throw new Error('RTCPeerConnection is not available in this environment.');
            }
            const pc = new PeerConnection(ICE_SERVERS);

            // Add local tracks
            stream.getTracks().forEach((track: any) => {
                pc.addTrack(track, stream);
            });

            // ICE candidates → send to backend
            (pc).onicecandidate = (event: any) => {
                if (event.candidate) {
                    sendICECandidate(currentRoomId, {
                        candidate: event.candidate.candidate,
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                        sdpMid: event.candidate.sdpMid,
                    }).catch((err: any) => console.warn('ICE send failed:', err));
                }
            };

            // Remote tracks → add to remote streams
            (pc).ontrack = (event: any) => {
                console.log(`[WebRTC ontrack] kind=${event.track.kind}, id=${event.track.id}, muted=${event.track.muted}, readyState=${event.track.readyState}, streams length=${event.streams?.length || 0}`);
                const track = event.track;
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

                // In 1:1 mode, ignore loopback/self-echo streams to avoid selecting
                // a negotiated but non-rendering placeholder as "remote".
                if (renderStream?.id && stream?.id && renderStream.id === stream.id) {
                    return;
                }

                if (!renderStream) {
                    return;
                }

                const remoteKey = track.id || renderStream.id || `${Date.now()}`;
                remoteStreamsRef.current.set(remoteKey, renderStream);

                const handleTrackStateChange = () => {
                    const streams = getRenderableStreams();
                    // Return a new array reference to force a React re-render when track un-mutes.
                    setRemoteStreams([...streams]);
                };

                // Initial check
                handleTrackStateChange();

                // Listen for state changes (media arriving or stopping)
                if (typeof track.addEventListener === 'function') {
                    track.addEventListener('unmute', handleTrackStateChange);
                    track.addEventListener('mute', handleTrackStateChange);
                } else {
                    track.onunmute = handleTrackStateChange;
                    track.onmute = handleTrackStateChange;
                }
            };            // Connection state changes
            pc.onconnectionstatechange = () => {
                const connState = (pc).connectionState;
                if (connState === 'connected') {
                    setState('live');
                } else if (
                    connState === 'disconnected' ||
                    connState === 'failed' ||
                    connState === 'closed'
                ) {
                    setState('disconnected');
                }
            };

            pcRef.current = pc;
            return pc;
        },
        [getRenderableStreams]
    );

    // SDP offer/answer exchange
    const negotiate = useCallback(
        async (pc: RTCPeerConnection, currentRoomId: string) => {
            // On native (react-native-webrtc), forcing extra recvonly transceivers can
            // create unstable offers/ghost tracks; keep negotiation minimal there.
            if (Platform.OS === 'web' && typeof pc.addTransceiver === 'function') {
                pc.addTransceiver('video', { direction: 'recvonly' });
                pc.addTransceiver('audio', { direction: 'recvonly' });
            }

            const offer = await pc.createOffer();
            const originalSdp = offer.sdp || '';
            const reorderedSdp = preferH264(originalSdp);

            const SessionDesc = RTCSessionDescription
                ?? (typeof globalThis === 'undefined' ? undefined : (globalThis as any).RTCSessionDescription);

            let outboundSdp = reorderedSdp;
            try {
                const preferredOffer = SessionDesc
                    ? new SessionDesc({ type: 'offer', sdp: reorderedSdp })
                    : { type: 'offer', sdp: reorderedSdp };
                await pc.setLocalDescription(preferredOffer as any);
            } catch (err) {
                console.warn('setLocalDescription with preferred H264 SDP failed; retrying with original SDP', err);
                outboundSdp = originalSdp;
                const fallbackOffer = SessionDesc
                    ? new SessionDesc({ type: 'offer', sdp: originalSdp })
                    : { type: 'offer', sdp: originalSdp };
                await pc.setLocalDescription(fallbackOffer as any);
            }

            const { sdp: answerSdp } = await sendOffer(
                currentRoomId,
                outboundSdp
            );

            const answer = new SessionDesc({ type: 'answer', sdp: answerSdp }) as RTCSessionDescriptionInit;
            await pc.setRemoteDescription(answer as any);

            // Flush buffered ICE candidates
            for (const candidate of iceCandidateQueue.current) {
                await pc.addIceCandidate(candidate);
            }
            iceCandidateQueue.current = [];
        },
        []
    );

    // ---- Public API ----

    const startLive = useCallback(
        async (roomName: string) => {
            try {
                ensureNativeWebRTC();
                setState('creating');
                setError(null);

                // 1. Create room
                const { roomId: newRoomId } = await createRoom(roomName);
                setRoomId(newRoomId);
                roomIdRef.current = newRoomId;

                // 2. Get camera/mic
                setState('connecting');
                const stream = await getLocalMedia();

                // 3. Build peer connection
                const pc = createPeerConnection(stream, newRoomId);

                // 4. SDP exchange
                await negotiate(pc, newRoomId);
            } catch (err: any) {
                console.error('startLive error:', err);
                setError(err.message || 'Failed to start live');
                setState('error');
            }
        },
        [ensureNativeWebRTC, getLocalMedia, createPeerConnection, negotiate]
    );

    const joinAsCoStreamer = useCallback(
        async (targetRoomId: string) => {
            try {
                ensureNativeWebRTC();
                setState('creating');
                setError(null);
                setRoomId(targetRoomId);
                roomIdRef.current = targetRoomId;

                // 1. Reserve a spot
                await reserveRoom(targetRoomId);

                // 2. Get camera/mic
                setState('connecting');
                const stream = await getLocalMedia();

                // 3. Build peer connection
                const pc = createPeerConnection(stream, targetRoomId);

                // 4. SDP exchange
                await negotiate(pc, targetRoomId);
            } catch (err: any) {
                console.error('joinAsCoStreamer error:', err);
                setError(err.message || 'Failed to join stream');
                setState('error');
            }
        },
        [ensureNativeWebRTC, getLocalMedia, createPeerConnection, negotiate]
    );

    const stopLive = useCallback(async () => {
        // Close peer connection
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }

        // Stop local tracks
        if (localStream) {
            localStream.getTracks().forEach((t: any) => t.stop());
            setLocalStream(null);
        }

        // Notify backend
        if (roomIdRef.current) {
            try {
                await disconnectRoom(roomIdRef.current);
            } catch (e) {
                console.warn('disconnect call failed:', e);
            }
        }

        setRemoteStreams([]);
        remoteStreamsRef.current.clear();
        setRoomId(null);
        roomIdRef.current = null;
        setState('idle');
        setError(null);
    }, [localStream]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pcRef.current) {
                pcRef.current.close();
            }
            remoteStreamsRef.current.clear();
        };
    }, []);

    return {
        state,
        roomId,
        localStream,
        remoteStreams,
        error,
        startLive,
        joinAsCoStreamer,
        stopLive,
    };
}
