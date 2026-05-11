"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Flame,
  PlayCircle,
  Star,
  Radio,
  Eye,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { getLives, type LiveDTO } from "@/lib/lives";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import LiveGridCard from "@/components/home/live/LiveGridCard";
import UpcomingCard from "@/components/home/live/UpcomingCard";
import FeaturedCreatorRow from "@/components/home/live/FeaturedCreatorRow";

type TabKey = "live" | "popular" | "replays" | "planned";

type HomeLiveGridProps = {
  query?: string;
  tag?: string;
};

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

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "live", label: "En direct", icon: <Flame className="h-4 w-4" /> },
  { key: "popular", label: "Populaires", icon: <Star className="h-4 w-4" /> },
  { key: "replays", label: "Replays", icon: <PlayCircle className="h-4 w-4" /> },
  { key: "planned", label: "Planifiés", icon: <CalendarDays className="h-4 w-4" /> },
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
    badge: live.status === "live" ? "Live" : live.status === "scheduled" ? "Planifié" : "Replay",
    title: live.title || "Live sans titre",
    author: live.user?.username || "Chef FoodStream",
    viewers: live.current_viewers ?? 0,
    isLive: live.status === "live",
    imageUrl: live.thumbnail_url,
  };
}

export default function HomeLiveGrid({ query = "", tag = "Tout" }: HomeLiveGridProps) {
  const [tab, setTab] = useState<TabKey>("live");
  const [lives, setLives] = useState<LiveDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const { token } = useAuth();

  const status = useMemo(() => {
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
            status: status as "all" | "scheduled" | "live",
          },
          token ?? undefined
        );

        if (!mounted) return;
        setLives(res.lives ?? []);
      } catch (error) {
        console.error("Impossible de charger les lives :", error);
        if (mounted) setLives([]);
      } finally {
        if (mounted) setLoading(false);
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
    switch (tab) {
      case "popular":
        return [...liveItems].sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0));
      default:
        return liveItems;
    }
  }, [tab, liveItems]);

  const totalViewers = lives.reduce((sum, live) => sum + (live.current_viewers ?? 0), 0);
  const liveCount = lives.filter((live) => live.status === "live").length;
  const uniqueCreators = new Set(lives.map((live) => live.user?.id).filter(Boolean)).size;

  return (
    <section className="pb-14 pt-8">
      <div className="rounded-[28px] border border-black/8 bg-white/72 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((tabItem) => {
            const active = tabItem.key === tab;

            return (
              <button
                key={tabItem.key}
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-black/8 bg-white/72 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
                  <div className="mb-2 inline-flex rounded-xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                    <Radio className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                    {liveCount}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Lives actifs
                  </div>
                </div>

                <div className="rounded-2xl border border-black/8 bg-white/72 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
                  <div className="mb-2 inline-flex rounded-xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                    <Eye className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                    {totalViewers}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Spectateurs
                  </div>
                </div>

                <div className="rounded-2xl border border-black/8 bg-white/72 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
                  <div className="mb-2 inline-flex rounded-xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                    {uniqueCreators}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Créateurs
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {items.map((item) => (
                  <LiveGridCard key={item.id} item={item} />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-[28px] border border-black/8 bg-white/72 p-6 text-sm text-gray-600 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:text-gray-300">
              Aucun contenu trouvé pour ces filtres.
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-black/8 bg-white/72 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
            <div className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
              À venir
            </div>

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
          </div>

          <div className="rounded-[28px] border border-black/8 bg-white/72 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                Créateurs mis en avant
              </div>

              <span className="rounded-full bg-black/[0.04] px-2 py-1 text-[11px] text-gray-600 dark:bg-white/[0.05] dark:text-gray-300">
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
          </div>
        </aside>
      </div>
    </section>
  );
}