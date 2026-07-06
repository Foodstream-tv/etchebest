"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Eye, VideoOff } from "lucide-react";

import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import { getLives, type LiveDTO } from "@/lib/lives";

export default function LiveMomentCard() {
  const [live, setLive] = useState<LiveDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkLive() {
      try {
        const res = await getLives({ status: "live", limit: 1 });
        if (mounted) {
          if (res.lives && res.lives.length > 0) {
            setLive(res.lives[0]);
          } else {
            setLive(null);
          }
        }
      } catch (err) {
        console.error("Failed to check active live for hero banner:", err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkLive();

    const interval = setInterval(checkLive, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <article className="rounded-[28px] border border-black/8 bg-white/72 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)] animate-pulse">
        <div className="h-6 w-28 bg-black/10 dark:bg-white/10 rounded-full mb-3" />
        <div className="h-52 bg-black/10 dark:bg-white/10 rounded-2xl mb-4" />
        <div className="space-y-2">
          <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded" />
          <div className="h-3 w-1/2 bg-black/10 dark:bg-white/10 rounded" />
        </div>
      </article>
    );
  }

  if (!live) {
    return (
      <article className="rounded-[28px] border border-black/8 bg-white/72 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)] flex flex-col items-center justify-center text-center h-full min-h-[320px]">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
          <VideoOff className="h-8 w-8" aria-hidden="true" />
        </div>

        <h3 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Aucun live en cours
        </h3>

        <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400 max-w-[200px]">
          Il n'y a pas de diffusion en direct pour le moment. Lancez-en une depuis le studio !
        </p>

        <Link
          href="/studio"
          className="mt-5 rounded-2xl px-5 py-2.5 text-xs font-bold text-white transition hover:scale-[1.01] active:scale-[0.98]"
          style={{ background: ORANGE_GRADIENT_CSS }}
        >
          Accéder au studio
        </Link>
      </article>
    );
  }

  const targetUrl = `/watch/${encodeURIComponent(live.room_id || String(live.id))}`;
  const thumbnail = live.thumbnail_url || "/images/live-fallback.png";

  return (
    <article className="rounded-[28px] border border-black/8 bg-white/72 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-50">
        <Flame
          className="h-4 w-4 text-orange-500"
          aria-hidden="true"
        />
        Live du moment
      </h2>

      <div className="overflow-hidden rounded-2xl border border-black/8 dark:border-white/10">
        <div className="relative h-52 bg-black/[0.06] dark:bg-white/10 overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={live.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}

          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-white z-10"
            style={{ background: ORANGE_GRADIENT_CSS }}
          >
            LIVE
          </span>

          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white z-10">
            <Eye
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />
            {live.current_viewers ?? 0}
          </span>
        </div>

        <div className="p-4 bg-white/40 dark:bg-black/20 backdrop-blur-sm">
          <h3 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-50 truncate">
            {live.title}
          </h3>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            par {live.user?.username || "Foodstream"}
          </p>

          <Link
            href={targetUrl}
            aria-label={`Rejoindre le live ${live.title} par ${live.user?.username || "Foodstream"}`}
            className="mt-4 block w-full rounded-2xl py-3 text-center text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400 active:scale-[0.98]"
            style={{ background: ORANGE_GRADIENT_CSS }}
          >
            Rejoindre
          </Link>
        </div>
      </div>
    </article>
  );
}