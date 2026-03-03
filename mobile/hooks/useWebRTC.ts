import { useCallback, useEffect, useRef, useState } from 'react';
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
    RTCSessionDescription
} from '../utils/webrtc';

const ICE_SERVERS = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

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

    // Acquire camera + mic
    const getLocalMedia = useCallback(async (): Promise<MediaStream> => {
        // Resolve mediaDevices lazily — the imported binding may have been
        // evaluated during SSR where navigator is undefined.
        const devices = mediaDevices
            ?? (typeof navigator === 'undefined' ? undefined : navigator.mediaDevices);

        if (!devices?.getUserMedia) {
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
    }, []);

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
                if (!event.streams?.[0]) return;
                const newStream = event.streams[0];
                const newUrl = newStream.toURL?.();
                setRemoteStreams((prev) => {
                    const exists = prev.some((s: any) => s.toURL?.() === newUrl);
                    return exists ? prev : [...prev, newStream];
                });
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
        []
    );

    // SDP offer/answer exchange
    const negotiate = useCallback(
        async (pc: RTCPeerConnection, currentRoomId: string) => {
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            } as any);
            await pc.setLocalDescription(offer);

            const { sdp: answerSdp } = await sendOffer(
                currentRoomId,
                offer.sdp
            );

            const SessionDesc = RTCSessionDescription
                ?? (typeof globalThis === 'undefined' ? undefined : (globalThis as any).RTCSessionDescription);
            const answer = SessionDesc
                ? new SessionDesc({ type: 'answer', sdp: answerSdp })
                : { type: 'answer', sdp: answerSdp };
            await pc.setRemoteDescription(answer);

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
        [getLocalMedia, createPeerConnection, negotiate]
    );

    const joinAsCoStreamer = useCallback(
        async (targetRoomId: string) => {
            try {
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
        [getLocalMedia, createPeerConnection, negotiate]
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
