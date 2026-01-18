"use client";

import { Flame } from "lucide-react";

const TAGS = [
  "Tout",
  "Asiatique",
  "Africain",
  "Européen",
  "Américain",
  "Végétarien",
  "Pâtisserie",
  "Street Food",
  "BBQ",
  "Healthy",
];

export default function HomeHero() {
  return (
    <section className="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-3">
      {/* Left hero */}
      <div className="lg:col-span-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Regarde, cuisine, partage.
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          La plateforme live des passionnés de cuisine.
        </p>

        {/* Main search + discover */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-neutral-900">
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
              placeholder="Chercher une recette, un chef, une cuisine..."
            />
          </div>
          <button className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600">
            Découvrir
          </button>
        </div>

        {/* Tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t}
              className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-800"
            >
              {t}
            </button>
          ))}
        </div>

        {/* mini stats */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            3 lives en cours
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
            3 replays
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
            3 à venir
          </div>
        </div>
      </div>

      {/* Right: Live du moment */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Flame className="h-4 w-4 text-orange-500" />
          Live du moment
        </div>

        <div className="overflow-hidden rounded-xl border bg-gray-50 dark:border-white/10 dark:bg-neutral-950">
          <div className="relative aspect-[16/9] w-full bg-gray-200 dark:bg-white/10">
            {/* remplace par une vraie image si tu veux */}
            <div className="absolute left-3 top-3 rounded-full bg-orange-500 px-2 py-1 text-[11px] font-semibold text-white">
              LIVE
            </div>
            <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-[11px] text-white">
              👁 2180
            </div>
          </div>

          <div className="p-3">
            <div className="text-sm font-semibold">Ramen Tonkotsu Ultimes</div>
            <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              par Aiko Tanaka
            </div>
            <button className="mt-3 w-full rounded-xl bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600">
              Rejoindre
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
