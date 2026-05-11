"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Flame, ArrowRight } from "lucide-react";

import { apiFetch } from "@/lib/api";
import LiveGridCard from "@/components/home/live/LiveGridCard";

type LiveItem = {
  id: number;
  room_id?: string;
  title: string;
  thumbnail_url?: string;
  current_viewers?: number;
  status: string;
  user?: {
    username?: string;
  };
  tags?: {
    name: string;
  }[];
};

type Props = {
  query?: string;
  tag?: string;
};

export default function HomeFeaturedLives({
  query,
  tag,
}: Props) {
  const [lives, setLives] = useState<LiveItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLives = async () => {
      try {
        setLoading(true);

        const params = new URLSearchParams();

        params.set("status", "live");

        if (query?.trim()) {
          params.set("q", query);
        }

        if (tag && tag !== "Tout") {
          params.set("tag", tag);
        }

        const data = await apiFetch<{
        lives: LiveItem[];
        total: number;
        page: number;
        limit: number;
        }>(`/lives?${params.toString()}`);

        setLives(data.lives ?? []);
      } catch (err) {
        console.error(err);
        setLives([]);
      } finally {
        setLoading(false);
      }
    };

    loadLives();
  }, [query, tag]);

  const displayedLives = useMemo(() => {
    return lives.slice(0, 4);
  }, [lives]);

  return (
    <section className="mt-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
            <Flame className="h-3.5 w-3.5" />
            En direct
          </div>

          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Lives tendances
          </h2>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Découvre les lives culinaires du moment.
          </p>
        </div>

        <Link
          href="/watch"
          className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/70 px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm backdrop-blur-md transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
        >
          Voir tout
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[28px] border border-black/8 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="aspect-[16/9] animate-pulse bg-black/5 dark:bg-white/10" />

              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-black/5 dark:bg-white/10" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-black/5 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedLives.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {displayedLives.map((live) => (
            <LiveGridCard
              key={live.id}
              item={{
                id: live.room_id || String(live.id),
                badge: "Live",
                title: live.title,
                author:
                  live.user?.username ||
                  "Foodstream",
                viewers:
                  live.current_viewers || 0,
                isLive: true,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-black/8 bg-white/70 p-8 text-sm text-gray-500 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400">
          Aucun live trouvé.
        </div>
      )}
    </section>
  );
}