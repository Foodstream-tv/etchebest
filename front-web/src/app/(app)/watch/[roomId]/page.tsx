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

export default function WatchRoomPage() {
  const routeParams = useParams<{ roomId: string }>();
  const roomId = routeParams?.roomId;
  const { token } = useAuth();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const retryAttemptsRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);

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

  const hlsUrl = useMemo(() => {
    return roomId ? getHLSUrl(roomId) : "";
  }, [roomId]);

  const liveTitle = room?.name || "Live en direct";
  const viewers = room?.viewers ?? null;
  const participants = room?.participants?.length ?? null;
  const maxParticipants = room?.maxParticipants ?? null;

  const liveDescription =
    "Regarde le live en direct et échange avec la communauté.";

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
          text: "Regarde ce live",
          url: shareUrl,
        });

        return;
      }

      await navigator.clipboard.writeText(shareUrl);
    } catch {}
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/watch"
              className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg active:translate-y-0 active:scale-[0.98] dark:border-white/10 dark:bg-[#120b05]/60 dark:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>

            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span>En direct</span>
            </div>

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
              <RefreshCcw className="h-4 w-4" />
              Réessayer
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-6">
            <div className="overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              <div className="relative bg-black">
                <video
                  key={`${roomId ?? "no-room"}-${reloadKey}`}
                  ref={videoRef}
                  controls
                  playsInline
                  className="block h-[260px] w-full bg-black sm:h-[380px] lg:h-[520px]"
                >
                  <track kind="captions" />
                </video>

                {playerMode === "hlsjs" && qualities.length > 1 && (
                  <select
                    value={selectedQuality}
                    onChange={(e) => handleQualityChange(e.target.value)}
                    className="absolute right-3 top-3 z-20 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md outline-none"
                  >
                    {qualities.map((quality) => (
                      <option key={quality.value} value={quality.value}>
                        {quality.label}
                      </option>
                    ))}
                  </select>
                )}

                {loading && (
                  <div className="absolute inset-0 grid place-items-center bg-black/40">
                    <div className="rounded-2xl bg-black/40 px-4 py-3 text-sm font-semibold text-white backdrop-blur">
                      Préparation du stream…
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 sm:text-3xl">
                      {roomLoading ? "Chargement du live..." : liveTitle}
                    </h1>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Diffusion FoodStream
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={onLike}
                      className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:translate-y-0 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                      type="button"
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          isLiked ? "fill-red-500 text-red-500" : ""
                        }`}
                      />
                      {isLiked ? "Aimé" : "J’aime"}
                    </button>

                    <button
                      onClick={onShare}
                      className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:translate-y-0 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                      type="button"
                    >
                      <Share2 className="h-4 w-4" />
                      Partager
                    </button>
                  </div>
                </div>

                <p className="text-sm leading-7 text-gray-600 dark:text-gray-300">
                  {liveDescription}
                </p>

                <div className="flex flex-wrap gap-2">
                  {viewers !== null && (
                    <InfoPill icon={<Eye className="h-4 w-4" />}>
                      {viewers} viewers
                    </InfoPill>
                  )}

                  <InfoPill icon={<Radio className="h-4 w-4" />}>
                    Mode: {playerMode}
                  </InfoPill>

                  <InfoPill icon={<Radio className="h-4 w-4" />}>
                    Qualité:{" "}
                    {selectedQuality === "auto"
                      ? "Auto"
                      : `${selectedQuality}p`}
                  </InfoPill>

                  {participants !== null && maxParticipants !== null && (
                    <InfoPill icon={<Users className="h-4 w-4" />}>
                      {participants}/{maxParticipants} streamers
                    </InfoPill>
                  )}
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            <div className="flex h-full max-h-[760px] flex-col overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between border-b border-black/8 px-4 py-4 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-orange-500" />
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    Chat
                  </div>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {chatMessages.length} messages
                </div>
              </div>

              <div
                ref={chatScrollRef}
                className="flex h-[360px] flex-1 flex-col gap-3 overflow-y-auto bg-black/[0.02] px-4 py-4 dark:bg-white/[0.03]"
              >
                {chatMessages.length === 0 && (
                  <div className="grid flex-1 place-items-center text-center">
                    <div>
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
                        <MessageCircle className="h-5 w-5 text-gray-400" />
                      </div>

                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Aucun message pour l’instant.
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
                      onChange={(e) =>
                        setMessage(e.target.value.slice(0, MAX_MSG))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onSendMessage();
                      }}
                      placeholder="Écrire un message..."
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
                        {sending ? "Envoi..." : "Envoyer"}
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
                    Connectez-vous pour chatter
                  </Link>
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