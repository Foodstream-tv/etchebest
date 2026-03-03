"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getHLSUrl } from "@/services/streaming";

type PlayerMode = "native" | "hlsjs" | "unsupported";

export default function WatchRoomPage() {
  const routeParams = useParams<{ roomId: string }>();
  const roomId = routeParams?.roomId;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [playerMode, setPlayerMode] = useState<PlayerMode>("hlsjs");

  const hlsUrl = useMemo(() => (roomId ? getHLSUrl(roomId) : ""), [roomId]);

  useEffect(() => {
    if (!roomId || !hlsUrl) return;

    let alive = true;
    let t: any;

    async function probe() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(hlsUrl, { method: "GET", cache: "no-store" });
        if (!alive) return;

        if (res.ok) {
          setLoading(false);
          return;
        }

        t = setTimeout(probe, 1000);
      } catch {
        if (!alive) return;
        t = setTimeout(probe, 1000);
      }
    }

    probe();

    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [roomId, hlsUrl, reloadKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!roomId || !hlsUrl || !video) return;

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    setError(null);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      setPlayerMode("native");
      video.src = hlsUrl;
      video.play().catch(() => {});
      return;
    }

    if (Hls.isSupported()) {
      setPlayerMode("hlsjs");

      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
      });

      hlsRef.current = hls;

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data?.fatal) {
          setError("Impossible de lire le stream HLS (fatal).");
          try {
            hls.destroy();
          } catch {}
          hlsRef.current = null;
        }
      });

      return () => {
        try {
          hls.destroy();
        } catch {}
        hlsRef.current = null;
      };
    }

    setPlayerMode("unsupported");
    setError("HLS non supporté sur ce navigateur.");
  }, [roomId, hlsUrl, reloadKey]);

  const onRetry = () => {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link href="/watch">← Retour</Link>
        <div style={{ fontWeight: 800 }}>
          LIVE • {roomId ? `${roomId.slice(0, 8)}…` : "—"}
        </div>

        <button onClick={onRetry} style={{ marginLeft: "auto" }}>
          Réessayer
        </button>
      </div>

      <div style={{ borderRadius: 12, overflow: "hidden", background: "#111", position: "relative" }}>
        <video
          key={`${roomId ?? "no-room"}-${reloadKey}`}
          ref={videoRef}
          controls
          playsInline
          style={{ width: "100%", height: 520, background: "#000" }}
        />

        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(0,0,0,0.35)",
              color: "white",
              fontWeight: 700,
            }}
          >
            Préparation du stream…
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: "tomato" }}>
          {error}{" "}
          <button onClick={onRetry} style={{ marginLeft: 8 }}>
            Réessayer
          </button>
        </div>
      )}

      <div style={{ opacity: 0.6, fontSize: 12 }}>
        Mode: {playerMode} • HLS: {hlsUrl || "—"}
      </div>
    </div>
  );
}
