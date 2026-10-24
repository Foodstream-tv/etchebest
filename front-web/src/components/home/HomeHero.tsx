"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";

import HomeFiltersSelect from "@/components/home/HomeFiltersSelect";
import { TAG_GROUPS } from "@/lib/tagGroups";
import { useI18n } from "@/i18n/LanguageContext";

// The hero uses the same typeface as the design mock-up (heavy, rounded headline).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  display: "swap",
  fallback: ["Inter", "system-ui", "sans-serif"],
});

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

  // "Regarde, cuisine, partage." -> the last word goes on its own line, in italic.
  const title = t("home.hero.title");
  const splitAt = title.lastIndexOf(", ");
  const heroTitleStart = splitAt > 0 ? title.slice(0, splitAt + 1) : title;
  const heroTitleEnd = splitAt > 0 ? title.slice(splitAt + 2) : "";

  return (
    <section
      aria-labelledby="home-hero-title"
      className={`${jakarta.className} grid gap-6 lg:grid-cols-2 lg:items-center lg:gap-4`}
    >
      <div className="relative z-20 pt-2">
        <h1
          id="home-hero-title"
          className="font-display text-[clamp(2.75rem,5.4vw,5.25rem)] font-semibold leading-[1.02] tracking-tight text-[#1f1711] dark:text-[#f5ede0]"
        >
          {heroTitleStart}
          {heroTitleEnd ? (
            <>
              <br />
              <span className="italic">{heroTitleEnd}</span>
            </>
          ) : null}
        </h1>

        <p className="mt-4 max-w-[40rem] text-base font-medium leading-relaxed text-gray-600 dark:text-gray-300 lg:text-[clamp(1rem,1.3vw,1.375rem)]">
          {t("home.hero.subtitle")}
        </p>

        {/* One pill; wider than the column so it runs slightly over the illustration. */}
        <div className="mt-7 w-full max-w-[46rem] rounded-3xl border border-black/15 bg-white p-2 shadow-[0_10px_25px_-4px_rgba(45,25,10,0.1),0_2px_6px_-1px_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-[#f5ede0]/25 dark:bg-[#f5ede0]/[0.10] sm:rounded-full lg:w-[calc(100%+3rem)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-orange-400"
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
                className="h-11 w-full rounded-full bg-transparent pl-11 pr-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-orange-300/50 dark:text-white"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleSearch}
                className="h-11 flex-1 rounded-full bg-[#ff7a1a] px-6 text-sm font-bold text-[#1a0f05] shadow-md transition hover:bg-[#ea6a0c] active:scale-95 sm:flex-none"
              >
                {t("home.hero.discover")}
              </button>

              <HomeFiltersSelect
                variant="pill"
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

      {/* Illustration: decorative, larger than its column and tucked under the search pill. */}
      <div
        aria-hidden="true"
        className="relative z-10 h-[300px] w-full sm:h-[400px] lg:-ml-24 lg:h-[clamp(420px,36vw,620px)] lg:w-[calc(100%+6rem)]"
      >
        <Image
          src="/images/home-hero.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="select-none object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.10)] transition-transform duration-300 hover:scale-[1.02] dark:drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
        />
      </div>
    </section>
  );
}
