"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlayCircle, RefreshCw, Search, Video } from "lucide-react";

import HomeFooter from "@/components/home/HomeFooter";
import { getLives, type LiveDTO } from "@/lib/lives";
import WatchTagSection from "@/components/watch/WatchTagSection";
import ReplayCarouselSection from "@/components/watch/ReplayCarouselSection";

const TAGS = [
  "Tout",
  "Asiatique",
  "Africain",
  "Européen",
  "Américain",
  "Français",
  "Italien",
  "Coréen",
  "Japonais",
  "Végétarien",
  "Pâtisserie",
  "Street Food",
  "BBQ",
  "Healthy",
];

export default function ReplaysPage() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("Tout");
  const [replays, setReplays] = useState<LiveDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      setLoading(true);

      const res = await getLives({
        q,
        tag,
        status: "ended",
        page: 1,
        limit: 48,
      });

      setReplays(res.lives ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les replays");
      setReplays([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tag]);

  const replaysByTag = useMemo(() => {
    const map = new Map<string, LiveDTO[]>();

    replays.forEach((replay) => {
      if (!replay.tags || replay.tags.length === 0) {
        const existing = map.get("Autres") ?? [];
        map.set("Autres", [...existing, replay]);
        return;
      }

      replay.tags.forEach((tag) => {
        const existing = map.get(tag.name) ?? [];
        map.set(tag.name, [...existing, replay]);
      });
    });

    return Array.from(map.entries()).map(([tagName, tagReplays]) => ({
      tagName,
      lives: tagReplays,
    }));
  }, [replays]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:py-10">
        <div className="space-y-8">
          <section className="overflow-hidden rounded-[34px] border border-black/8 bg-white/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/58 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                  <PlayCircle className="h-4 w-4" />
                  Replays Foodstream
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 md:text-4xl">
                  Revois les meilleurs lives
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-400 md:text-base">
                  Retrouve les lives terminés, les recettes à revoir et les moments culinaires que tu as manqués.{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {replays.length} replay{replays.length > 1 ? "s" : ""} disponible
                    {replays.length > 1 ? "s" : ""}.
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={refresh}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Actualiser
                </button>

                <Link
                  href="/watch"
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400"
                >
                  <Video className="h-4 w-4" />
                  Voir les lives
                </Link>
              </div>
            </div>

            <div className="mt-7 rounded-[28px] border border-black/8 bg-white/75 p-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher un replay, une recette"
                  className="h-12 w-full rounded-2xl border border-black/8 bg-white pl-11 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30 dark:border-white/10 dark:bg-[#120b05]/80 dark:text-white"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3 dark:border-white/10">
                {TAGS.map((item) => {
                  const active = tag === item;

                  return (
                    <button
                      key={item}
                      onClick={() => setTag(item)}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                        active
                          ? "bg-orange-500 text-white shadow-sm"
                          : "bg-white text-gray-700 ring-1 ring-black/5 hover:bg-orange-50 hover:text-orange-700 dark:bg-white/5 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-orange-500/10 dark:hover:text-orange-300",
                      ].join(" ")}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {!loading && error && (
            <section className="rounded-[28px] border border-red-200 bg-red-50/80 p-5 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10">
              <h2 className="text-base font-semibold text-red-700 dark:text-red-200">
                Impossible de charger les replays
              </h2>
              <p className="mt-1 text-sm text-red-600 dark:text-red-200/80">
                {error}
              </p>
            </section>
          )}

          {loading ? (
            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60"
                >
                  <div className="h-44 animate-pulse bg-black/[0.05] dark:bg-white/10" />
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-24 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                    <div className="h-5 w-3/4 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                  </div>
                </div>
              ))}
            </section>
          ) : !error && replays.length === 0 ? (
            <section className="rounded-[28px] border border-black/8 bg-white/72 p-10 text-center shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                <PlayCircle className="h-8 w-8" />
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                Aucun replay disponible
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-600 dark:text-gray-400">
                Les replays apparaîtront ici quand des lives seront terminés.
              </p>
            </section>
          ) : (
            <div className="space-y-10">
              {replaysByTag.map((section) => (
                <ReplayCarouselSection
                    key={section.tagName}
                    title={section.tagName}
                    replays={section.lives}
                />
                ))}
            </div>
          )}
        </div>
      </div>

      <HomeFooter />
    </main>
  );
}