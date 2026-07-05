"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Eye,
  Flame,
  PlayCircle,
  Radio,
  Star,
  Users,
} from "lucide-react";

import FeaturedCreatorRow from "@/components/home/live/FeaturedCreatorRow";
import LiveGridCard from "@/components/home/live/LiveGridCard";
import UpcomingCard from "@/components/home/live/UpcomingCard";
import { getLives, type LiveDTO } from "@/lib/lives";
import { useAuth } from "@/lib/useAuth";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";

type TabKey = "live" | "popular" | "replays" | "planned";

type HomeLiveGridProps = Readonly<{
  query?: string;
  tag?: string;
}>;

type CardItem = {
  id: string;
  badge: string;
  title: string;
  author: string;
  viewers?: number;
  when?: string;
  isLive?: boolean;
  imageUrl?: string;
};

type TabItem = {
  key: TabKey;
  label: string;
  icon: ReactNode;
};

const TABS: TabItem[] = [
  {
    key: "live",
    label: "En direct",
    icon: <Flame className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: "popular",
    label: "Populaires",
    icon: <Star className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: "replays",
    label: "Replays",
    icon: <PlayCircle className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: "planned",
    label: "Planifiés",
    icon: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
  },
];

const UPCOMING = [
  {
    id: "u1",
    title: "Macarons Framboise & Rose",
    when: "Aujourd’hui, 19:00",
    author: "Camille Dupont",
  },
  {
    id: "u2",
    title: "Mezzés Libanais express",
    when: "Demain, 12:30",
    author: "Nour Haddad",
  },
  {
    id: "u3",
    title: "Granola Healthy maison",
    when: "Ven., 10:00",
    author: "Chloé Martin",
  },
];

const CREATORS = [
  { id: "c1", name: "Aiko Tanaka", tag: "Ramen" },
  { id: "c2", name: "Camille Dupont", tag: "Pâtisserie" },
  { id: "c3", name: "Luis Ortega", tag: "Street Food" },
];

function liveToCardItem(live: LiveDTO): CardItem {
  return {
    id: live.room_id || String(live.id),
    badge:
      live.status === "live"
        ? "Live"
        : live.status === "scheduled"
          ? "Planifié"
          : "Replay",
    title: live.title || "Live sans titre",
    author: live.user?.username || "Chef FoodStream",
    viewers: live.current_viewers ?? 0,
    isLive: live.status === "live",
    imageUrl: live.thumbnail_url,
  };
}

export default function HomeLiveGrid({
  query = "",
  tag = "Tout",
}: HomeLiveGridProps) {
  const [tab, setTab] = useState<TabKey>("live");
  const [lives, setLives] = useState<LiveDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const { token } = useAuth();

  const status = useMemo<"all" | "scheduled" | "live" | "ended">(() => {
    if (tab === "live") return "live";
    if (tab === "planned") return "scheduled";
    if (tab === "replays") return "ended";
    return "all";
  }, [tab]);

  useEffect(() => {
    let mounted = true;

    async function loadLives() {
      try {
        setLoading(true);

        const res = await getLives(
          {
            q: query,
            tag,
            status,
          },
          token ?? undefined
        );

        if (!mounted) return;

        setLives(Array.isArray(res.lives) ? res.lives : []);
      } catch (error) {
        console.error("Impossible de charger les lives :", error);

        if (mounted) {
          setLives([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadLives();

    const timer = window.setInterval(loadLives, 10_000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [query, tag, status, token]);

  const liveItems = useMemo<CardItem[]>(() => {
    return lives.map(liveToCardItem);
  }, [lives]);

  const items = useMemo(() => {
    if (tab === "popular") {
      return [...liveItems].sort(
        (a, b) => (b.viewers ?? 0) - (a.viewers ?? 0)
      );
    }

    return liveItems;
  }, [tab, liveItems]);

  const stats = useMemo(() => {
    const totalViewers = lives.reduce(
      (sum, live) => sum + (live.current_viewers ?? 0),
      0
    );

    const liveCount = lives.filter((live) => live.status === "live").length;

    const uniqueCreators = new Set(
      lives.map((live) => live.user?.id).filter(Boolean)
    ).size;

    return {
      totalViewers,
      liveCount,
      uniqueCreators,
    };
  }, [lives]);

  return (
    <section
      className="pb-14 pt-8"
      aria-labelledby="home-live-grid-title"
      aria-busy={loading}
    >
      <h2 id="home-live-grid-title" className="sr-only">
        Lives FoodStream
      </h2>

      <div className="rounded-[28px] border border-black/8 bg-white/72 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Filtres des lives"
        >
          {TABS.map((tabItem) => {
            const active = tabItem.key === tab;

            return (
              <button
                key={tabItem.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tabItem.key)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "text-white"
                    : "text-gray-600 hover:bg-black/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.06]"
                }`}
                style={active ? { background: ORANGE_GRADIENT_CSS } : undefined}
              >
                {tabItem.icon}
                {tabItem.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {loading ? (
            <div
              role="status"
              aria-label="Chargement des lives"
              className="grid grid-cols-1 gap-6 sm:grid-cols-2"
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60"
                >
                  <div className="aspect-[16/9] w-full animate-pulse bg-black/[0.06] dark:bg-white/10" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <>
              <div
                className="grid gap-3 sm:grid-cols-3"
                aria-label="Statistiques des lives"
              >
                <article
                  aria-label={`Lives actifs : ${stats.liveCount}`}
                  className="rounded-2xl border border-black/8 bg-white/72 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60"
                >
                  <div
                    className="mb-2 inline-flex rounded-xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200"
                    aria-hidden="true"
                  >
                    <Radio className="h-4 w-4" />
                  </div>

                  <p className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                    {stats.liveCount}
                  </p>

                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Lives actifs
                  </p>
                </article>

                <article
                  aria-label={`Spectateurs : ${stats.totalViewers}`}
                  className="rounded-2xl border border-black/8 bg-white/72 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60"
                >
                  <div
                    className="mb-2 inline-flex rounded-xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200"
                    aria-hidden="true"
                  >
                    <Eye className="h-4 w-4" />
                  </div>

                  <p className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                    {stats.totalViewers}
                  </p>

                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Spectateurs
                  </p>
                </article>

                <article
                  aria-label={`Créateurs : ${stats.uniqueCreators}`}
                  className="rounded-2xl border border-black/8 bg-white/72 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60"
                >
                  <div
                    className="mb-2 inline-flex rounded-xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200"
                    aria-hidden="true"
                  >
                    <Users className="h-4 w-4" />
                  </div>

                  <p className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                    {stats.uniqueCreators}
                  </p>

                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Créateurs
                  </p>
                </article>
              </div>

              <div
                role="tabpanel"
                className="grid grid-cols-1 gap-6 sm:grid-cols-2"
              >
                {items.map((item) => (
                  <LiveGridCard key={item.id} item={item} />
                ))}
              </div>
            </>
          ) : (
            <p
              role="status"
              className="rounded-[28px] border border-black/8 bg-white/72 p-6 text-sm text-gray-600 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:text-gray-300"
            >
              Aucun contenu trouvé pour ces filtres.
            </p>
          )}
        </div>

        <aside className="space-y-6" aria-label="Informations complémentaires">
          <section
            aria-labelledby="upcoming-lives-title"
            className="rounded-[28px] border border-black/8 bg-white/72 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
          >
            <h3
              id="upcoming-lives-title"
              className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50"
            >
              À venir
            </h3>

            <div className="space-y-3">
              {UPCOMING.map((item) => (
                <UpcomingCard
                  key={item.id}
                  title={item.title}
                  when={item.when}
                  author={item.author}
                />
              ))}
            </div>
          </section>

          <section
            aria-labelledby="featured-creators-title"
            className="rounded-[28px] border border-black/8 bg-white/72 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3
                id="featured-creators-title"
                className="text-sm font-semibold text-gray-900 dark:text-gray-50"
              >
                Créateurs mis en avant
              </h3>

              <span
                aria-hidden="true"
                className="rounded-full bg-black/[0.04] px-2 py-1 text-[11px] text-gray-600 dark:bg-white/[0.05] dark:text-gray-300"
              >
                Top 10
              </span>
            </div>

            <div className="space-y-3">
              {CREATORS.map((creator) => (
                <FeaturedCreatorRow
                  key={creator.id}
                  name={creator.name}
                  tag={creator.tag}
                />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}