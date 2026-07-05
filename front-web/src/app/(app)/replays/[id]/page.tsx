"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  PlayCircle,
  Tag,
  User,
} from "lucide-react";

import HomeFooter from "@/components/home/HomeFooter";
import { getLiveByRoomId, type LiveDTO } from "@/lib/lives";

type QualityOption = {
  label: string;
  value: string;
};

function getPublicMediaUrl(path: string) {
  if (path.startsWith("http")) return path;

  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, "") || "";

  return `${baseUrl}${path}`;
}

export default function ReplayDetailPage() {
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
      setVideoError("Impossible de lire ce replay.");
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
  }, [replayUrl, isHlsReplay, applyQuality, selectedQuality]);

  const dateLabel = useMemo(() => {
    if (!replay?.created_at) return "Date inconnue";

    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(replay.created_at));
  }, [replay]);

  if (loading) {
    return (
      <main id="main-content" className="min-h-screen">
        <div
          role="status"
          aria-live="polite"
          aria-label="Chargement du replay"
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
            {error || "Replay introuvable."}
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
            Retour aux replays
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
                  aria-label={`Replay vidéo : ${replay.title}`}
                  className="h-full w-full bg-black object-contain"
                >
                  <track kind="captions" />
                </video>

                {isHlsReplay && qualities.length > 1 ? (
                  <select
                    value={selectedQuality}
                    onChange={(e) => handleQualityChange(e.target.value)}
                    aria-label="Choisir la qualité du replay"
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
                      Chargement du replay…
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
                  className="h-full w-full object-cover opacity-80"
                />

                <div aria-hidden="true" className="absolute inset-0 bg-black/35" />

                <div className="absolute inset-0 grid place-items-center">
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-full bg-white/95 px-5 py-3 text-sm font-bold text-gray-950 shadow-2xl"
                  >
                    Replay en préparation
                  </div>
                </div>
              </>
            )}

            <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-neutral-900">
              <PlayCircle aria-hidden="true" className="h-3.5 w-3.5" />
              REPLAY
            </div>
          </div>

          <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white md:text-3xl">
                {replay.title}
              </h1>

              {replay.description ? (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-400">
                  {replay.description}
                </p>
              ) : (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500 dark:text-gray-400">
                  Aucun descriptif pour ce replay.
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
            </div>

            <aside aria-label="Informations du replay" className="space-y-3">
              <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <User aria-hidden="true" className="h-4 w-4 text-orange-500" />
                  Créateur
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {replay.user?.username || "Chef Foodstream"}
                </p>
              </div>

              <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <Eye aria-hidden="true" className="h-4 w-4 text-orange-500" />
                  Vues
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {replay.view_count ?? 0} vue
                  {(replay.view_count ?? 0) > 1 ? "s" : ""}
                </p>
              </div>

              <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <CalendarDays
                    aria-hidden="true"
                    className="h-4 w-4 text-orange-500"
                  />
                  Publié le
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