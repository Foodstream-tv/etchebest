"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChefHat,
  Clock,
  Eye,
  PlayCircle,
  Tag,
  Timer,
  User,
  Utensils,
} from "lucide-react";

import HomeFooter from "@/components/home/HomeFooter";
import { getLiveByRoomId, type LiveDTO } from "@/lib/lives";
import { useI18n } from "@/i18n/LanguageContext";

type QualityOption = {
  label: string;
  value: string;
};

type ParsedRecipe = {
  ingredients?: { name: string; qty: string }[];
  prepSteps?: string[];
  cookingTimer?: number;
  platingSteps?: string[];
  utensils?: string[];
  prepTimeMins?: number;
  restTimeMins?: number;
};

function getPublicMediaUrl(path: string) {
  if (path.startsWith("http")) return path;

  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, "") || "";

  return `${baseUrl}${path}`;
}

export default function ReplayDetailPage() {
  const { t, locale } = useI18n();
  const params = useParams<{ id: string }>();
  const replayId = params?.id;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [replay, setReplay] = useState<LiveDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoError, setVideoError] = useState("");

  const [qualities, setQualities] = useState<QualityOption[]>([
    { label: "Auto", value: "auto" },
  ]);
  const [selectedQuality, setSelectedQuality] = useState("auto");

  useEffect(() => {
    async function loadReplay() {
      if (!replayId) return;

      try {
        setLoading(true);
        setError("");

        const data = await getLiveByRoomId(replayId);
        setReplay(data);
      } catch (err: any) {
        setError(err?.message || "Impossible de charger le replay.");
        setReplay(null);
      } finally {
        setLoading(false);
      }
    }

    loadReplay();
  }, [replayId]);

  const replayUrl = useMemo(() => {
    if (!replay?.replay_url) return "";
    return getPublicMediaUrl(replay.replay_url);
  }, [replay]);

  const isHlsReplay = useMemo(() => {
    return replayUrl.endsWith(".m3u8");
  }, [replayUrl]);

  const applyQuality = useCallback((value: string, hlsInstance?: Hls | null) => {
    const hls = hlsInstance ?? hlsRef.current;
    if (!hls) return;

    if (value === "auto") {
      hls.currentLevel = -1;
      return;
    }

    const height = Number(value);
    const levelIndex = hls.levels.findIndex((level) => level.height === height);

    if (levelIndex !== -1) {
      hls.currentLevel = levelIndex;
    }
  }, []);

  const handleQualityChange = (value: string) => {
    setSelectedQuality(value);
    applyQuality(value);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !replayUrl) return;

    setVideoError("");
    setVideoLoading(true);
    setQualities([{ label: "Auto", value: "auto" }]);
    setSelectedQuality("auto");

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();

    if (isHlsReplay && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 900,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hlsRef.current = hls;
      hls.loadSource(replayUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels
          .map((level) => level.height)
          .filter((height): height is number => Boolean(height));

        const uniqueLevels = Array.from(new Set(levels)).sort((a, b) => b - a);

        setQualities([
          { label: "Auto", value: "auto" },
          ...uniqueLevels.map((height) => ({
            label: `${height}p`,
            value: String(height),
          })),
        ]);

        applyQuality(selectedQuality, hls);
        setVideoLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data?.fatal) return;

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        setVideoLoading(false);
        setVideoError("Impossible de lire ce replay.");
      });

      return () => {
        try {
          hls.destroy();
        } catch {}

        hlsRef.current = null;
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl") && isHlsReplay) {
      video.src = replayUrl;

      const onLoaded = () => setVideoLoading(false);
      const onError = () => {
        setVideoLoading(false);
        setVideoError("Impossible de lire ce replay.");
      };

      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);

      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
      };
    }

    video.src = replayUrl;

    const onLoaded = () => setVideoLoading(false);
    const onError = () => {
      setVideoLoading(false);
      setVideoError(t("replays.videoError"));
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
  }, [replayUrl, isHlsReplay, applyQuality, selectedQuality, t]);

  const dateLabel = useMemo(() => {
    if (!replay?.created_at) return locale === "en" ? "Unknown date" : "Date inconnue";

    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(replay.created_at));
  }, [replay, locale]);

  const [parsedRecipe, cleanDescription] = useMemo<[ParsedRecipe | null, string]>(() => {
    const rawDesc = replay?.description || "";
    const marker = "---FOODSTREAM_RECIPE---";
    let descText = rawDesc;
    let recipeData: ParsedRecipe | null = null;

    if (rawDesc.includes(marker)) {
      const parts = rawDesc.split(marker);
      descText = parts[0].trim();
      try {
        recipeData = JSON.parse(parts[1].trim());
      } catch (e) {
        console.error("Failed to parse recipe JSON in replay:", e);
      }
    }

    // Clean consecutive identical sentences/phrases if present
    if (descText) {
      const sentences = descText.split(/(?<=[.!?])\s+/);
      if (sentences.length > 1) {
        const unique: string[] = [];
        for (let i = 0; i < sentences.length; i++) {
          const trimmed = sentences[i].trim();
          if (!trimmed) continue;
          if (
            unique.length === 0 ||
            unique[unique.length - 1].toLowerCase() !== trimmed.toLowerCase()
          ) {
            unique.push(trimmed);
          }
        }
        descText = unique.join(" ");
      }
    }

    return [recipeData, descText];
  }, [replay?.description]);

  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <main id="main-content" className="min-h-screen">
        <div
          role="status"
          aria-live="polite"
          aria-label={t("replays.loadingVideo")}
          className="mx-auto w-full max-w-7xl px-6 py-8"
        >
          <div
            aria-hidden="true"
            className="h-[520px] animate-pulse rounded-[34px] bg-black/10 dark:bg-white/10"
          />
        </div>
      </main>
    );
  }

  if (error || !replay) {
    return (
      <main id="main-content" className="min-h-screen">
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <div
            role="alert"
            className="rounded-[30px] border border-red-200 bg-red-50 p-8 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
          >
            {error || t("replays.notFound")}
          </div>
        </div>
      </main>
    );
  }

  const thumbnail = replay.thumbnail_url || "/images/live-fallback.png";

  return (
    <main id="main-content" className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:py-10">
        <div className="mb-5">
          <Link
            href="/replays"
            className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/70 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t("replays.back")}
          </Link>
        </div>

        <section className="overflow-hidden rounded-[34px] border border-black/8 bg-white/72 shadow-[0_20px_60px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="relative aspect-video bg-black">
            {replay.replay_url ? (
              <>
                <video
                  ref={videoRef}
                  controls
                  autoPlay={false}
                  playsInline
                  aria-label={t("replays.viewReplayAria", {
                    title: replay.title,
                    creator: replay.user?.username || "Foodstream",
                  })}
                  className="h-full w-full bg-black object-contain"
                >
                  <track kind="captions" />
                </video>

                {isHlsReplay && qualities.length > 1 ? (
                  <select
                    value={selectedQuality}
                    onChange={(e) => handleQualityChange(e.target.value)}
                    aria-label={t("replays.selectQualityAria")}
                    className="absolute right-5 top-5 z-20 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md outline-none"
                  >
                    {qualities.map((quality) => (
                      <option key={quality.value} value={quality.value}>
                        {quality.label}
                      </option>
                    ))}
                  </select>
                ) : null}

                {videoLoading ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="absolute inset-0 grid place-items-center bg-black/40"
                  >
                    <div className="rounded-2xl bg-black/50 px-4 py-3 text-sm font-semibold text-white backdrop-blur">
                      {t("replays.loadingVideo")}
                    </div>
                  </div>
                ) : null}

                {videoError ? (
                  <div
                    role="alert"
                    className="absolute inset-0 grid place-items-center bg-black/50 px-6"
                  >
                    <div className="rounded-2xl border border-red-400/40 bg-red-500/15 px-5 py-4 text-center text-sm font-semibold text-red-100 backdrop-blur">
                      {videoError}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <img
                  src={thumbnail}
                  alt=""
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/images/live-fallback.png";
                  }}
                  className="h-full w-full object-cover opacity-80"
                />

                <div aria-hidden="true" className="absolute inset-0 bg-black/35" />

                <div className="absolute inset-0 grid place-items-center">
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-full bg-white/95 px-5 py-3 text-sm font-bold text-gray-950 shadow-2xl"
                  >
                    {t("replays.preparing")}
                  </div>
                </div>
              </>
            )}

            <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-neutral-900">
              <PlayCircle aria-hidden="true" className="h-3.5 w-3.5" />
              {t("replays.badgeVideo")}
            </div>
          </div>

          <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white md:text-3xl">
                {replay.title}
              </h1>

              {cleanDescription ? (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {cleanDescription}
                </p>
              ) : (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500 dark:text-gray-400">
                  {t("replays.noDesc")}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {replay.tags?.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                  >
                    <Tag aria-hidden="true" className="h-3.5 w-3.5" />
                    {tag.name}
                  </span>
                ))}
              </div>

              {/* Recipe section if present */}
              {parsedRecipe &&
              (parsedRecipe.ingredients?.length ||
                parsedRecipe.prepSteps?.length ||
                parsedRecipe.cookingTimer) ? (
                <section
                  aria-label={t("replays.recipe")}
                  className="mt-8 rounded-3xl border border-black/8 bg-white/70 p-6 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-4 dark:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                        <ChefHat className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                          {t("replays.recipe")}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {replay.dish_name || t("replays.recipeSubtitle")}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {parsedRecipe.prepTimeMins ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("replays.prepTime", { mins: parsedRecipe.prepTimeMins })}
                        </span>
                      ) : null}

                      {parsedRecipe.cookingTimer ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("replays.cookTime", { mins: Math.round(parsedRecipe.cookingTimer / 60) })}
                        </span>
                      ) : null}

                      {parsedRecipe.restTimeMins ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("replays.restTime", { mins: parsedRecipe.restTimeMins })}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Utensils */}
                  {parsedRecipe.utensils && parsedRecipe.utensils.length > 0 ? (
                    <div className="mt-5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5 flex items-center gap-1.5">
                        <Utensils className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("replays.utensils")}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {parsedRecipe.utensils.map((ut, idx) => (
                          <span
                            key={idx}
                            className="rounded-xl border border-black/5 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 dark:border-white/5 dark:bg-white/5 dark:text-gray-300"
                          >
                            {ut}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Ingredients */}
                  {parsedRecipe.ingredients && parsedRecipe.ingredients.length > 0 ? (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          {t("replays.ingredients")}
                        </h3>
                        <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                          {t("replays.ingredientsReady", {
                            checked: checkedIngredients.size,
                            total: parsedRecipe.ingredients.length,
                            plural: checkedIngredients.size > 1 ? "s" : "",
                          })}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {parsedRecipe.ingredients.map((ing, idx) => {
                          const isChecked = checkedIngredients.has(idx);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => toggleIngredient(idx)}
                              className={`flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${
                                isChecked
                                  ? "border-green-500/30 bg-green-50/60 dark:bg-green-500/10"
                                  : "border-black/6 bg-white dark:border-white/5 dark:bg-white/[0.02] hover:border-orange-400/40"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg border transition ${
                                    isChecked
                                      ? "border-green-500 bg-green-500 text-white"
                                      : "border-gray-300 dark:border-gray-600 bg-transparent"
                                  }`}
                                >
                                  {isChecked ? (
                                    <Check className="h-3 w-3 stroke-[3]" />
                                  ) : null}
                                </div>
                                <span
                                  className={`text-sm font-medium truncate ${
                                    isChecked
                                      ? "text-gray-400 line-through dark:text-gray-500"
                                      : "text-gray-800 dark:text-gray-200"
                                  }`}
                                >
                                  {ing.name}
                                </span>
                              </div>
                              {ing.qty ? (
                                <span className="shrink-0 rounded-lg bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                                  {ing.qty}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Preparation Steps */}
                  {parsedRecipe.prepSteps && parsedRecipe.prepSteps.length > 0 ? (
                    <div className="mt-6">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                        {t("replays.prepSteps")}
                      </h3>
                      <div className="space-y-3">
                        {parsedRecipe.prepSteps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3.5 rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-white/[0.02]"
                          >
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-500 text-xs font-bold text-white shadow-sm">
                              {idx + 1}
                            </span>
                            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Plating Steps */}
                  {parsedRecipe.platingSteps && parsedRecipe.platingSteps.length > 0 ? (
                    <div className="mt-6">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                        {t("replays.platingSteps")}
                      </h3>
                      <div className="space-y-2.5">
                        {parsedRecipe.platingSteps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm dark:border-white/5 dark:bg-white/[0.02]"
                          >
                            <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>

            <aside aria-label={t("profile.public.info")} className="space-y-3">
              <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <User aria-hidden="true" className="h-4 w-4 text-orange-500" />
                  {t("replays.creator")}
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {replay.user?.username || "Chef Foodstream"}
                </p>
              </div>

              <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <Eye aria-hidden="true" className="h-4 w-4 text-orange-500" />
                  {t("replays.viewsLabel")}
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("replays.views", {
                    count: replay.view_count ?? 0,
                    plural: (replay.view_count ?? 0) > 1 ? "s" : "",
                  })}
                </p>
              </div>

              <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <CalendarDays
                    aria-hidden="true"
                    className="h-4 w-4 text-orange-500"
                  />
                  {t("replays.publishedOn")}
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {dateLabel}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>

      <HomeFooter />
    </main>
  );
}