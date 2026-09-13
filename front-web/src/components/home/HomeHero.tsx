"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import LiveMomentCard from "@/components/home/hero/LiveMomentCard";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import { useI18n } from "@/i18n/LanguageContext";

const TAG_GROUPS = [
  {
    key: "cuisine",
    titleKey: "home.hero.group.cuisine" as const,
    defaultTitle: "Cuisine",
    tags: [
      "Tout",
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
  onSearch?: (params: { q: string; tag: string }) => void;
}>;

export default function HomeHero({ onSearch }: HomeHeroProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("Tout");
  const [openGroupKey, setOpenGroupKey] = useState<string>("cuisine");

  const selectedLabel = useMemo(() => {
    if (activeTag === "Tout") return t("home.hero.allCuisines");

    return activeTag;
  }, [activeTag, t]);

  const activeGroup = useMemo(() => {
    return TAG_GROUPS.find((group) => group.key === openGroupKey);
  }, [openGroupKey]);

  const handleSearch = () => {
    onSearch?.({
      q: query.trim(),
      tag: activeTag,
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
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3 dark:border-white/10">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {t("home.hero.activeFilter")}
            </span>

            <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 ring-1 ring-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20">
              {selectedLabel}
            </span>

            <div
              className="ml-0 flex overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:ml-2"
              aria-label={t("home.hero.filterGroups")}
            >
              {TAG_GROUPS.map((group, index) => {
                const open = openGroupKey === group.key;

                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setOpenGroupKey(open ? "" : group.key)}
                    aria-expanded={open}
                    className={[
                      "inline-flex items-center gap-2 px-3 py-2 text-xs font-bold transition",
                      index !== 0
                        ? "border-l border-black/8 dark:border-white/10"
                        : "",
                      open
                        ? "bg-orange-500 text-white"
                        : "text-gray-600 hover:bg-orange-50 hover:text-orange-700 dark:text-gray-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300",
                    ].join(" ")}
                  >
                    {t(group.titleKey)}
                    <ChevronDown
                      aria-hidden="true"
                      className={[
                        "h-3.5 w-3.5 transition",
                        open ? "rotate-180 text-white" : "",
                      ].join(" ")}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {activeGroup ? (
            <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-3 dark:border-orange-500/20 dark:bg-orange-500/10">
              <div
                className="flex flex-wrap gap-2"
                aria-label={t("home.hero.filtersAria", { group: t(activeGroup.titleKey) })}
              >
                {activeGroup.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setActiveTag(tag);
                      setOpenGroupKey("");
                      onSearch?.({
                        q: query.trim(),
                        tag,
                      });
                    }}
                    aria-pressed={activeTag === tag}
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                      activeTag === tag
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-white text-gray-700 ring-1 ring-black/5 hover:bg-orange-100 hover:text-orange-700 dark:bg-white/5 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-orange-500/20 dark:hover:text-orange-200",
                    ].join(" ")}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <LiveMomentCard />
    </section>
  );
}