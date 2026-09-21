"use client";

import { useEffect, useRef } from "react";

export default function StreamView({ stream, muted }: Readonly<{ stream: MediaStream | null; muted?: boolean }>) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    video.srcObject = stream;

    const playVideo = () => {
      if (video && video.paused) {
        video.play().catch(() => {
          // Autoplay may be deferred until user gesture if unmuted
        });
      }
    };

    if (stream) {
      playVideo();

      const handleTrackChange = () => {
        if (ref.current) {
          ref.current.srcObject = stream;
          playVideo();
        }
      };

      stream.addEventListener("addtrack", handleTrackChange);
      stream.addEventListener("removetrack", handleTrackChange);

      return () => {
        stream.removeEventListener("addtrack", handleTrackChange);
        stream.removeEventListener("removetrack", handleTrackChange);
      };
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={!!muted}
      onLoadedMetadata={() => {
        if (ref.current?.paused) {
          ref.current.play().catch(() => {});
        }
      }}
      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12, background: "#000" }}
    >
      <track kind="captions" />
    </video>
  );
}
