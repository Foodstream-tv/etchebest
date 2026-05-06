"use client";

import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import HomeHeroTag from "@/components/home/hero/HomeHeroTag";
import LiveMomentCard from "@/components/home/hero/LiveMomentCard";

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
    <section className="grid gap-8 lg:grid-cols-[1.6fr_0.92fr] lg:items-start">
      <div className="pt-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          Foodstream
        </div>

        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-gray-900 dark:text-gray-50 lg:text-[3.2rem]">
          Regarde, cuisine, partage.
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-400 md:text-base">
          La plateforme live des passionnés de cuisine. Découvre des recettes,
          suis des chefs et rejoins des lives culinaires en direct.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            placeholder="Chercher une recette, un chef, une cuisine..."
            className="h-12 w-full rounded-2xl border border-black/8 bg-white/72 px-4 text-sm text-gray-900 shadow-sm backdrop-blur-sm outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/35 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
          />

          <button
            className="h-12 shrink-0 rounded-2xl px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400"
            style={{ background: ORANGE_GRADIENT_CSS }}
          >
            Découvrir
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <HomeHeroTag key={tag} label={tag} />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            3 lives en cours
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-black/20 dark:bg-white/20" />
            2 replays
          </span>
        </div>
      </div>

      <LiveMomentCard />
    </section>
  );
}