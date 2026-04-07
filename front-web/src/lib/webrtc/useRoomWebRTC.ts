"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type CreateRoomRes = { roomId: string };
type SdpAnswerRes = { sdp: string };

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useRoomWebRTC(token: string | null) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [status, setStatus] = useState<
    "idle" | "creating" | "joining" | "connected" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const createRoom = useCallback(async () => {
    if (!token) throw new Error("Missing token");

    setStatus("creating");
    setError(null);

    const data = await apiFetch<CreateRoomRes>("/rooms", {
      method: "POST",
      body: JSON.stringify({}),
      headers: authHeaders,
    });

    setRoomId(data.roomId);
    setStatus("idle");
    return data.roomId;
  }, [token, authHeaders]);

  const joinAsParticipant = useCallback(
    async (id: string) => {
      if (!token) throw new Error("Missing token");

      setStatus("joining");
      setError(null);

      await apiFetch(`/rooms/${id}/reserve`, {
        method: "POST",
        body: JSON.stringify({}),
        headers: authHeaders,
      });

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.ontrack = (ev) => {
        const stream = ev.streams?.[0];
        if (!stream) return;
        setRemoteStreams((prev) => {
          if (prev.some((s) => s.id === stream.id)) return prev;
          return [...prev, stream];
        });
      };

      pc.onicecandidate = async (ev) => {
        if (!ev.candidate) return;
        try {
          await apiFetch(`/ice?roomId=${encodeURIComponent(id)}`, {
            method: "POST",
            body: JSON.stringify({
              candidate: ev.candidate.toJSON?.() ?? ev.candidate,
            }),
            headers: authHeaders,
          });
        } catch {}
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);

      const answer = await apiFetch<SdpAnswerRes>(
        `/webrtc?roomId=${encodeURIComponent(id)}`,
        {
          method: "POST",
          body: JSON.stringify({ type: "offer", sdp: offer.sdp || "" }),
          headers: authHeaders,
        }
      );

      await pc.setRemoteDescription({
        type: "answer",
        sdp: answer.sdp,
      });

      setRoomId(id);
      setStatus("connected");
    },
    [token, authHeaders]
  );

  const disconnect = useCallback(async () => {
    const id = roomId;

    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {}

    pcRef.current = null;

    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}

    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams([]);

    if (token && id && status === "connected") {
      try {
        await apiFetch(`/rooms/${id}/disconnect`, {
          method: "POST",
          body: JSON.stringify({}),
          headers: authHeaders,
        });
      } catch {}
    }

    setRoomId(null);
    setStatus("idle");
  }, [roomId, token, authHeaders, status]);

  useEffect(() => {
    return () => {
      try {
        pcRef.current?.getSenders().forEach((s) => s.track?.stop());
        pcRef.current?.close();
      } catch {}

      try {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  return useMemo(
    () => ({
      roomId,
      status,
      error,
      localStream,
      remoteStreams,
      createRoom,
      joinAsParticipant,
      disconnect,
    }),
    [
      roomId,
      status,
      error,
      localStream,
      remoteStreams,
      createRoom,
      joinAsParticipant,
      disconnect,
    ]
  );
}