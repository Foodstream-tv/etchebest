"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Flame, Radio, Search, Star, Video } from "lucide-react";
import { useSearchParams } from "next/navigation";
import HomeFooter from "@/components/home/HomeFooter";
import { getLives, type LiveDTO } from "@/lib/lives";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import WatchTagSection from "@/components/watch/WatchTagSection";

type TabKey = "all" | "live" | "scheduled" | "ended";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "Tous", icon: <Star className="h-4 w-4" /> },
  { key: "live", label: "En direct", icon: <Flame className="h-4 w-4" /> },
  {
    key: "scheduled",
    label: "Planifiés",
    icon: <CalendarDays className="h-4 w-4" />,
  },
];

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

export default function WatchListPage() {
  const searchParams = useSearchParams();

  const initialQ = searchParams.get("q") ?? "";
  const initialTag = searchParams.get("tag") ?? "Tout";

  const [q, setQ] = useState(initialQ);
  const [tag, setTag] = useState(initialTag);
  const [tab, setTab] = useState<TabKey>("all");

  const [lives, setLives] = useState<LiveDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  const refresh = async (targetPage = page) => {
    try {
      setError(null);
      setLoading(true);

      const res = await getLives({
        q,
        tag,
        status: tab === "all" ? "all" : tab,
        page: targetPage,
        limit,
      });

      setLives((prev) =>
        targetPage === 1 ? res.lives ?? [] : [...prev, ...(res.lives ?? [])]
      );

      setTotal(res.total ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les lives");
      if (targetPage === 1) setLives([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    const t = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tag, tab]);

  const hasLives = lives.length > 0;

  const livesByTag = useMemo(() => {
    const map = new Map<string, LiveDTO[]>();

    lives.forEach((live) => {
      if (!live.tags || live.tags.length === 0) {
        const existing = map.get("Autres") ?? [];
        map.set("Autres", [...existing, live]);
        return;
      }

      live.tags.forEach((tag) => {
        const existing = map.get(tag.name) ?? [];
        map.set(tag.name, [...existing, live]);
      });
    });

    return Array.from(map.entries()).map(([tagName, tagLives]) => ({
      tagName,
      lives: tagLives,
    }));
  }, [lives]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:py-10">
        <div className="space-y-8">
          <section className="overflow-hidden rounded-[34px] border border-black/8 bg-white/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/58 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                  <Radio className="h-4 w-4" aria-hidden="true" />
                  Catalogue Foodstream
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 md:text-4xl">
                  Trouve le live qui te donne faim
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-400 md:text-base">
                  Explore les lives en direct, les lives planifiés par cuisine,
                  plat ou créateur.
                </p>
              </div>
            </div>

            <div className="mt-7 rounded-[28px] border border-black/8 bg-white/75 p-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden="true"
                  />

                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Rechercher un live, un plat..."
                    aria-label="Rechercher un live ou un plat"
                    type="search"
                    className="h-12 w-full rounded-2xl border border-black/8 bg-white pl-11 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30 dark:border-white/10 dark:bg-[#120b05]/80 dark:text-white"
                  />
                </div>

                <div
                  className="flex overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
                  aria-label="Filtrer par statut"
                >
                  {TABS.map((item, index) => {
                    const active = tab === item.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setTab(item.key)}
                        aria-pressed={active}
                        className={[
                          "inline-flex items-center gap-2 px-3 py-2 text-xs font-bold transition",
                          index !== 0
                            ? "border-l border-black/8 dark:border-white/10"
                            : "",
                          active
                            ? "text-white"
                            : "text-gray-600 hover:bg-orange-50 hover:text-orange-700 dark:text-gray-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300",
                        ].join(" ")}
                        style={
                          active ? { background: ORANGE_GRADIENT_CSS } : undefined
                        }
                      >
                        <span aria-hidden="true">{item.icon}</span>
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3 dark:border-white/10"
                aria-label="Filtrer par catégorie"
              >
                {TAGS.map((item) => {
                  const active = tag === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTag(item)}
                      aria-pressed={active}
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

          {!loading && error ? (
            <section
              role="alert"
              className="rounded-[28px] border border-red-200 bg-red-50/80 p-5 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10"
            >
              <h2 className="text-base font-semibold text-red-700 dark:text-red-200">
                Impossible de charger les lives
              </h2>
              <p className="mt-1 text-sm text-red-600 dark:text-red-200/80">
                {error}
              </p>
            </section>
          ) : null}

          {loading ? (
            <section
              role="status"
              aria-live="polite"
              aria-label="Chargement des lives"
              className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
            >
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
          ) : !error && !hasLives ? (
            <section className="rounded-[28px] border border-black/8 bg-white/72 p-10 text-center shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                <Video className="h-8 w-8" aria-hidden="true" />
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                Aucun contenu trouvé
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-600 dark:text-gray-400">
                Essaie une autre recherche, un autre tag ou un autre onglet.
              </p>
            </section>
          ) : (
            <div className="space-y-10">
              {livesByTag.map((section) => (
                <WatchTagSection
                  key={section.tagName}
                  tagName={section.tagName}
                  lives={section.lives}
                />
              ))}
            </div>
          )}

          {lives.length < total ? (
            <div className="flex justify-center pt-6">
              <button
                type="button"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={loading}
                className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(249,115,22,0.25)] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Chargement..." : "Voir plus"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <HomeFooter />
    </div>
  );
}