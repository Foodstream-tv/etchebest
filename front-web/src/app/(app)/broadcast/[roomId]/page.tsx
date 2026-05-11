"use client";

import StreamView from "@/components/StreamView";
import BroadcastEmptyState from "@/components/broadcast/BroadcastEmptyState";
import BroadcastRemoteCard from "@/components/broadcast/BroadcastRemoteCard";
import BroadcastStatusPill from "@/components/broadcast/BroadcastStatusPill";
import getBroadcastEmptyStateMessage from "@/components/broadcast/getBroadcastEmptyStateMessage";
import getBroadcastStatusMeta, {
  type BroadcastState,
} from "@/components/broadcast/getBroadcastStatusMeta";

import {
  getChatMessages,
  postChatMessage,
  type ChatMessage,
} from "@/services/streaming";

import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/lib/useAuth";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Eye,
  MessageCircle,
  Radio,
  SendHorizonal,
  Square,
  Users,
  Video,
} from "lucide-react";

const MAX_MSG = 500;

export default function BroadcastRoomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ roomId: string }>();

  const { token, ready } = useAuth();

  const mode = searchParams.get("mode") ?? "host";
  const isHost = mode !== "join";
  const roomIdFromUrl = useMemo(() => params?.roomId, [params]);

  const {
    state,
    roomId,
    localStream,
    remoteStreams,
    error,
    hostExistingRoom,
    joinAsCoStreamer,
    stopLive,
  } = useWebRTC(token ?? undefined);

  const [hasStarted, setHasStarted] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [liveEnded, setLiveEnded] = useState(false);
  
  const autoJoinRoomRef = useRef<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (!ready || !token || !roomIdFromUrl || isHost) return;
    if (autoJoinRoomRef.current === roomIdFromUrl) return;

    autoJoinRoomRef.current = roomIdFromUrl;

    joinAsCoStreamer(roomIdFromUrl).catch(() => {
      if (autoJoinRoomRef.current === roomIdFromUrl) {
        autoJoinRoomRef.current = null;
      }
    });
  }, [ready, token, isHost, roomIdFromUrl, joinAsCoStreamer]);

  const displayRoom = roomId ?? roomIdFromUrl;
  const viewerHref = displayRoom
    ? `/watch/${encodeURIComponent(displayRoom)}`
    : null;

  const { label: statusLabel, dotClassName } = getBroadcastStatusMeta(
    state as BroadcastState
  );

  const emptyStateMessage = getBroadcastEmptyStateMessage(
    ready,
    token,
    state as BroadcastState
  );

  const canLaunch = ready && !!token && !!roomIdFromUrl;
  const isStreaming = state === "live" || state === "connecting";

  const handleBack = async () => {
    await stopLive();
    router.back();
  };

  const handleLaunchLive = async () => {
    if (!ready || !token || !roomIdFromUrl || hasStarted) return;

    setHasStarted(true);
    await hostExistingRoom(roomIdFromUrl);
  };

  const handleStopLive = async () => {
    setLiveEnded(true);
    await stopLive();
  };

  const fetchChat = useCallback(async () => {
    if (!displayRoom || !token) return;

    try {
      const msgs = await getChatMessages(displayRoom, token);
      setChatMessages(msgs ?? []);
    } catch (err) {
      console.warn("[CHAT] fetch failed:", err);
    }
  }, [displayRoom, token]);

  useEffect(() => {
    if (!ready || !token || !displayRoom) return;

    fetchChat();

    const interval = window.setInterval(fetchChat, 3000);
    return () => window.clearInterval(interval);
  }, [ready, token, displayRoom, fetchChat]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  const onSendMessage = async () => {
    const trimmed = message.trim();

    if (!trimmed || !displayRoom || !token || sending) return;

    setSending(true);
    setMessage("");

    try {
      await postChatMessage(displayRoom, trimmed, token);
      await fetchChat();
    } catch (err) {
      console.warn("[CHAT] send failed:", err);
      setMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:py-7">
        <header className="mb-5 overflow-hidden rounded-[30px] border border-black/8 bg-white/75 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-[#120b05]/65 dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={handleBack}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/8 bg-white text-gray-900 shadow-sm transition hover:-translate-x-0.5 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
                type="button"
                aria-label="Retour"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                    Studio de diffusion
                  </h1>

                  <BroadcastStatusPill
                    label={statusLabel}
                    dotClassName={dotClassName}
                  />
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{isHost ? "Mode Host" : "Mode Co-streamer"}</span>
                  <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-white/30" />
                  <span>
                    Room{" "}
                    <strong className="font-semibold text-gray-700 dark:text-gray-200">
                      {displayRoom ? `${displayRoom.slice(0, 8)}…` : "—"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {viewerHref ? (
                <Link
                  href={viewerHref}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-black/8 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
                >
                  <Eye className="h-4 w-4" />
                  Voir côté viewer
                </Link>
              ) : null}

              {!hasStarted && isHost ? (
                <button
                  disabled={!canLaunch}
                  onClick={handleLaunchLive}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-orange-500 px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                >
                  <Radio className="h-4 w-4" />
                  Lancer le live
                </button>
              ) : null}

              {isStreaming ? (
                <button
                  onClick={handleStopLive}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-red-500 px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(239,68,68,0.25)] transition hover:bg-red-400"
                  type="button"
                >
                  <Square className="h-4 w-4" />
                  Arrêter
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-700 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,860px)_380px] xl:justify-center xl:items-start">
          <section className="min-w-0 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-black/8 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
                <div className="mb-2 inline-flex rounded-2xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                  <Video className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold text-gray-950 dark:text-white">
                  {state === "live" ? "ON" : "OFF"}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Caméra
                </div>
              </div>

              <div className="rounded-3xl border border-black/8 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
                <div className="mb-2 inline-flex rounded-2xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                  <Users className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold text-gray-950 dark:text-white">
                  {remoteStreams.length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Co-streamers
                </div>
              </div>

              <div className="rounded-3xl border border-black/8 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
                <div className="mb-2 inline-flex rounded-2xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold text-gray-950 dark:text-white">
                  {chatMessages.length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Messages
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[34px] border border-black/8 bg-white/75 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/65 dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 px-5 py-4 dark:border-white/10">
                <div>
                  <div className="text-base font-bold text-gray-950 dark:text-white">
                    Prévisualisation du live
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Aperçu caméra diffusé aux spectateurs
                  </div>
                </div>

                <div className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
                  {localStream ? "Flux local actif" : "En attente caméra"}
                </div>
              </div>
        
              <div className="relative aspect-video min-h-[260px] bg-black">
                {liveEnded ? (
                  <div className="absolute left-4 top-4 z-20 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                    LIVE TERMINÉ
                  </div>
                ) : null}
                {localStream ? (
                  <StreamView stream={localStream} muted />
                ) : (
                  <BroadcastEmptyState
                    title={
                      liveEnded
                        ? "Live terminé"
                        : "Caméra non active"
                    }
                    message={
                      liveEnded
                        ? "Le live est maintenant hors ligne."
                        : emptyStateMessage
                    }
                  />
                )}

                {isStreaming ? (
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    LIVE
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="grid gap-5">
            <div className="rounded-[30px] border border-black/8 bg-white/75 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/65 dark:shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-gray-950 dark:text-white">
                    Co-streamers
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Participants vidéo connectés
                  </div>
                </div>

                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                  {remoteStreams.length}
                </span>
              </div>

              {remoteStreams.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-6 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
                  Aucun co-streamer connecté.
                </div>
              ) : (
                <div className="grid gap-3">
                  {remoteStreams.map((stream, index) => (
                    <BroadcastRemoteCard
                      key={stream.id}
                      stream={stream}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex h-[560px] flex-col overflow-hidden rounded-[30px] border border-black/8 bg-white/75 shadow-[0_16px_50px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/65 dark:shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between border-b border-black/8 px-4 py-4 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
                    <MessageCircle className="h-4 w-4" />
                  </div>

                  <div>
                    <div className="text-sm font-bold text-gray-950 dark:text-white">
                      Chat live
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {chatMessages.length} message(s)
                    </div>
                  </div>
                </div>
              </div>

              <div
                ref={chatScrollRef}
                className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
              >
                {chatMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-6 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
                    Aucun message pour l’instant.
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="rounded-2xl bg-black/[0.03] px-3 py-2 text-sm dark:bg-white/[0.04]">
                      <div className="mb-0.5 font-semibold text-gray-900 dark:text-gray-100">
                        {msg.username}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        {msg.message}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-black/8 p-4 dark:border-white/10">
                <div className="flex gap-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_MSG))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSendMessage();
                    }}
                    placeholder="Écrire un message..."
                    className="min-w-0 flex-1 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-[#1b140e] dark:text-white"
                  />

                  <button
                    onClick={onSendMessage}
                    disabled={sending || !message.trim()}
                    className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-4 text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                  >
                    <SendHorizonal className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 text-right text-[11px] text-gray-400 dark:text-gray-500">
                  {message.length}/{MAX_MSG}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}