import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  isRecordingConsentRequired,
  createRoom,
  disconnectRoom,
  fetchRenegotiationOffer,
  reserveRoom,
  sendICECandidate,
  sendOffer,
  sendRenegotiationAnswer,
} from "@/services/streaming";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/** Wait before treating a transient WebRTC "disconnected" state as a real drop. */
const DISCONNECT_GRACE_MS = 5000;
/** Backoff delays for automatic re-publish attempts when the media connection drops. */
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000] as const;
/** Fallback poll interval for server renegotiation offers missed while WebSocket was opening. */
const RENEGOTIATION_POLL_MS = 2000;

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
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  startLive: (roomName: string) => Promise<void>;
  hostExistingRoom: (existingRoomId: string) => Promise<void>;
  /**
   * Resolves "consent-required" (and leaves the hook idle) when the live is recorded and the person has
   * not agreed to it yet: the caller asks, then calls again with consentToRecording.
   */
  joinAsCoStreamer: (
    targetRoomId: string,
    opts?: { consentToRecording?: boolean }
  ) => Promise<"joined" | "consent-required">;
  stopLive: () => Promise<void>;
  leaveLive: () => Promise<void>;
  removeRemoteStream: (streamId: string) => void;
}

export function useWebRTC(token?: string): UseWebRTCReturn {
  const [state, setState] = useState<StreamingState>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isStoppingRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  // Bumped each time the socket is closed or replaced, so a ticket that arrives late is dropped.
  const wsGenerationRef = useRef(0);
  const streamTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renegotiationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const renegotiationInFlightRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const reconnectingRef = useRef(false);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const offerPostedRef = useRef(false);
  const drainingIceRef = useRef(false);
  const startReconnectRef = useRef<((targetRoomId: string) => void) | null>(null);

  const tokenRef = useRef<string | undefined>(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const clearGraceTimer = useCallback(() => {
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

  const stopRenegotiationPolling = useCallback(() => {
    if (renegotiationPollRef.current) {
      clearInterval(renegotiationPollRef.current);
      renegotiationPollRef.current = null;
    }
    renegotiationInFlightRef.current = false;
  }, []);

  const clearStreamTimeout = useCallback((streamId: string) => {
    const timeout = streamTimeoutsRef.current.get(streamId);

    if (timeout) {
      clearTimeout(timeout);
      streamTimeoutsRef.current.delete(streamId);
    }
  }, []);

  const removeRemoteStream = useCallback((streamId: string) => {
    setRemoteStreams((prev) => {
      const filtered = prev.filter((stream) => stream.id !== streamId);
      return filtered;
    });
  }, []);

  const addRemoteStream = useCallback((stream: MediaStream) => {
    // Only render remote tiles that carry at least one active video track: an audio-only
    // first renegotiation must not mount a blank video tile that misses the second track.
    const hasLiveVideo = stream
      .getVideoTracks()
      .some((track) => track.readyState !== "ended");
    if (!hasLiveVideo) return;

    setRemoteStreams((prev) => {
      const index = prev.findIndex((existingStream) => existingStream.id === stream.id);
      if (index === -1) {
        return [...prev, stream];
      }
      const updated = [...prev];
      updated[index] = stream;
      return updated;
    });
  }, []);

  const pruneStaleRemoteStreams = useCallback((pc: RTCPeerConnection) => {
    if (typeof pc.getReceivers !== "function") return;
    const activeTrackIds = new Set(
      pc
        .getReceivers()
        .map((r) => r.track)
        .filter((t) => t && t.readyState !== "ended")
        .map((t) => t.id)
    );
    setRemoteStreams((prev) =>
      prev.filter((stream) =>
        stream.getVideoTracks().some((t) => t.readyState !== "ended" && activeTrackIds.has(t.id))
      )
    );
  }, []);

  const attachTrackEndedListener = useCallback(
    (track: MediaStreamTrack, onEnded: () => void) => {
      if (typeof track.addEventListener === "function") {
        track.addEventListener("ended", onEnded);
        return;
      }

      track.onended = onEnded;
    },
    []
  );

  const monitorStreamTimeout = useCallback(
    (stream: MediaStream) => {
      const streamId = stream.id;

      const existingTimeout = streamTimeoutsRef.current.get(streamId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        clearStreamTimeout(streamId);
        // Only remove the stream if its video tracks are still muted or ended after 5s.
        const videoTracks = stream.getVideoTracks();
        const allDeadOrMuted =
          videoTracks.length === 0 ||
          videoTracks.every((t) => t.muted || t.readyState === "ended");
        if (allDeadOrMuted) {
          removeRemoteStream(streamId);
        }
      }, 5000);

      streamTimeoutsRef.current.set(streamId, timeout);
    },
    [clearStreamTimeout, removeRemoteStream]
  );

  const resetStateForStart = useCallback(() => {
    setError(null);
    setRemoteStreams([]);
    hasConnectedRef.current = false;
    reconnectingRef.current = false;
    iceQueueRef.current = [];
    offerPostedRef.current = false;
    drainingIceRef.current = false;
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    clearGraceTimer();
    stopRenegotiationPolling();
    iceQueueRef.current = [];
    offerPostedRef.current = false;
    drainingIceRef.current = false;
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
  }, [clearGraceTimer, stopRenegotiationPolling]);

  const cleanupWebSocket = useCallback(() => {
    wsGenerationRef.current++;
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (err) {
        console.warn("[WebRTC] websocket cleanup failed:", err);
      }

      wsRef.current = null;
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
    setIsAudioMuted(false);
    setIsVideoMuted(false);
  }, []);

  const cleanupLocalState = useCallback(() => {
    cleanupPeerConnection();
    cleanupLocalStream();
    cleanupWebSocket();

    streamTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    streamTimeoutsRef.current.clear();

    hasConnectedRef.current = false;
    reconnectingRef.current = false;
    roomIdRef.current = null;
    setRoomId(null);
    setRemoteStreams([]);
    setError(null);
  }, [cleanupLocalStream, cleanupPeerConnection, cleanupWebSocket]);

  const leaveLive = useCallback(async (): Promise<void> => {
    cleanupLocalState();
    setState("idle");
  }, [cleanupLocalState]);

  const stopLive = useCallback(async (): Promise<void> => {
    if (isStoppingRef.current) return;

    isStoppingRef.current = true;

    const rid = roomIdRef.current;

    cleanupLocalState();
    setState("idle");

    if (rid) {
      try {
        await disconnectRoom(rid);
      } catch (err) {
        console.warn("[WebRTC] disconnect call failed:", err);
      }
    }

    isStoppingRef.current = false;
  }, [cleanupLocalState]);

  const applyRenegotiationOffer = useCallback(
    async (currentRoomId: string, sdp: string) => {
      if (renegotiationInFlightRef.current) return;
      const pc = pcRef.current;
      if (!pc || pc.signalingState === "closed") return;

      renegotiationInFlightRef.current = true;
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription({
            type: "offer",
            sdp,
          })
        );

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const answerSdp = pc.localDescription?.sdp || answer.sdp || "";
        if (answerSdp) {
          await sendRenegotiationAnswer(currentRoomId, answerSdp);
        }
        if (pcRef.current === pc) {
          pruneStaleRemoteStreams(pc);
        }
      } catch (err) {
        console.warn("[WebRTC] renegotiation apply failed:", err);
      } finally {
        renegotiationInFlightRef.current = false;
      }
    },
    [pruneStaleRemoteStreams]
  );

  const pollPendingOffer = useCallback(
    async (currentRoomId: string) => {
      if (
        renegotiationInFlightRef.current ||
        !pcRef.current ||
        roomIdRef.current !== currentRoomId
      ) {
        return;
      }
      try {
        const pending = await fetchRenegotiationOffer(currentRoomId);
        if (pending?.sdp && roomIdRef.current === currentRoomId) {
          await applyRenegotiationOffer(currentRoomId, pending.sdp);
        }
      } catch {
        // Ignore transient poll errors; WebSocket or next poll will pick it up.
      }
    },
    [applyRenegotiationOffer]
  );

  const startRenegotiationPolling = useCallback(
    (currentRoomId: string) => {
      stopRenegotiationPolling();
      renegotiationPollRef.current = setInterval(() => {
        void pollPendingOffer(currentRoomId);
      }, RENEGOTIATION_POLL_MS);
      void pollPendingOffer(currentRoomId);
    },
    [pollPendingOffer, stopRenegotiationPolling]
  );

  const setupWebSocketListener = useCallback(
    async (currentRoomId: string) => {
      const generation = ++wsGenerationRef.current;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // A browser cannot send the session on a WebSocket: trade it for a one-time ticket first.
      let ticket: string;
      try {
        const res = await apiFetch<{ ticket: string }>("/webrtc/ws-ticket", {
          method: "POST",
          token: tokenRef.current,
        });
        ticket = res.ticket;
      } catch (err) {
        console.warn("[WebRTC] could not get a WebSocket ticket:", err);
        return;
      }
      if (generation !== wsGenerationRef.current) return;

      const API_BASE =
        process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8081";

      const WS_BASE = API_BASE.replace(/^http/, "ws").replace(/\/api\/?$/, "");

      const params = new URLSearchParams({
        roomId: currentRoomId,
        ticket,
      });

      const wsUrl = `${WS_BASE}/api/webrtc/offers?${params.toString()}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Pick up any offer generated while the WebSocket ticket / handshake was in flight.
        void pollPendingOffer(currentRoomId);
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "kicked") {
            console.warn("[WebRTC] Kicked from room by host");
            cleanupLocalState();
            setError("Vous avez été retiré de la room par le créateur.");
            setState("disconnected");
            return;
          }

          if (message.type === "offer" && message.offer?.sdp && pcRef.current) {
            await applyRenegotiationOffer(currentRoomId, message.offer.sdp);
          }
        } catch (err) {
          console.error("[WebRTC] WebSocket message handling error:", err);
        }
      };

      ws.onerror = (event) => {
        console.warn("[WebRTC] WebSocket error:", event);
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      };

      wsRef.current = ws;
    },
    [applyRenegotiationOffer, cleanupLocalState, pollPendingOffer]
  );

  const getLocalMedia = useCallback(async (): Promise<MediaStream> => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia indisponible (HTTPS requis hors localhost).");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        facingMode: "user",
        width: 854,
        height: 480,
        frameRate: 24,
      },
    });

    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsAudioMuted(false);
    setIsVideoMuted(false);

    return stream;
  }, []);

  const drainIceQueue = useCallback(async (currentRoomId: string) => {
    if (drainingIceRef.current) return;
    drainingIceRef.current = true;
    try {
      while (iceQueueRef.current.length > 0 && roomIdRef.current === currentRoomId) {
        const candidate = iceQueueRef.current.shift();
        if (!candidate) break;
        try {
          await sendICECandidate(currentRoomId, candidate);
        } catch (err) {
          console.warn("[WebRTC] ICE send failed:", err);
        }
      }
    } finally {
      drainingIceRef.current = false;
    }
  }, []);

  const createPeerConnection = useCallback(
    (stream: MediaStream, currentRoomId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const capabilities = RTCRtpSender.getCapabilities?.("video");
      const codecs = capabilities?.codecs ?? [];

      const preferredH264 = codecs.filter((codec) => {
        const mime = codec.mimeType.toLowerCase();
        return mime === "video/h264";
      });

      if (preferredH264.length > 0) {
        for (const transceiver of pc.getTransceivers()) {
          if (
            transceiver.sender?.track?.kind === "video" &&
            typeof transceiver.setCodecPreferences === "function"
          ) {
            transceiver.setCodecPreferences(preferredH264);
          }
        }
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate || pcRef.current !== pc) return;

        const payload = event.candidate.toJSON();

        if (!payload.candidate?.includes(" udp ")) return;

        iceQueueRef.current.push(payload);
        if (offerPostedRef.current) {
          void drainIceQueue(currentRoomId);
        }
      };

      pc.ontrack = (event) => {
        let incomingStream = event.streams?.[0];
        if (!incomingStream) {
          incomingStream = new MediaStream([event.track]);
        }

        // Ignore loopback of our own local stream
        if (localStreamRef.current && incomingStream.id === localStreamRef.current.id) {
          return;
        }

        const { track } = event;

        if (track.kind === "video") {
          if (track.muted) {
            monitorStreamTimeout(incomingStream);
          } else {
            clearStreamTimeout(incomingStream.id);
          }

          track.onmute = () => {
            monitorStreamTimeout(incomingStream);
          };

          track.onunmute = () => {
            clearStreamTimeout(incomingStream.id);
            addRemoteStream(incomingStream);
          };

          attachTrackEndedListener(track, () => {
            clearStreamTimeout(incomingStream.id);
            removeRemoteStream(incomingStream.id);
          });
        }

        // Notify any mounted <StreamView> listening for track additions on this stream.
        try {
          incomingStream.dispatchEvent(new Event("addtrack"));
        } catch {}

        addRemoteStream(incomingStream);
      };

      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc || isStoppingRef.current) return;

        if (pc.connectionState === "connected") {
          hasConnectedRef.current = true;
          clearGraceTimer();
          setError(null);
          setState("live");
          return;
        }

        if (reconnectingRef.current) return;

        if (pc.connectionState === "disconnected") {
          // Transient in WebRTC (short Wi-Fi blip): give ICE 5s to recover before reconnecting.
          clearGraceTimer();
          graceTimerRef.current = setTimeout(() => {
            graceTimerRef.current = null;
            if (pcRef.current !== pc || isStoppingRef.current) return;
            if (pc.connectionState === "connected") return;
            if (hasConnectedRef.current && startReconnectRef.current) {
              startReconnectRef.current(currentRoomId);
            } else {
              cleanupLocalState();
              setError(
                "La connexion vidéo WebRTC (UDP) a échoué. Vérifiez que votre VPN, pare-feu ou réseau ne bloque pas le WebRTC, puis réessayez."
              );
              setState("error");
            }
          }, DISCONNECT_GRACE_MS);
          return;
        }

        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          clearGraceTimer();
          if (hasConnectedRef.current && startReconnectRef.current) {
            startReconnectRef.current(currentRoomId);
          } else {
            cleanupLocalState();
            setError(
              "La connexion vidéo WebRTC (UDP) a échoué au bout de 30s. Vérifiez que votre VPN, pare-feu ou réseau ne bloque pas le WebRTC, puis réessayez."
            );
            setState("error");
          }
        }
      };

      pcRef.current = pc;

      return pc;
    },
    [
      addRemoteStream,
      attachTrackEndedListener,
      cleanupLocalState,
      clearGraceTimer,
      clearStreamTimeout,
      drainIceQueue,
      monitorStreamTimeout,
      removeRemoteStream,
    ]
  );

  const negotiate = useCallback(
    async (pc: RTCPeerConnection, currentRoomId: string): Promise<void> => {
      offerPostedRef.current = false;

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);

      const { sdp: answerSdp } = await sendOffer(currentRoomId, offer.sdp || "");

      offerPostedRef.current = true;
      void drainIceQueue(currentRoomId);

      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: "answer",
          sdp: answerSdp,
        })
      );
    },
    [drainIceQueue]
  );

  const startReconnect = useCallback(
    (currentRoomId: string) => {
      if (
        reconnectingRef.current ||
        isStoppingRef.current ||
        roomIdRef.current !== currentRoomId
      ) {
        return;
      }
      const stream = localStreamRef.current;
      if (!stream) {
        cleanupLocalState();
        setState("disconnected");
        return;
      }

      reconnectingRef.current = true;
      clearGraceTimer();

      const run = async () => {
        for (const delay of RECONNECT_BACKOFF_MS) {
          await new Promise<void>((r) => setTimeout(r, delay));
          if (
            isStoppingRef.current ||
            roomIdRef.current !== currentRoomId ||
            !localStreamRef.current
          ) {
            return;
          }

          cleanupPeerConnection();
          setRemoteStreams([]);

          try {
            const pc = createPeerConnection(localStreamRef.current, currentRoomId);
            await negotiate(pc, currentRoomId);
            if (pc.connectionState === "failed" || pc.connectionState === "closed") {
              throw new Error("Peer connection failed during reconnect");
            }
            startRenegotiationPolling(currentRoomId);
            void setupWebSocketListener(currentRoomId);
            reconnectingRef.current = false;
            return;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            // 404 / 410 / 403 means the room ended on the backend (e.g. host ended the live).
            if (/\((403|404|410)\)/.test(msg)) {
              cleanupLocalState();
              setState("disconnected");
              return;
            }
            console.warn("[WebRTC] reconnect attempt failed:", err);
          }
        }

        cleanupLocalState();
        setError(
          "La connexion au live a été perdue et n'a pas pu être rétablie. Vérifiez votre réseau ou relancez."
        );
        setState("error");
      };

      void run();
    },
    [
      cleanupLocalState,
      cleanupPeerConnection,
      clearGraceTimer,
      createPeerConnection,
      negotiate,
      setupWebSocketListener,
      startRenegotiationPolling,
    ]
  );

  useEffect(() => {
    startReconnectRef.current = startReconnect;
  }, [startReconnect]);

  const startLive = useCallback(
    async (roomName: string): Promise<void> => {
      try {
        await leaveLive();

        setState("creating");
        resetStateForStart();

        const { roomId: newRoomId } = await createRoom(roomName);

        setRoomId(newRoomId);
        roomIdRef.current = newRoomId;

        setState("connecting");

        const stream = await getLocalMedia();
        const pc = createPeerConnection(stream, newRoomId);

        await negotiate(pc, newRoomId);
        startRenegotiationPolling(newRoomId);
        void setupWebSocketListener(newRoomId);
      } catch (err) {
        setError((err instanceof Error && err.message) || "Failed to start live");
        setState("error");
      }
    },
    [
      createPeerConnection,
      getLocalMedia,
      leaveLive,
      negotiate,
      resetStateForStart,
      setupWebSocketListener,
      startRenegotiationPolling,
    ]
  );

  const hostExistingRoom = useCallback(
    async (existingRoomId: string): Promise<void> => {
      try {
        await leaveLive();

        setState("connecting");
        resetStateForStart();

        setRoomId(existingRoomId);
        roomIdRef.current = existingRoomId;

        const stream = await getLocalMedia();
        const pc = createPeerConnection(stream, existingRoomId);

        await negotiate(pc, existingRoomId);
        startRenegotiationPolling(existingRoomId);
        void setupWebSocketListener(existingRoomId);
      } catch (err) {
        setError((err instanceof Error && err.message) || "Failed to host stream");
        setState("error");
      }
    },
    [
      createPeerConnection,
      getLocalMedia,
      leaveLive,
      negotiate,
      resetStateForStart,
      setupWebSocketListener,
      startRenegotiationPolling,
    ]
  );

  const joinAsCoStreamer = useCallback(
    async (
      targetRoomId: string,
      opts: { consentToRecording?: boolean } = {}
    ): Promise<"joined" | "consent-required"> => {
      try {
        await leaveLive();

        setState("creating");
        resetStateForStart();

        setRoomId(targetRoomId);
        roomIdRef.current = targetRoomId;

        try {
          await reserveRoom(targetRoomId, tokenRef.current, opts);
        } catch (err) {
          if (isRecordingConsentRequired(err)) {
            setRoomId(null);
            roomIdRef.current = null;
            setState("idle");
            return "consent-required";
          }
          throw err;
        }

        setState("connecting");

        const stream = await getLocalMedia();
        const pc = createPeerConnection(stream, targetRoomId);

        await negotiate(pc, targetRoomId);
        startRenegotiationPolling(targetRoomId);
        void setupWebSocketListener(targetRoomId);
        return "joined";
      } catch (err) {
        setError((err instanceof Error && err.message) || "Failed to join stream");
        setState("error");
        return "joined";
      }
    },
    [
      createPeerConnection,
      getLocalMedia,
      leaveLive,
      negotiate,
      resetStateForStart,
      setupWebSocketListener,
      startRenegotiationPolling,
    ]
  );

  useEffect(() => {
    return () => {
      cleanupPeerConnection();
      cleanupLocalStream();
      cleanupWebSocket();
    };
  }, [cleanupLocalStream, cleanupPeerConnection, cleanupWebSocket]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextEnabled = !audioTracks[0].enabled;
        audioTracks.forEach((track) => {
          track.enabled = nextEnabled;
        });
        setIsAudioMuted(!nextEnabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextEnabled = !videoTracks[0].enabled;
        videoTracks.forEach((track) => {
          track.enabled = nextEnabled;
        });
        setIsVideoMuted(!nextEnabled);
      }
    }
  }, []);

  return {
    state,
    roomId,
    localStream,
    remoteStreams,
    error,
    isAudioMuted,
    isVideoMuted,
    toggleAudio,
    toggleVideo,
    startLive,
    hostExistingRoom,
    joinAsCoStreamer,
    stopLive,
    leaveLive,
    removeRemoteStream,
  };
}
