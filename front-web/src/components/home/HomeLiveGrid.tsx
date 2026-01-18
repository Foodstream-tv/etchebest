"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Flame, PlayCircle, Star } from "lucide-react";

type TabKey = "live" | "popular" | "replays" | "planned";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "live", label: "En direct", icon: <Flame className="h-4 w-4" /> },
  { key: "popular", label: "Populaires", icon: <Star className="h-4 w-4" /> },
  { key: "replays", label: "Replays", icon: <PlayCircle className="h-4 w-4" /> },
  { key: "planned", label: "Planifiés", icon: <CalendarDays className="h-4 w-4" /> },
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

const MOCK_LIVE: CardItem[] = [
  {
    id: "1",
    badge: "Asiatique",
    title: "Ramen Tonkotsu Ultimes",
    author: "Aiko Tanaka",
    viewers: 2180,
    isLive: true,
  },
  {
    id: "2",
    badge: "Américain",
    title: "Tacos Birria maison",
    author: "Luis Ortega",
    viewers: 1450,
    isLive: true,
  },
  {
    id: "3",
    badge: "Pâtisserie",
    title: "Macarons Framboise & Rose",
    author: "Camille Dupont",
    viewers: 980,
    when: "Aujourd’hui, 19:00",
  },
  {
    id: "4",
    badge: "Européen",
    title: "Mezzés Libanais express",
    author: "Nour Haddad",
    viewers: 620,
    when: "Demain, 12:30",
  },
  {
    id: "5",
    badge: "Asiatique",
    title: "Bibimbap croustillant",
    author: "Seo-jun Park",
    viewers: 1710,
    isLive: true,
  },
];

const UPCOMING = [
  { id: "u1", title: "Macarons Framboise & Rose", when: "Aujourd’hui, 19:00", author: "Camille Dupont" },
  { id: "u2", title: "Mezzés Libanais express", when: "Demain, 12:30", author: "Nour Haddad" },
  { id: "u3", title: "Granola Healthy maison", when: "Ven., 10:00", author: "Chloé Martin" },
];

const CREATORS = [
  { id: "c1", name: "Aiko Tanaka", tag: "Ramen" },
  { id: "c2", name: "Camille Dupont", tag: "Pâtisserie" },
  { id: "c3", name: "Luis Ortega", tag: "Street Food" },
];

function LiveCard({ item }: { item: CardItem }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="relative aspect-[16/9] w-full bg-gray-200 dark:bg-white/10">
        {item.isLive && (
          <div className="absolute left-3 top-3 rounded-full bg-orange-500 px-2 py-1 text-[11px] font-semibold text-white">
            LIVE
          </div>
        )}

        <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white">
          {item.badge}
        </div>

        <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-[11px] text-white">
          👁 {item.viewers ?? 0}
        </div>
      </div>

      <div className="p-4">
        <div className="text-sm font-semibold">{item.title}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>👤 {item.author}</span>
          {item.when ? <span className="text-gray-500 dark:text-gray-500">{item.when}</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function HomeLiveGrid() {
  const [tab, setTab] = useState<TabKey>("live");

  const items = useMemo(() => {
    return MOCK_LIVE;
  }, [tab]);

  return (
    <section className="pb-14 pt-8">
      {/* Tabs row */}
      <div className="flex items-center gap-2 rounded-2xl border bg-white p-2 shadow-sm dark:border-white/10 dark:bg-neutral-900">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                active
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-neutral-800",
              ].join(" ")}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content: grid + right sidebar */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: cards grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {items.map((it) => (
              <LiveCard key={it.id} item={it} />
            ))}
          </div>
        </div>

        {/* Right: sidebar */}
        <aside className="space-y-6">
          {/* A venir */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
            <div className="mb-3 text-sm font-semibold">À venir</div>

            <div className="space-y-3">
              {UPCOMING.map((u) => (
                <div
                  key={u.id}
                  className="rounded-2xl border bg-gray-50 p-3 dark:border-white/10 dark:bg-neutral-950"
                >
                  <div className="text-sm font-semibold">{u.title}</div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {u.when} — {u.author}
                  </div>
                  <button className="mt-3 w-full rounded-xl bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600">
                    Me prévenir
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Créateurs mis en avant */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Créateurs mis en avant</div>
              <span className="rounded-full border bg-gray-50 px-2 py-1 text-[11px] text-gray-600 dark:border-white/10 dark:bg-neutral-950 dark:text-gray-300">
                Top 10
              </span>
            </div>

            <div className="space-y-3">
              {CREATORS.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-white/10" />
                    <div>
                      <div className="text-sm font-semibold">{c.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{c.tag}</div>
                    </div>
                  </div>
                  <button className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-900 dark:hover:bg-neutral-800">
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
