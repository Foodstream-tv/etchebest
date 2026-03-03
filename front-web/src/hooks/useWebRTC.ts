import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRoom,
  disconnectRoom,
  reserveRoom,
  sendICECandidate,
  sendOffer,
} from "@/services/streaming";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export type StreamingState =
  | "idle"
  | "creating"
  | "connecting"
  | "live"
  | "error"
  | "disconnected";

export function useWebRTC(token?: string) {
  const [state, setState] = useState<StreamingState>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomIdRef = useRef<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const stopLiveRef = useRef<(() => Promise<void>) | null>(null);

  // ✅ toujours le dernier token sans recréer les callbacks
  const tokenRef = useRef<string | undefined>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const getLocalMedia = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia indisponible (HTTPS requis hors localhost).");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: "user", width: 1280, height: 720, frameRate: 30 },
    });

    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const createPeerConnection = useCallback((stream: MediaStream, currentRoomId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      sendICECandidate(
        currentRoomId,
        {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
          sdpMid: event.candidate.sdpMid ?? null,
        },
        tokenRef.current
      ).catch(console.warn);
    };

    pc.ontrack = (event) => {
      const s = event.streams?.[0];
      if (!s) return;
      setRemoteStreams((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
    };

    pc.onconnectionstatechange = () => {
      const cs = pc.connectionState;
      if (cs === "connected") setState("live");
      if (cs === "disconnected" || cs === "failed" || cs === "closed") setState("disconnected");
    };

    pcRef.current = pc;
    return pc;
  }, []);

  const negotiate = useCallback(async (pc: RTCPeerConnection, currentRoomId: string) => {
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);

    const { sdp: answerSdp } = await sendOffer(currentRoomId, offer.sdp!, tokenRef.current);
    await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answerSdp }));
  }, []);

  const startLive = useCallback(async (roomName: string) => {
    try {
      setState("creating");
      setError(null);
      setRemoteStreams([]);

      // ⛔ Si ton backend exige un token partout, tu peux décommenter:
      // if (!tokenRef.current) throw new Error("Non authentifié (token manquant).");

      const { roomId: newRoomId } = await createRoom(roomName, tokenRef.current);
      setRoomId(newRoomId);
      roomIdRef.current = newRoomId;

      setState("connecting");
      const stream = await getLocalMedia();

      const pc = createPeerConnection(stream, newRoomId);
      await negotiate(pc, newRoomId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to start live");
      setState("error");
    }
  }, [createPeerConnection, getLocalMedia, negotiate]);

  const hostExistingRoom = useCallback(async (existingRoomId: string) => {
    try {
      setState("connecting");
      setError(null);
      setRemoteStreams([]);

      setRoomId(existingRoomId);
      roomIdRef.current = existingRoomId;

      const stream = await getLocalMedia();
      const pc = createPeerConnection(stream, existingRoomId);
      await negotiate(pc, existingRoomId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to host stream");
      setState("error");
    }
  }, [createPeerConnection, getLocalMedia, negotiate]);

  const joinAsCoStreamer = useCallback(async (targetRoomId: string) => {
    try {
      setState("creating");
      setError(null);
      setRemoteStreams([]);

      setRoomId(targetRoomId);
      roomIdRef.current = targetRoomId;

      await reserveRoom(targetRoomId, tokenRef.current);

      setState("connecting");
      const stream = await getLocalMedia();

      const pc = createPeerConnection(stream, targetRoomId);
      await negotiate(pc, targetRoomId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to join stream");
      setState("error");
    }
  }, [createPeerConnection, getLocalMedia, negotiate]);

  const stopLive = useCallback(async () => {
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;

    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    localStreamRef.current = null;
    setLocalStream(null);

    const rid = roomIdRef.current;
    roomIdRef.current = null;

    setRoomId(null);
    setRemoteStreams([]);
    setState("idle");
    setError(null);

    if (rid) await disconnectRoom(rid, tokenRef.current).catch(console.warn);
  }, []);

  useEffect(() => {
    stopLiveRef.current = stopLive;
  }, [stopLive]);

  useEffect(() => {
    return () => {
      stopLiveRef.current?.();
    };
  }, []);

  return {
    state,
    roomId,
    localStream,
    remoteStreams,
    error,
    startLive,
    hostExistingRoom,
    joinAsCoStreamer,
    stopLive,
  };
}
