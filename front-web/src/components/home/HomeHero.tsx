"use client";

import { useState } from "react";
import { ChefHat, Globe, Salad, Search } from "lucide-react";

import LiveMomentCard from "@/components/home/hero/LiveMomentCard";
import HomeFiltersSelect from "@/components/home/HomeFiltersSelect";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import { useI18n } from "@/i18n/LanguageContext";

const TAG_GROUPS = [
  {
    key: "cuisine",
    titleKey: "home.hero.group.cuisine" as const,
    defaultTitle: "Cuisine",
    icon: Globe,
    tags: [
      "Asiatique",
      "Africain",
      "Européen",
      "Américain",
      "Français",
      "Italien",
      "Mexicain",
      "Japonais",
      "Coréen",
      "Chinois",
      "Indien",
    ],
  },
  {
    key: "dishType",
    titleKey: "home.hero.group.dishType" as const,
    defaultTitle: "Type de plat",
    icon: Salad,
    tags: [
      "Végétarien",
      "Vegan",
      "Pâtisserie",
      "Dessert",
      "Street Food",
      "BBQ",
      "Healthy",
      "Apéro",
      "Petit-déjeuner",
      "Boisson",
    ],
  },
  {
    key: "format",
    titleKey: "home.hero.group.format" as const,
    defaultTitle: "Format",
    icon: ChefHat,
    tags: [
      "Recette rapide",
      "Pas à pas",
      "Débutant friendly",
      "Meal prep",
      "Cuisine économique",
      "Challenge",
      "Fait maison",
    ],
  },
];

type HomeHeroProps = Readonly<{
  onSearch?: (params: { q: string; tags: string[] }) => void;
}>;

export default function HomeHero({ onSearch }: HomeHeroProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const handleSearch = () => {
    onSearch?.({
      q: query.trim(),
      tags: activeTags,
    });
  };

  return (
    <section
      aria-labelledby="home-hero-title"
      className="grid gap-8 lg:grid-cols-[1.6fr_0.92fr] lg:items-start"
    >
      <div className="pt-2">
        <h1
          id="home-hero-title"
          className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-gray-900 dark:text-gray-50 lg:text-[3.2rem]"
        >
          {t("home.hero.title")}
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-400 md:text-base">
          {t("home.hero.subtitle")}
        </p>

        <div className="mt-6 rounded-[28px] border border-black/8 bg-white/75 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />

              <label htmlFor="home-hero-search" className="sr-only">
                {t("home.hero.searchAria")}
              </label>

              <input
                id="home-hero-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                placeholder={t("home.hero.searchPlaceholder")}
                className="h-12 w-full rounded-2xl border border-black/8 bg-white pl-11 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30 dark:border-white/10 dark:bg-[#120b05]/80 dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={handleSearch}
              className="h-12 shrink-0 rounded-2xl px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition hover:scale-[1.01] active:scale-[0.98]"
              style={{ background: ORANGE_GRADIENT_CSS }}
            >
              {t("home.hero.discover")}
            </button>

            <div className="ml-auto shrink-0">
              <HomeFiltersSelect
                label={t("home.hero.filters")}
                description={t("home.hero.filtersDescription")}
                closeLabel={t("home.hero.closeFilters")}
                resetLabel={t("home.hero.resetFilters")}
                applyLabel={t("home.hero.applyFilters")}
                value={activeTags}
                groups={TAG_GROUPS.map((group) => ({
                  label: t(group.titleKey),
                  icon: group.icon,
                  tags: group.tags,
                }))}
                onChange={(tags) => {
                  setActiveTags(tags);
                  onSearch?.({ q: query.trim(), tags });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <LiveMomentCard />
    </section>
  );
}
