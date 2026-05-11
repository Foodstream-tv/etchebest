"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import LiveMomentCard from "@/components/home/hero/LiveMomentCard";

const TAG_GROUPS = [
  {
    title: "Cuisine",
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
    title: "Type de plat",
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
    title: "Format",
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

type HomeHeroProps = {
  onSearch?: (params: { q: string; tag: string }) => void;
};

export default function HomeHero({ onSearch }: HomeHeroProps) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("Tout");
  const [openGroup, setOpenGroup] = useState("Cuisine");

  const selectedLabel = useMemo(() => {
    if (activeTag === "Tout") return "Toutes les cuisines";
    return activeTag;
  }, [activeTag]);

  const handleSearch = () => {
    onSearch?.({
      q: query.trim(),
      tag: activeTag,
    });
  };

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

        <div className="mt-6 rounded-[28px] border border-black/8 bg-white/75 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder="Chercher une recette, une cuisine..."
                className="h-12 w-full rounded-2xl border border-black/8 bg-white pl-11 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30 dark:border-white/10 dark:bg-[#120b05]/80 dark:text-white"
              />
            </div>

            <button
              onClick={handleSearch}
              className="h-12 shrink-0 rounded-2xl px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition hover:scale-[1.01] active:scale-[0.98]"
              style={{ background: ORANGE_GRADIENT_CSS }}
            >
              Découvrir
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3 dark:border-white/10">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Filtre actif :
            </span>

            <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 ring-1 ring-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20">
              {selectedLabel}
            </span>

            <div className="ml-0 flex overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:ml-2">
              {TAG_GROUPS.map((group, index) => {
                const open = openGroup === group.title;

                return (
                  <button
                    key={group.title}
                    type="button"
                    onClick={() => setOpenGroup(open ? "" : group.title)}
                    className={[
                      "inline-flex items-center gap-2 px-3 py-2 text-xs font-bold transition",
                      index !== 0 ? "border-l border-black/8 dark:border-white/10" : "",
                      open
                        ? "bg-orange-500 text-white"
                        : "text-gray-600 hover:bg-orange-50 hover:text-orange-700 dark:text-gray-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300",
                    ].join(" ")}
                  >
                    {group.title}
                    <ChevronDown
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

          {openGroup && (
            <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-3 dark:border-orange-500/20 dark:bg-orange-500/10">
              <div className="flex flex-wrap gap-2">
                {TAG_GROUPS.find((group) => group.title === openGroup)?.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setActiveTag(tag);
                      setOpenGroup("");
                      onSearch?.({
                        q: query.trim(),
                        tag,
                      });
                    }}
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
          )}
        </div>
      </div>

      <LiveMomentCard />
    </section>
  );
}