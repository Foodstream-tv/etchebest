"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Eye, Flame, PlayCircle, Star } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { getRooms, RoomInfo } from "@/services/streaming";

type TabKey = "live" | "popular" | "replays" | "planned";

const ORANGE_GRADIENT_CSS =
  "linear-gradient(90deg, #FFA92E 0%, #FF5D1E 100%)";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "live", label: "En direct", icon: <Flame className="h-4 w-4" /> },
  { key: "popular", label: "Populaires", icon: <Star className="h-4 w-4" /> },
  {
    key: "replays",
    label: "Replays",
    icon: <PlayCircle className="h-4 w-4" />,
  },
  {
    key: "planned",
    label: "Planifiés",
    icon: <CalendarDays className="h-4 w-4" />,
  },
];

type CardItem = {
  id: string;
  badge: string;
  title: string;
  author: string;
  viewers?: number;
  when?: string;
  isLive?: boolean;
};

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

function LiveCard({ item }: { item: CardItem }) {
  return (
    <Link
      href={`/watch/${encodeURIComponent(item.id)}`}
      className="block overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-neutral-900"
    >
      <div className="relative aspect-[16/9] w-full bg-gray-200 dark:bg-white/10">
        {item.isLive && (
          <div
            className="absolute left-3 top-3 rounded-full px-2 py-1 text-[11px] font-semibold text-white"
            style={{ background: ORANGE_GRADIENT_CSS }}
          >
            LIVE
          </div>
        )}

        <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white">
          {item.badge}
        </div>

        <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white">
          <Eye className="h-3.5 w-3.5" />
          {item.viewers ?? 0}
        </div>
      </div>

      <div className="p-4">
        <div className="text-sm font-semibold">{item.title}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>👤 {item.author}</span>
          {item.when ? (
            <span className="text-gray-500 dark:text-gray-500">{item.when}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function HomeLiveGrid() {
  const [tab, setTab] = useState<TabKey>("live");
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const { token, ready } = useAuth();
  const didInit = useRef(false);

  async function refreshRooms() {
    if (!token) {
      setRooms([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getRooms(token);
      setRooms(data ?? []);
    } catch (error) {
      console.error("Impossible de charger les rooms :", error);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;
    if (didInit.current) return;
    didInit.current = true;

    refreshRooms();

    const timer = setInterval(refreshRooms, 10_000);
    return () => clearInterval(timer);
  }, [ready, token]);

  const liveItems = useMemo<CardItem[]>(() => {
    return rooms.map((room) => ({
      id: room.id,
      badge: "Live",
      title: room.name || "Live sans titre",
      author: "Vous",
      viewers: room.viewers ?? 0,
      isLive: true,
    }));
  }, [rooms]);

  const items = useMemo(() => {
    switch (tab) {
      case "live":
        return liveItems;
      case "popular":
        return [...liveItems].sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0));
      case "replays":
        return [];
      case "planned":
        return [];
      default:
        return liveItems;
    }
  }, [tab, liveItems]);

  return (
    <section className="pb-14 pt-8">
      <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm dark:bg-neutral-900">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                active
                  ? "text-white"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-neutral-800",
              ].join(" ")}
              style={active ? { background: ORANGE_GRADIENT_CSS } : undefined}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-neutral-900"
                >
                  <div className="aspect-[16/9] w-full animate-pulse bg-gray-200 dark:bg-white/10" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {items.map((it) => (
                <LiveCard key={it.id} item={it} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-6 text-sm text-gray-600 shadow-sm dark:bg-neutral-900 dark:text-gray-300">
              Aucun contenu disponible pour cet onglet.
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
            <div className="mb-3 text-sm font-semibold">À venir</div>

            <div className="space-y-3">
              {UPCOMING.map((u) => (
                <div
                  key={u.id}
                  className="rounded-2xl bg-gray-50 p-3 dark:bg-white/5"
                >
                  <div className="text-sm font-semibold">{u.title}</div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {u.when} — {u.author}
                  </div>
                  <button
                    className="mt-3 w-full rounded-xl py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105"
                    style={{ background: ORANGE_GRADIENT_CSS }}
                  >
                    Me prévenir
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Créateurs mis en avant</div>
              <span className="rounded-full bg-gray-50 px-2 py-1 text-[11px] text-gray-600 dark:bg-white/5 dark:text-gray-300">
                Top 10
              </span>
            </div>

            <div className="space-y-3">
              {CREATORS.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-white/10" />
                    <div>
                      <div className="text-sm font-semibold">{c.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {c.tag}
                      </div>
                    </div>
                  </div>

                  <button className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10">
                    Suivre
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}