"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function WatchPage({ params }: { params: { roomId: string } }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const roomId = params.roomId;
  const src = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/hls/${roomId}/index.m3u8`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().catch(() => {});
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => hls.destroy();
    }
  }, [src]);

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">FoodStream — Live</h1>
        <p className="text-sm text-gray-500 mb-4">
          Room: <span className="font-mono">{roomId}</span>
        </p>

        <video
          ref={videoRef}
          controls
          playsInline
          className="w-full rounded-xl shadow bg-black"
        />

        <p className="text-sm text-gray-500 mt-3">
          Si la vidéo ne démarre pas, attends 1–2 s que FFmpeg génère les segments.
        </p>

        <p className="text-xs text-gray-400 mt-2 break-all">
          {src}
        </p>
      </div>
    </main>
  );
}
