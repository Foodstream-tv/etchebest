"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Flame, Search, Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import GoLiveIncentive from "@/components/home/GoLiveIncentive";
import HomeFiltersSelect from "@/components/home/HomeFiltersSelect";
import HomeFooter from "@/components/home/HomeFooter";
import { getLives, type LiveDTO } from "@/lib/lives";
import { TAG_GROUPS } from "@/lib/tagGroups";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import WatchTagSection from "@/components/watch/WatchTagSection";
import { useI18n } from "@/i18n/LanguageContext";

type TabKey = "all" | "live" | "scheduled" | "ended";

export default function WatchListPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();

  const initialQ = searchParams.get("q") ?? "";
  const initialTag = searchParams.get("tag");

  const [q, setQ] = useState(initialQ);
  // Tags picked in the filter panel (empty = everything). "?tag=BBQ" links preselect one.
  const [tags, setTags] = useState<string[]>(
    initialTag && initialTag !== "Tout" && initialTag !== "All" ? [initialTag] : []
  );
  // Stable dependency: a new array holding the same tags must not refetch.
  const tagsKey = tags.join("\n");
  const [tab, setTab] = useState<TabKey>("all");

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = useMemo(
    () => [
      { key: "all", label: t("watch.tab.all"), icon: <Star className="h-4 w-4" /> },
      { key: "live", label: t("watch.tab.live"), icon: <Flame className="h-4 w-4" /> },
      {
        key: "scheduled",
        label: t("watch.tab.scheduled"),
        icon: <CalendarDays className="h-4 w-4" />,
      },
    ],
    [t]
  );

  const [lives, setLives] = useState<LiveDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pages shown so far: "load more" adds one, a new search or filter goes back to the first.
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const limit = 12;

  // Fetches every live shown so far in one request, so the 10 s refresh keeps the pages already loaded.
  useEffect(() => {
    // An answer that arrives after the search changed is dropped.
    let ignore = false;

    async function loadLives() {
      try {
        const res = await getLives({
          q,
          tags: tagsKey ? tagsKey.split("\n") : [],
          status: tab === "all" ? "all" : tab,
          page: 1,
          limit: limit * page,
        });
        if (ignore) return;

        setLives(res.lives ?? []);
        setTotal(res.total ?? 0);
        setError(null);
      } catch (e) {
        if (ignore) return;
        setError((e instanceof Error && e.message) || t("watch.loadError"));
      } finally {
        if (!ignore) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    loadLives();

    const tTimer = window.setInterval(loadLives, 10_000);
    return () => {
      ignore = true;
      window.clearInterval(tTimer);
    };
  }, [q, tagsKey, tab, page, t]);

  const hasLives = lives.length > 0;
  // A search, a tag or a status tab narrows the list: "nothing found" then differs from "no live yet".
  const isFiltered = q.trim() !== "" || tags.length > 0 || tab !== "all";

  const livesByTag = useMemo(() => {
    const map = new Map<string, LiveDTO[]>();

    lives.forEach((live) => {
      if (!live.tags || live.tags.length === 0) {
        const otherTag = t("common.other");
        const existing = map.get(otherTag) ?? [];
        map.set(otherTag, [...existing, live]);
        return;
      }

      live.tags.forEach((itemTag) => {
        const existing = map.get(itemTag.name) ?? [];
        map.set(itemTag.name, [...existing, live]);
      });
    });

    return Array.from(map.entries()).map(([tagName, tagLives]) => ({
      tagName,
      lives: tagLives,
    }));
  }, [lives, t]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:py-10">
        <div className="space-y-8">
          <section className="overflow-hidden rounded-[34px] border border-black/8 bg-white/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#1f1712]/58 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 md:text-4xl">
                  {t("watch.heroTitle")}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-400 md:text-base">
                  {t("watch.heroDesc")}
                </p>
              </div>
            </div>

            <div className="mt-7 rounded-[28px] border border-black/8 bg-white/75 p-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-[#f5ede0]/70"
                    aria-hidden="true"
                  />

                  <input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                    placeholder={t("watch.searchPlaceholder")}
                    aria-label={t("watch.searchAria")}
                    type="search"
                    className="h-12 w-full rounded-2xl border border-black/15 bg-white shadow-sm pl-11 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/40 dark:border-[#f5ede0]/25 dark:bg-[#f5ede0]/[0.10] dark:text-[#f5ede0] dark:shadow-none dark:placeholder:text-[#f5ede0]/55"
                  />
                </div>

                <div
                  className="flex overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm dark:border-[#f5ede0]/25 dark:bg-[#f5ede0]/[0.10] dark:shadow-none"
                  aria-label={t("watch.filterStatusAria")}
                >
                  {tabs.map((item, index) => {
                    const active = tab === item.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setTab(item.key);
                          setPage(1);
                        }}
                        aria-pressed={active}
                        className={[
                          "inline-flex items-center gap-2 px-3 py-2 text-xs font-bold transition",
                          index !== 0
                            ? "border-l border-black/8 dark:border-white/10"
                            : "",
                          active
                            ? "text-[#1a0f05]"
                            : "text-gray-600 hover:bg-orange-50 hover:text-orange-700 dark:text-gray-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-300",
                        ].join(" ")}
                        style={
                          active ? { background: ORANGE_GRADIENT_CSS } : undefined
                        }
                      >
                        <span aria-hidden="true">{item.icon}</span>
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="shrink-0">
                  <HomeFiltersSelect
                    iconOnly
                    label={t("home.hero.filters")}
                    description={t("home.hero.filtersDescription")}
                    closeLabel={t("home.hero.closeFilters")}
                    resetLabel={t("home.hero.resetFilters")}
                    applyLabel={t("home.hero.applyFilters")}
                    value={tags}
                    groups={TAG_GROUPS.map((group) => ({
                      label: t(group.titleKey),
                      icon: group.icon,
                      tags: group.tags,
                    }))}
                    onChange={(next) => {
                      setTags(next);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {!loading && error ? (
            <section
              role="alert"
              className="rounded-[28px] border border-red-200 bg-red-50/80 p-5 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10"
            >
              <h2 className="text-base font-semibold text-red-700 dark:text-red-200">
                {t("watch.loadError")}
              </h2>
              <p className="mt-1 text-sm text-red-600 dark:text-red-200/80">
                {error}
              </p>
            </section>
          ) : null}

          {loading ? (
            <section
              role="status"
              aria-live="polite"
              aria-label={t("common.loading")}
              className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#1f1712]/60"
                >
                  <div className="h-44 animate-pulse bg-black/[0.05] dark:bg-white/10" />
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-24 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                    <div className="h-5 w-3/4 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                  </div>
                </div>
              ))}
            </section>
          ) : !error && !hasLives ? (
            isFiltered ? (
              <section className="rounded-[28px] border border-black/8 bg-white/72 p-10 text-center shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#1f1712]/60">
                <h2 className="font-display text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                  {t("watch.emptyTitle")}
                </h2>

                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-600 dark:text-gray-400">
                  {t("watch.emptyDesc")}
                </p>
              </section>
            ) : (
              <GoLiveIncentive />
            )
          ) : (
            <div className="space-y-10">
              {livesByTag.map((section) => (
                <WatchTagSection
                  key={section.tagName}
                  tagName={section.tagName}
                  lives={section.lives}
                  onDeleted={(deleted) => {
                    setLives((prev) => prev.filter((l) => l.id !== deleted.id));
                    setTotal((prev) => Math.max(0, prev - 1));
                  }}
                />
              ))}
            </div>
          )}

          {lives.length < total ? (
            <div className="flex justify-center pt-6">
              <button
                type="button"
                onClick={() => {
                  setLoadingMore(true);
                  setPage((prev) => prev + 1);
                }}
                disabled={loadingMore}
                className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-[#1a0f05] shadow-sm transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? t("common.loading") : t("watch.loadMore")}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <HomeFooter />
    </div>
  );
}