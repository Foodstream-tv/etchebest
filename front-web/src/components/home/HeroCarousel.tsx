"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Item = { id: string; src: string; alt?: string };

export default function HeroCarousel({ items }: { items: Item[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const go = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const next = Math.min(Math.max(idx + dir, 0), items.length - 1);
    setIdx(next);
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Track */}
      <div
        ref={ref}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-3xl"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== idx) setIdx(i);
        }}
      >
        {items.map((it) => (
          <div key={it.id} className="min-w-full snap-center">
            <div className="relative h-[360px] w-full overflow-hidden rounded-3xl">
              <Image src={it.src} alt={it.alt ?? ""} fill priority className="object-cover" />
            </div>
          </div>
        ))}
      </div>

      {/* Arrows (desktop) */}
      <button
        aria-label="Précédent"
        onClick={() => go(-1)}
        className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md ring-1 ring-black/5 hover:bg-white md:inline-flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        aria-label="Suivant"
        onClick={() => go(1)}
        className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md ring-1 ring-black/5 hover:bg-white md:inline-flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-4 flex justify-center gap-2">
        {items.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${
              i === idx ? "bg-gray-900" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
