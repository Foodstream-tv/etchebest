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

interface UseWebRTCReturn {
  state: StreamingState;
  roomId: string | null;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  error: string | null;
  startLive: (roomName: string) => Promise<void>;
  hostExistingRoom: (existingRoomId: string) => Promise<void>;
  joinAsCoStreamer: (targetRoomId: string) => Promise<void>;
  stopLive: () => Promise<void>;
}

export function useWebRTC(token?: string): UseWebRTCReturn {
  const [state, setState] = useState<StreamingState>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const stopLiveRef = useRef<(() => Promise<void>) | null>(null);
  const isStoppingRef = useRef(false);

  const tokenRef = useRef<string | undefined>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const resetStateForStart = useCallback(() => {
    setError(null);
    setRemoteStreams([]);
  }, []);

  const getLocalMedia = useCallback(async (): Promise<MediaStream> => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia indisponible (HTTPS requis hors localhost).");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
      facingMode: "user",
      width: 854,
      height: 480,
      frameRate: 24,
    }
    });

    console.log(
      "[WebRTC] local tracks =",
      stream.getTracks().map((t) => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        label: t.label,
      }))
    );

    localStreamRef.current = stream;
    setLocalStream(stream);

    return stream;
  }, []);

  const createPeerConnection = useCallback(
    (stream: MediaStream, currentRoomId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      console.log("[WebRTC] creating peer connection for room =", currentRoomId);

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Force H264 for video when available
      const capabilities = RTCRtpSender.getCapabilities?.("video");
      const codecs = capabilities?.codecs ?? [];

      const preferredH264 = codecs.filter((codec) => {
        const mime = codec.mimeType.toLowerCase();
        return mime === "video/h264";
      });

      if (preferredH264.length > 0) {
        console.log("[WebRTC] forcing H264 codec preferences =", preferredH264);

        for (const transceiver of pc.getTransceivers()) {
          if (
            transceiver.sender &&
            transceiver.sender.track &&
            transceiver.sender.track.kind === "video" &&
            typeof transceiver.setCodecPreferences === "function"
          ) {
            transceiver.setCodecPreferences(preferredH264);
          }
        }
      } else {
        console.warn("[WebRTC] no H264 codec exposed by browser");
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;

        const payload = event.candidate.toJSON();

        if (!payload.candidate || !payload.candidate.includes(" udp ")) {
          console.log("[WebRTC] skipping non-udp ICE =", payload);
          return;
        }

        console.log("[WebRTC] local ICE payload =", payload);

        sendICECandidate(currentRoomId, payload, tokenRef.current).catch((err) => {
          console.warn("[WebRTC] ICE send failed:", err);
        });
      };

      pc.ontrack = (event) => {
        const incomingStream = event.streams?.[0];
        if (!incomingStream) return;

        console.log("[WebRTC] remote stream received =", incomingStream.id);

        setRemoteStreams((prev) => {
          const exists = prev.some((s) => s.id === incomingStream.id);
          return exists ? prev : [...prev, incomingStream];
        });
      };

      pc.onconnectionstatechange = () => {
        console.log("[WebRTC] connectionState =", pc.connectionState);

        if (pc.connectionState === "connected") {
          setState("live");
        }

        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          setState("disconnected");
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[WebRTC] iceConnectionState =", pc.iceConnectionState);
      };

      pc.onsignalingstatechange = () => {
        console.log("[WebRTC] signalingState =", pc.signalingState);
      };

      pcRef.current = pc;
      return pc;
    },
    []
  );

  const negotiate = useCallback(
    async (pc: RTCPeerConnection, currentRoomId: string): Promise<void> => {
      console.log("[WebRTC] creating offer for room =", currentRoomId);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);
      console.log("[WebRTC] local description set");

      const { sdp: answerSdp } = await sendOffer(
        currentRoomId,
        offer.sdp || "",
        tokenRef.current
      );

      console.log("[WebRTC] answer received");
      console.log("[WebRTC] answer SDP contains candidate =", answerSdp.includes("a=candidate:"));
      console.log("[WebRTC] answer SDP contains ice-ufrag =", answerSdp.includes("a=ice-ufrag:"));
      console.log("[WebRTC] answer SDP contains ice-pwd =", answerSdp.includes("a=ice-pwd:"));

      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: "answer",
          sdp: answerSdp,
        })
      );

      console.log("[WebRTC] remote description set");
    },
    []
  );

  const cleanupPeerConnection = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.onsignalingstatechange = null;
        pcRef.current.close();
      } catch (err) {
        console.warn("[WebRTC] peer cleanup failed:", err);
      }
      pcRef.current = null;
    }
  }, []);

  const cleanupLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      } catch (err) {
        console.warn("[WebRTC] local stream cleanup failed:", err);
      }
    }

    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const stopLive = useCallback(async (): Promise<void> => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    const rid = roomIdRef.current;

    console.log("[WebRTC] stopping live for room =", rid);

    cleanupPeerConnection();
    cleanupLocalStream();

    roomIdRef.current = null;
    setRoomId(null);
    setRemoteStreams([]);
    setState("idle");
    setError(null);

    if (rid) {
      try {
        await disconnectRoom(rid, tokenRef.current);
        console.log("[WebRTC] room disconnected =", rid);
      } catch (err) {
        console.warn("[WebRTC] disconnect call failed:", err);
      }
    }

    isStoppingRef.current = false;
  }, [cleanupLocalStream, cleanupPeerConnection]);

  const startLive = useCallback(
    async (roomName: string): Promise<void> => {
      try {
        await stopLive();

        setState("creating");
        resetStateForStart();

        const { roomId: newRoomId } = await createRoom(roomName, tokenRef.current);
        console.log("[WebRTC] room created =", newRoomId);

        setRoomId(newRoomId);
        roomIdRef.current = newRoomId;

        setState("connecting");

        const stream = await getLocalMedia();
        const pc = createPeerConnection(stream, newRoomId);
        await negotiate(pc, newRoomId);
      } catch (err: any) {
        console.error("[WebRTC] startLive failed:", err);
        setError(err?.message || "Failed to start live");
        setState("error");
      }
    },
    [createPeerConnection, getLocalMedia, negotiate, resetStateForStart, stopLive]
  );

  const hostExistingRoom = useCallback(
    async (existingRoomId: string): Promise<void> => {
      try {
        await stopLive();

        setState("connecting");
        resetStateForStart();

        console.log("[WebRTC] host existing room =", existingRoomId);

        setRoomId(existingRoomId);
        roomIdRef.current = existingRoomId;

        const stream = await getLocalMedia();
        const pc = createPeerConnection(stream, existingRoomId);
        await negotiate(pc, existingRoomId);
      } catch (err: any) {
        console.error("[WebRTC] hostExistingRoom failed:", err);
        setError(err?.message || "Failed to host stream");
        setState("error");
      }
    },
    [createPeerConnection, getLocalMedia, negotiate, resetStateForStart, stopLive]
  );

  const joinAsCoStreamer = useCallback(
    async (targetRoomId: string): Promise<void> => {
      try {
        await stopLive();

        setState("creating");
        resetStateForStart();

        console.log("[WebRTC] reserving room =", targetRoomId);

        setRoomId(targetRoomId);
        roomIdRef.current = targetRoomId;

        await reserveRoom(targetRoomId, tokenRef.current);

        setState("connecting");

        const stream = await getLocalMedia();
        const pc = createPeerConnection(stream, targetRoomId);
        await negotiate(pc, targetRoomId);
      } catch (err: any) {
        console.error("[WebRTC] joinAsCoStreamer failed:", err);
        setError(err?.message || "Failed to join stream");
        setState("error");
      }
    },
    [createPeerConnection, getLocalMedia, negotiate, resetStateForStart, stopLive]
  );

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
