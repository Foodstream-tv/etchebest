"use client";

import { useEffect, useId, useRef } from "react";

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
  const labelId = useId();

  useEffect(() => {
    if (!ref.current) return;

    ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="overflow-hidden rounded-xl bg-black ring-1 ring-black/10">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        aria-labelledby={label ? labelId : undefined}
        aria-label={!label ? "Flux vidéo en direct" : undefined}
        className="w-full"
      />

      {label && (
        <div id={labelId} className="px-3 py-2 text-xs text-white/80">
          {label}
        </div>
      )}
    </div>
  );
}
