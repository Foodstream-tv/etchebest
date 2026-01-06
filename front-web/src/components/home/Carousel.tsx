"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Item = { id: string; src: string; alt?: string };

export default function Carousel({ items }: { items: Item[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  // sync index on scroll
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setIdx(i);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="w-full">
      <div
        ref={ref}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl"
        style={{ scrollBehavior: "smooth" }}
      >
        {items.map((it) => (
          <div key={it.id} className="min-w-full snap-center px-1">
            <div className="relative h-40 w-full overflow-hidden rounded-2xl">
              <Image src={it.src} alt={it.alt ?? ""} fill className="object-cover" />
            </div>
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="mt-2 flex items-center justify-center gap-2">
        {items.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full transition ${
              i === idx ? "bg-gray-800" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
