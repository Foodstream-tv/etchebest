'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function StreamPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const src = '/hls/master.m3u8';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.play().catch(() => {});
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => hls.destroy();
    }
  }, []);

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">FoodStream — Demo HLS</h1>
        <video ref={videoRef} controls playsInline className="w-full rounded-xl shadow" />
        <p className="text-sm text-gray-500 mt-3">
          Si la vidéo ne démarre pas, attends 1–2 s que les segments HLS soient générés.
        </p>
      </div>
    </main>
  );
}
