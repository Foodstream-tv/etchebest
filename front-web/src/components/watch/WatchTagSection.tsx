"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  PlayCircle,
  Radio,
  Users,
} from "lucide-react";

import type { LiveDTO } from "@/lib/lives";

type Props = {
  tagName: string;
  lives: LiveDTO[];
  mode?: "live" | "replay";
};

export default function WatchTagSection({
  tagName,
  lives,
  mode = "live",
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const displayedLives = useMemo(() => {
    return Array.isArray(lives) ? lives : [];
  }, [lives]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollBy({
      left: direction === "left" ? -900 : 900,
      behavior: "smooth",
    });
  };

  if (displayedLives.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4" aria-labelledby={`tag-${tagName}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2
            id={`tag-${tagName}`}
            className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50"
          >
            {tagName}
          </h2>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {displayedLives.length} contenu
            {displayedLives.length > 1 ? "s" : ""}
          </p>
        </div>

        {displayedLives.length > 3 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label={`Faire défiler la section ${tagName} vers la gauche`}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-black/8 bg-white/80 text-gray-900 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label={`Faire défiler la section ${tagName} vers la droite`}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-black/8 bg-white/80 text-gray-900 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto pb-2 scrollbar-hide"
      >
        {displayedLives.map((live) => {
          const rid = encodeURIComponent(live.room_id || String(live.id));

          const thumbnail = live.thumbnail_url || "/images/live-fallback.png";

          return (
            <article
              key={live.id}
              className="group min-w-[430px] max-w-[430px] overflow-hidden rounded-[30px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#120b05]/60 dark:hover:shadow-[0_22px_50px_rgba(0,0,0,0.45)]"
            >
              <div className="relative h-56 overflow-hidden bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnail}
                  alt={`Miniature du live ${live.title}`}
                  className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105"
                />

                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
                  aria-hidden="true"
                />

                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold shadow-sm",
                      live.status === "live"
                        ? "bg-red-500 text-white"
                        : live.status === "scheduled"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-900 text-white dark:bg-white dark:text-neutral-900",
                    ].join(" ")}
                  >
                    {live.status === "live" ? (
                      <span
                        className="h-2 w-2 animate-pulse rounded-full bg-white"
                        aria-hidden="true"
                      />
                    ) : live.status === "ended" ? (
                      <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                    )}

                    {live.status === "live"
                      ? "EN DIRECT"
                      : live.status === "scheduled"
                      ? "PLANIFIÉ"
                      : "REPLAY"}
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="line-clamp-2 text-xl font-bold tracking-tight text-white">
                    {live.title}
                  </h3>

                  <p className="mt-1 text-sm text-white/75">
                    {live.user?.username
                      ? `par ${live.user.username}`
                      : "Chef Foodstream"}
                  </p>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex flex-wrap gap-2" aria-label="Tags du live">
                  {live.tags?.slice(0, 3).map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-black/[0.03] px-3 py-2 text-sm text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                    <Eye className="mb-1 h-4 w-4" aria-hidden="true" />
                    {live.current_viewers ?? 0} spectateurs
                  </div>

                  <div className="rounded-2xl bg-black/[0.03] px-3 py-2 text-sm text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                    <Users className="mb-1 h-4 w-4" aria-hidden="true" />
                    Créateur
                  </div>
                </div>

                {mode === "replay" ? (
                  <Link
                    href={`/replays/${rid}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                  >
                    Replay
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href={`/watch/${rid}`}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      Regarder
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>

                    {live.status === "live" ? (
                      <Link
                        href={`/broadcast/${rid}?mode=join`}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/15"
                      >
                        Rejoindre
                      </Link>
                    ) : (
                      <div className="inline-flex items-center justify-center rounded-2xl border border-black/8 bg-black/[0.04] px-4 py-3 text-sm font-semibold text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/35">
                        Hors ligne
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}