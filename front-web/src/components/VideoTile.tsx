"use client";

import { useEffect, useRef } from "react";

export function VideoTile({
  stream,
  muted,
  label,
}: Readonly<{
  stream: MediaStream | null;
  muted?: boolean;
  label?: string;
}>) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="overflow-hidden rounded-xl bg-black ring-1 ring-black/10">
      <video ref={ref} autoPlay playsInline muted={muted} className="w-full">
        <track kind="captions" />
      </video>
      {label ? (
        <div className="px-3 py-2 text-xs text-white/80">{label}</div>
      ) : null}
    </div>
  );
}
