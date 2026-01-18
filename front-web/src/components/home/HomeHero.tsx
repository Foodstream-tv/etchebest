"use client";

import { Flame } from "lucide-react";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";

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
    <section className="grid gap-8 lg:grid-cols-[1.6fr_0.9fr] lg:items-start">
      {/* Left */}
      <div className="pt-2">
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-[34px]">
          Regarde, cuisine, partage.
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          La plateforme live des passionnés de cuisine.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            placeholder="Chercher une recette, un chef, une cuisine..."
            className="w-full rounded-xl border bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-gray-900 dark:border-white/10 dark:bg-neutral-900 dark:focus:border-white/25"
          />
          <button
            className="h-[46px] shrink-0 rounded-xl px-6 text-sm font-semibold text-white shadow-sm hover:brightness-105"
            style={{ background: ORANGE_GRADIENT_CSS }}
          >
            Découvrir
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t}
              className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-800"
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            3 lives en cours
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
            3 replays
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
            3 à venir
          </span>
        </div>
      </div>

      {/* Right: Live du moment */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Flame className="h-4 w-4 text-orange-500" />
          Live du moment
        </div>

        <div className="overflow-hidden rounded-xl ring-1 ring-black/5 dark:ring-white/10">
          <div className="relative h-48 bg-gray-200 dark:bg-white/10">
            <span
              className="absolute left-3 top-3 rounded-full px-2 py-1 text-[11px] font-bold text-white"
              style={{ background: ORANGE_GRADIENT_CSS }}
            >
              LIVE
            </span>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
              👁 2180
            </span>
          </div>

          <div className="p-3">
            <div className="text-sm font-semibold">Ramen Tonkotsu Ultimes</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              par Aiko Tanaka
            </div>

            <button
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white hover:brightness-105"
              style={{ background: ORANGE_GRADIENT_CSS }}
            >
              Rejoindre
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
