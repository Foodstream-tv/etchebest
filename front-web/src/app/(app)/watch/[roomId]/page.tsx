"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageCircle,
  Radio,
  RefreshCcw,
  Share2,
  Users,
  ChefHat,
  CalendarClock,
  CalendarDays,
} from "lucide-react";
import {
  getHLSUrl,
  getChatMessages,
  postChatMessage,
  getRooms,
  ChatMessage,
  RoomInfo,
} from "@/services/streaming";
import { useAuth } from "@/lib/useAuth";
import HomeFooter from "@/components/home/HomeFooter";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import CookingAssistant from "@/components/watch/CookingAssistant";
import { getLiveByRoomId, type LiveDTO } from "@/lib/lives";
import { useI18n } from "@/i18n/LanguageContext";

type PlayerMode = "native" | "hlsjs" | "unsupported";

type QualityOption = {
  label: string;
  value: string;
};

const MAX_MSG = 500;

const mapLevelToHeight = (level: any) => level.height;
const filterValidHeight = (height: any): height is number => Boolean(height);
const sortDesc = (a: number, b: number) => b - a;
const formatQualityOption = (height: number): QualityOption => ({
  label: `${height}p`,
  value: String(height),
});
const noop = () => {};

function formatScheduledDate(value?: string | null, locale = "fr", fallback = "Date à venir") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function WatchRoomPage() {
  const { t, locale } = useI18n();
  const routeParams = useParams<{ roomId: string }>();
  const roomId = routeParams?.roomId;
  const { user, token } = useAuth();
  const [sidebarTab, setSidebarTab] = useState<"chat" | "cook">("chat");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const retryAttemptsRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [liveInfo, setLiveInfo] = useState<LiveDTO | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [playerMode, setPlayerMode] = useState<PlayerMode>("hlsjs");

  const [qualities, setQualities] = useState<QualityOption[]>([
    { label: "Auto", value: "auto" },
  ]);
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const [userSelectedQuality, setUserSelectedQuality] = useState<string | null>(
    null
  );

  const [isLiked, setIsLiked] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const isHost = useMemo(() => {
    if (!user?.id || !liveInfo?.user?.id) return false;
    return String(user.id) === String(liveInfo.user.id);
  }, [user?.id, liveInfo?.user?.id]);

  const isScheduled = liveInfo?.status === "scheduled";

  const hlsUrl = useMemo(() => {
    return roomId ? getHLSUrl(roomId) : "";
  }, [roomId]);

  const liveTitle = room?.name || liveInfo?.title || "Archive FoodStream";
  const viewers = room?.viewers ?? null;
  const participants = room?.participants?.length ?? null;
  const maxParticipants = room?.maxParticipants ?? null;

  const [parsedRecipe, liveDescription] = useMemo(() => {
    const rawDesc = liveInfo?.description || "Cette archive est accessible en replay pour revisualiser la recette et les échanges.";
    const marker = "---FOODSTREAM_RECIPE---";
    if (rawDesc.includes(marker)) {
      const parts = rawDesc.split(marker);
      const descriptionText = parts[0].trim();
      try {
        const recipeData = JSON.parse(parts[1].trim());
        return [recipeData, descriptionText];
      } catch (e) {
        console.error("Failed to parse recipe JSON:", e);
        return [null, descriptionText];
      }
    }
    return [null, rawDesc];
  }, [liveInfo?.description]);

  const fetchRoom = useCallback(async (isInitial = false) => {
    if (!roomId || !token) {
      setRoomLoading(false);
      return;
    }

    try {
      if (isInitial) {
        setRoomLoading(true);
      }
      const rooms = await getRooms(token);
      const currentRoom = rooms?.find((item) => item.id === roomId) ?? null;
      setRoom(currentRoom);

      try {
        const liveData = await getLiveByRoomId(roomId, token);
        setLiveInfo(liveData);
      } catch (err) {
        console.warn("Failed to fetch live info details:", err);
      }
    } catch (err) {
      console.error("Fetch room error:", err);
      setRoom(null);
    } finally {
      if (isInitial) {
        setRoomLoading(false);
      }
    }
  }, [roomId, token]);

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
    setUserSelectedQuality(value);
    setSelectedQuality(value);
    applyQuality(value);
  };

  const handleManifestParsed = useCallback(() => {
    const hls = hlsRef.current;
    const video = videoRef.current;
    if (!hls || !video) return;

    const levels = hls.levels
      .map(mapLevelToHeight)
      .filter(filterValidHeight);

    const uniqueLevels = Array.from(new Set(levels)).sort(sortDesc);

    setQualities([
      { label: "Auto", value: "auto" },
      ...uniqueLevels.map(formatQualityOption),
    ]);

    const qualityToApply = userSelectedQuality || selectedQuality;
    applyQuality(qualityToApply, hls);

    const playVideo = () => {
      setLoading(false);
      setError(null);
      video.play().catch(noop);
    };

    setTimeout(playVideo, 1200);

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [userSelectedQuality, selectedQuality, applyQuality, setQualities, setLoading, setError]);

  useEffect(() => {
    fetchRoom(true);

    if (!roomId || !token) return;

    const interval = setInterval(() => {
      fetchRoom(false);
    }, 10_000);
    return () => clearInterval(interval);
  }, [roomId, token, fetchRoom]);

  useEffect(() => {
    const video = videoRef.current;
    if (!roomId || !hlsUrl || !video) return;

    if (liveInfo?.status === "scheduled") {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setQualities([{ label: "Auto", value: "auto" }]);
    setUserSelectedQuality(null);
    setSelectedQuality("auto");
    retryAttemptsRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();

    const isSafari =
      typeof navigator !== "undefined" &&
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (!isSafari && Hls.isSupported()) {
      setPlayerMode("hlsjs");

      const maxRetries = 10;

      const handleHlsError = (_evt: any, data: any) => {
        if (!data?.fatal) return;

        const hls = hlsRef.current;
        if (!hls) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (retryAttemptsRef.current < maxRetries) {
            retryAttemptsRef.current += 1;
            const delay = Math.min(500 * retryAttemptsRef.current, 5000);

            setError(
              `En attente du stream... (${retryAttemptsRef.current}/${maxRetries})`
            );

            try {
              hls.destroy();
            } catch {}

            hlsRef.current = null;
            retryTimerRef.current = setTimeout(loadHLS, delay);
            return;
          }

          setLoading(false);
          setError("Stream indisponible.");

          try {
            hls.destroy();
          } catch {}

          hlsRef.current = null;
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          setError("Erreur média.");
          return;
        }

        setLoading(false);
        setError("Erreur lecture stream.");

        try {
          hls.destroy();
        } catch {}

        hlsRef.current = null;
      };

      const loadHLS = () => {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 900,
          maxBufferLength: 30,
          maxMaxBufferLength: 90,
        });

        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
        hls.on(Hls.Events.ERROR, handleHlsError);
      };

      loadHLS();

      return () => {
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }

        try {
          hlsRef.current?.destroy();
        } catch {}

        hlsRef.current = null;
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      setPlayerMode("native");
      video.src = hlsUrl;

      const onLoaded = () => {
        setLoading(false);
        video.play().catch(noop);
      };

      const onVideoError = () => {
        setLoading(false);
        setError("Impossible de charger le stream.");
      };

      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onVideoError);

      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onVideoError);
      };
    }

    setPlayerMode("unsupported");
    setLoading(false);
    setError("Navigateur non supporté.");
  }, [roomId, hlsUrl, reloadKey, applyQuality, handleManifestParsed]);

  const fetchChat = useCallback(async () => {
    if (!roomId || !token) return;

    try {
      const msgs = await getChatMessages(roomId, token);
      setChatMessages(msgs ?? []);
    } catch (err) {
      console.error("Fetch chat error:", err);
    }
  }, [roomId, token]);

  useEffect(() => {
    if (!roomId || !token) return;

    fetchChat();

    const interval = setInterval(fetchChat, 5000);
    return () => clearInterval(interval);
  }, [roomId, token, fetchChat]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  const onRetry = () => {
    setError(null);
    setLoading(true);
    setReloadKey((key) => key + 1);
    fetchRoom(true);
    fetchChat();
  };

  const onLike = () => {
    setIsLiked((prev) => !prev);
  };

  const onSendMessage = async () => {
    const trimmed = message.trim();

    if (!trimmed || !token || !roomId || sending) return;

    setMessage("");
    setSending(true);

    try {
      await postChatMessage(roomId, trimmed, token);
      await fetchChat();
    } catch {
      setMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  const onShare = async () => {
    const shareUrl =
      globalThis.window === undefined ? hlsUrl || "" : globalThis.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: liveTitle,
          text: "Voir cette rediffusion",
          url: shareUrl,
        });

        return;
      }

      await navigator.clipboard.writeText(shareUrl);
    } catch {}
  };

  return (
    <main id="main-content" className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/watch"
              className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg active:translate-y-0 active:scale-[0.98] dark:border-white/10 dark:bg-[#120b05]/60 dark:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Retour
            </Link>

            {liveInfo?.status === "live" ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span>En direct</span>
              </div>
            ) : isScheduled ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                <span>Planifié</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
                <span>Replay / archive</span>
              </div>
            )}

            {viewers !== null && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {viewers} spectateurs
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-black/8 bg-white/72 px-3 py-2 text-xs text-gray-500 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:text-gray-400">
              Room: {roomId ? `${roomId.slice(0, 8)}…` : "—"}
            </div>

            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg active:translate-y-0 active:scale-[0.98] dark:border-white/10 dark:bg-[#120b05]/60 dark:text-white"
              type="button"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              {t("watch.room.retry")}
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-6">
            <div className="overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              <div className="relative aspect-video bg-black">
                {isScheduled ? (
                  isHost ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-orange-950 via-neutral-900 to-black text-white">
                      <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-orange-500 text-white shadow-[0_0_30px_rgba(249,115,22,0.4)]">
                        <Radio className="h-8 w-8 animate-pulse" />
                      </div>
                      <h2 className="text-xl font-bold">{t("watch.room.hostScheduledTitle")}</h2>
                      <p className="mt-2 max-w-md text-sm text-gray-300">
                        {t("watch.room.hostScheduledDesc", {
                          date: formatScheduledDate(liveInfo?.scheduled_at, locale, t("watch.upcomingDate")),
                        })}
                      </p>
                      <Link
                        href={`/broadcast/${encodeURIComponent(roomId || "")}?mode=host`}
                        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(249,115,22,0.35)] transition hover:bg-orange-400 hover:scale-105 active:scale-95"
                      >
                        <Radio className="h-4 w-4" />
                        {t("watch.room.hostScheduledBtn")}
                      </Link>
                    </div>
                  ) : (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-blue-950 via-neutral-900 to-black text-white">
                      <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-400 shadow-lg">
                        <CalendarClock className="h-8 w-8" />
                      </div>
                      <h2 className="text-xl font-bold">{t("watch.room.viewerScheduledTitle")}</h2>
                      <p className="mt-2 max-w-md text-sm text-gray-300">
                        {t("watch.room.viewerScheduledDesc", {
                          date: formatScheduledDate(liveInfo?.scheduled_at, locale, t("watch.upcomingDate")),
                          creator: liveInfo?.user?.username ? ` par ${liveInfo.user.username}` : "",
                        })}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">
                        {t("watch.room.viewerScheduledNote")}
                      </p>
                    </div>
                  )
                ) : liveInfo?.status === "live" ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-red-950 via-neutral-900 to-black text-white">
                    <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                      <Radio className="h-8 w-8 animate-pulse" />
                    </div>
                    <h2 className="text-xl font-bold">{t("watch.room.liveNowTitle")}</h2>
                    <p className="mt-2 max-w-md text-sm text-gray-300">
                      {t("watch.room.liveNowDesc")}
                    </p>
                    {isHost ? (
                      <Link
                        href={`/broadcast/${encodeURIComponent(roomId || "")}?mode=host`}
                        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-orange-400 hover:scale-105 active:scale-95"
                      >
                        <Radio className="h-4 w-4" />
                        {t("watch.room.accessHostStudio")}
                      </Link>
                    ) : (
                      <Link
                        href={`/broadcast/${encodeURIComponent(roomId || "")}?mode=join`}
                        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-red-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(239,68,68,0.35)] transition hover:bg-red-400 hover:scale-105 active:scale-95"
                      >
                        <Radio className="h-4 w-4" />
                        {t("watch.room.joinLiveStream")}
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-neutral-900 text-white">
                    <p className="text-base font-semibold text-gray-300">{t("watch.room.offlineOrEnded")}</p>
                  </div>
                )}
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                {isHost && isScheduled && (
                  <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-orange-600 dark:text-orange-400 text-sm flex items-center gap-2">
                        <Radio className="h-4 w-4" />
                        {t("watch.room.creatorAccessTitle")}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        {t("watch.room.creatorAccessDesc")}
                      </p>
                    </div>
                    <Link
                      href={`/broadcast/${encodeURIComponent(roomId || "")}?mode=host`}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-bold text-white shrink-0 hover:bg-orange-400 transition shadow-md"
                    >
                      <Radio className="h-4 w-4" />
                      {t("watch.room.startLiveBtn")}
                    </Link>
                  </div>
                )}

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 sm:text-3xl">
                      {roomLoading ? t("common.loading") : liveTitle}
                    </h1>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {isScheduled
                        ? t("watch.room.scheduledFor", {
                            date: formatScheduledDate(liveInfo?.scheduled_at, locale, t("watch.upcomingDate")),
                          })
                        : t("watch.room.archiveLabel")}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={onLike}
                      aria-pressed={isLiked}
                      aria-label={isLiked ? t("watch.room.unlikeAria") : t("watch.room.likeAria")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:translate-y-0 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                      type="button"
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          isLiked ? "fill-red-500 text-red-500" : ""
                        }`}
                      />
                      {isLiked ? t("watch.room.liked") : t("watch.room.like")}
                    </button>

                    <button
                      onClick={onShare}
                      aria-label={t("watch.room.shareAria")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:translate-y-0 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                      type="button"
                    >
                      <Share2 className="h-4 w-4" />
                      {t("watch.room.share")}
                    </button>
                  </div>
                </div>

                <p className="text-sm leading-7 text-gray-600 dark:text-gray-300">
                  {liveDescription}
                </p>

                <div className="flex flex-wrap gap-2">
                  <InfoPill icon={<Eye className="h-4 w-4" />}>
                    {t("watch.room.streamerArchive")}
                  </InfoPill>

                  <InfoPill icon={<Radio className="h-4 w-4" />}>
                    {t("watch.room.playbackMode", { mode: playerMode })}
                  </InfoPill>

                  <InfoPill icon={<Radio className="h-4 w-4" />}>
                    {t("watch.room.quality", {
                      quality: selectedQuality === "auto" ? t("watch.room.auto") : `${selectedQuality}p`,
                    })}
                  </InfoPill>

                  {participants !== null && maxParticipants !== null && (
                    <InfoPill icon={<Users className="h-4 w-4" />}>
                      {t("watch.room.streamersCount", { count: participants, max: maxParticipants })}
                    </InfoPill>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                  >
                    {error}
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            <div className="flex h-full max-h-[760px] flex-col overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              {/* Tab Selector Header */}
              <div className="flex border-b border-black/8 dark:border-white/10 bg-white/20 dark:bg-black/30">
                <button
                  type="button"
                  onClick={() => setSidebarTab("chat")}
                  className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                    sidebarTab === "chat"
                      ? "border-orange-500 text-orange-600 dark:text-orange-400"
                      : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  {t("watch.room.tabChat")}
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab("cook")}
                  className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
                    sidebarTab === "cook"
                      ? "border-orange-500 text-orange-600 dark:text-orange-400"
                      : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  <ChefHat className="h-4 w-4" />
                  {t("watch.room.tabCook")}
                </button>
              </div>

              {sidebarTab === "chat" ? (
                <>
                  <div className="flex items-center justify-between border-b border-black/8 px-4 py-2 dark:border-white/10 bg-black/[0.01] dark:bg-black/[0.1] text-xs text-gray-500 dark:text-gray-400">
                    <span>{t("watch.room.chatHeading")}</span>
                    <span>{t("watch.room.chatCount", { count: chatMessages.length, plural: chatMessages.length > 1 ? "s" : "" })}</span>
                  </div>

                  <div
                    ref={chatScrollRef}
                    aria-live="polite"
                    aria-label={t("watch.room.chatHeading")}
                    className="flex h-[360px] flex-1 flex-col gap-3 overflow-y-auto bg-black/[0.02] px-4 py-4 dark:bg-white/[0.03]"
                  >
                    {chatMessages.length === 0 && (
                      <div className="grid flex-1 place-items-center text-center">
                        <div>
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
                            <MessageCircle className="h-5 w-5 text-gray-400" />
                          </div>

                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t("watch.room.chatNoMessages")}
                          </p>
                        </div>
                      </div>
                    )}

                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="text-sm leading-6">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {msg.username}
                        </span>

                        <span className="text-gray-400"> : </span>

                        <span className="text-gray-600 dark:text-gray-300">
                          {msg.message}
                        </span>
                      </div>
                    ))}
                  </div>

                  {token ? (
                    <div className="border-t border-black/8 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.02]">
                      <div className="space-y-3">
                        <input
                          value={message}
                          aria-label={t("watch.room.chatInputAria")}
                          onChange={(e) =>
                            setMessage(e.target.value.slice(0, MAX_MSG))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onSendMessage();
                          }}
                          placeholder={t("watch.room.chatPlaceholderShort")}
                          className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-[#1b140e] dark:text-white dark:placeholder:text-gray-500"
                          disabled={sending}
                          maxLength={MAX_MSG}
                        />

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-gray-400">
                            {message.length}/{MAX_MSG}
                          </span>

                          <button
                            onClick={onSendMessage}
                            style={{ background: ORANGE_GRADIENT_CSS }}
                            className="inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95 hover:shadow-[0_14px_32px_rgba(249,115,22,0.38)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                            type="button"
                            disabled={sending}
                          >
                            {sending ? t("watch.room.chatSending") : t("watch.room.chatSend")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-black/8 px-4 py-4 text-center dark:border-white/10">
                      <Link
                        href="/signin"
                        className="text-sm font-semibold text-orange-600 underline underline-offset-4 transition-colors duration-200 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200"
                      >
                        {t("watch.room.chatSignIn")}
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 overflow-hidden">
                  <CookingAssistant
                    dishName={liveInfo?.dish_name}
                    roomTitle={liveTitle}
                    roomParticipants={room?.participants}
                    recipeData={parsedRecipe}
                  />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <HomeFooter />
    </main>
  );
}

function InfoPill({
  children,
  icon,
}: Readonly<{
  children: React.ReactNode;
  icon: React.ReactNode;
}>) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-black/[0.03] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200">
      {icon}
      {children}
    </div>
  );
}