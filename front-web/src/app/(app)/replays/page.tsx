"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlayCircle, RefreshCw, Search, Video } from "lucide-react";

import HomeFiltersSelect from "@/components/home/HomeFiltersSelect";
import HomeFooter from "@/components/home/HomeFooter";
import { getLives, type LiveDTO } from "@/lib/lives";
import { deleteLive } from "@/services/streaming";
import { useAuth } from "@/lib/useAuth";
import ReplayCarouselSection from "@/components/watch/ReplayCarouselSection";
import { TAG_GROUPS } from "@/lib/tagGroups";
import { useI18n } from "@/i18n/LanguageContext";

export default function ReplaysPage() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [q, setQ] = useState("");
  // Tags picked in the filter panel (empty = everything), like on the lives page.
  const [tags, setTags] = useState<string[]>([]);
  // Stable dependency: a new array holding the same tags must not refetch.
  const tagsKey = tags.join("\n");
  const [replays, setReplays] = useState<LiveDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteReplay = async (replay: LiveDTO) => {
    if (!token) return;
    try {
      await deleteLive(replay.room_id || replay.id, token);
      setReplays((prev) =>
        prev.filter((r) => r.id !== replay.id && r.room_id !== replay.room_id)
      );
    } catch (err) {
      console.error("Failed to delete replay:", err);
      alert((err instanceof Error && err.message) || "Erreur lors de la suppression de la rediffusion");
    }
  };

  // Bumped by the refresh button to fetch again with the same search.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // An answer that arrives after the search changed is dropped.
    let ignore = false;

    async function loadReplays() {
      try {
        const res = await getLives({
          q,
          tags: tagsKey ? tagsKey.split("\n") : [],
          status: "ended",
          page: 1,
          limit: 48,
        });
        if (ignore) return;

        setReplays(res.lives ?? []);
        setError(null);
      } catch (e) {
        if (ignore) return;
        setError((e instanceof Error && e.message) || t("replays.errorTitle"));
        setReplays([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadReplays();

    return () => {
      ignore = true;
    };
  }, [q, tagsKey, reloadKey, t]);

  const refresh = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const replaysByTag = useMemo(() => {
    const map = new Map<string, LiveDTO[]>();

    replays.forEach((replay) => {
      if (!replay.tags || replay.tags.length === 0) {
        const otherTag = t("replays.tagOther");
        const existing = map.get(otherTag) ?? [];
        map.set(otherTag, [...existing, replay]);
        return;
      }

      replay.tags.forEach((tag) => {
        const existing = map.get(tag.name) ?? [];
        map.set(tag.name, [...existing, replay]);
      });
    });

    return Array.from(map.entries()).map(([tagName, tagReplays]) => ({
      tagName,
      lives: tagReplays,
    }));
  }, [replays, t]);

  return (
    <main id="main-content" className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:py-10">
        <div className="space-y-8">
          <section className="overflow-hidden rounded-[34px] border border-black/8 bg-white/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#1f1712]/58 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">

                <h1 className="font-display text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 md:text-4xl">
                  {t("replays.heroTitle")}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-400 md:text-base">
                  {t("replays.heroDesc")}{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {t("replays.count", {
                      count: replays.length,
                      plural: replays.length > 1 ? "s" : "",
                    })}
                    .
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/15 bg-white shadow-sm px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-[#fffaf2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#f5ede0]/25 dark:bg-[#f5ede0]/[0.10] dark:text-[#f5ede0] dark:shadow-none dark:hover:bg-[#f5ede0]/[0.18]"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  {t("replays.refresh")}
                </button>

                <Link
                  href="/watch"
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-[#1a0f05] shadow-sm transition hover:bg-orange-400"
                >
                  <Video aria-hidden="true" className="h-4 w-4" />
                  {t("replays.seeLives")}
                </Link>
              </div>
            </div>

            <div className="mt-7 rounded-[28px] border border-black/8 bg-white/75 p-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-[#f5ede0]/70"
                  />

                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("replays.searchPlaceholder")}
                    aria-label={t("replays.searchAria")}
                    className="h-12 w-full rounded-2xl border border-black/15 bg-white shadow-sm pl-11 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/40 dark:border-[#f5ede0]/25 dark:bg-[#f5ede0]/[0.10] dark:text-[#f5ede0] dark:shadow-none dark:placeholder:text-[#f5ede0]/55"
                  />
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
                    onChange={setTags}
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
                {t("replays.errorTitle")}
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
              aria-label={t("replays.loadingAria")}
              className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#1f1712]/60"
                >
                  <div
                    aria-hidden="true"
                    className="h-44 animate-pulse bg-black/[0.05] dark:bg-white/10"
                  />

                  <div className="space-y-3 p-5" aria-hidden="true">
                    <div className="h-4 w-24 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                    <div className="h-5 w-3/4 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                  </div>
                </div>
              ))}
            </section>
          ) : !error && replays.length === 0 ? (
            <section className="rounded-[28px] border border-black/8 bg-white/72 p-10 text-center shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#1f1712]/60">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                <PlayCircle aria-hidden="true" className="h-8 w-8" />
              </div>

              <h2 className="font-display text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                {t("replays.emptyTitle")}
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-600 dark:text-gray-400">
                {t("replays.emptyDesc")}
              </p>
            </section>
          ) : (
            <div className="space-y-10">
              {replaysByTag.map((section) => (
                <ReplayCarouselSection
                  key={section.tagName}
                  title={section.tagName}
                  replays={section.lives}
                  onDeleteReplay={handleDeleteReplay}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <HomeFooter />
    </main>
  );
}