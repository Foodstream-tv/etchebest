"use client";

import { useEffect, useRef } from "react";

export default function StreamView({ stream, muted }: { stream: MediaStream | null; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={!!muted}
      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12, background: "#000" }}
    />
  );
}
