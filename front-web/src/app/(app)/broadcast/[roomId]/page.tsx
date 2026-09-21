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
  getRooms,
  postChatMessage,
  kickParticipant,
  type ChatMessage,
  type RoomInfo,
} from "@/services/streaming";
import CookingAssistant from "@/components/watch/CookingAssistant";
import { getLiveByRoomId, type LiveDTO } from "@/lib/lives";

import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/lib/useAuth";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/LanguageContext";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  ArrowLeft,
  MessageCircle,
  Radio,
  SendHorizonal,
  Square,
  Users,
  Video,
} from "lucide-react";

const MAX_MSG = 500;

type HeaderActionsProps = {
  isHost: boolean;
  isStreaming: boolean;
  canLaunch: boolean;
  hasStarted: boolean;
  onLaunchLive: () => Promise<void>;
  onStopLive: () => Promise<void>;
};

function HeaderActions({
  isHost,
  isStreaming,
  canLaunch,
  hasStarted,
  onLaunchLive,
  onStopLive,
}: Readonly<HeaderActionsProps>) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hasStarted && isHost ? (
        <button
          disabled={!canLaunch}
          onClick={onLaunchLive}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-orange-500 px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          <Radio aria-hidden="true" className="h-4 w-4" />
          {t("broadcast.launchLive")}
        </button>
      ) : null}

      {isStreaming && isHost ? (
        <button
          onClick={onStopLive}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-red-500 px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(239,68,68,0.25)] transition hover:bg-red-400"
          type="button"
        >
          <Square aria-hidden="true" className="h-4 w-4" />
          {t("broadcast.stopLive")}
        </button>
      ) : null}
    </div>
  );
}

type LivePreviewProps = {
  isDisconnected: boolean;
  localStream: MediaStream | null;
  isStreaming: boolean;
  emptyStateMessage: string;
};

function LivePreview({
  isDisconnected,
  localStream,
  isStreaming,
  emptyStateMessage,
}: Readonly<LivePreviewProps>) {
  const { t } = useI18n();

  return (
    <div className="overflow-hidden rounded-[34px] border border-black/8 bg-white/75 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/65 dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 px-5 py-4 dark:border-white/10">
        <div>
          <div className="text-base font-bold text-gray-950 dark:text-white">
            {t("broadcast.previewTitle")}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("broadcast.previewDesc")}
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-white/[0.06] dark:text-gray-300"
        >
          {localStream ? t("broadcast.streamActive") : t("broadcast.streamWaiting")}
        </div>
      </div>

      <div className="relative aspect-video min-h-[260px] bg-black">
        {isDisconnected ? (
          <div className="absolute left-4 top-4 z-20 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
            {t("broadcast.liveEndedBadge")}
          </div>
        ) : null}

        {localStream ? (
          <StreamView stream={localStream} muted />
        ) : (
          <BroadcastEmptyState
            title={isDisconnected ? t("broadcast.status.offline") : t("broadcast.cameraInactive")}
            message={
              isDisconnected
                ? t("broadcast.liveEndedDesc")
                : emptyStateMessage
            }
          />
        )}

        {isStreaming ? (
          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
            <span
              aria-hidden="true"
              className="h-2 w-2 animate-pulse rounded-full bg-white"
            />
            <span>LIVE</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ChatPanelProps = {
  chatMessages: ChatMessage[];
  message: string;
  sending: boolean;
  scrollRef?: { current: HTMLDivElement | null };
  onMessageChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSendMessage: () => Promise<void>;
};

function ChatPanel({
  chatMessages,
  message,
  sending,
  scrollRef,
  onMessageChange,
  onKeyDown,
  onSendMessage,
}: Readonly<ChatPanelProps>) {
  const { t } = useI18n();

  return (
    <section
      className="flex h-[560px] flex-col overflow-hidden rounded-[30px] border border-black/8 bg-white/75 shadow-[0_16px_50px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/65 dark:shadow-[0_16px_50px_rgba(0,0,0,0.35)]"
      aria-labelledby="broadcast-chat-title"
    >
      <div className="flex items-center justify-between border-b border-black/8 px-4 py-4 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
          </div>

          <div>
            <h2
              id="broadcast-chat-title"
              className="text-sm font-bold text-gray-950 dark:text-white"
            >
              {t("broadcast.chatLive")}
            </h2>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t("watch.room.chatCount", {
                count: chatMessages.length,
                plural: chatMessages.length > 1 ? "s" : "",
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        aria-live="polite"
        aria-label={t("broadcast.chatInputAria")}
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {chatMessages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-6 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
            {t("broadcast.chatNoMessages")}
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-2xl bg-black/[0.03] px-3 py-2 text-sm dark:bg-white/[0.04]"
            >
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
            onChange={(e) => onMessageChange(e.target.value.slice(0, MAX_MSG))}
            onKeyDown={onKeyDown}
            placeholder={t("broadcast.chatPlaceholder")}
            aria-label={t("broadcast.chatInputAria")}
            maxLength={MAX_MSG}
            disabled={sending}
            className="min-w-0 flex-1 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#1b140e] dark:text-white"
          />

          <button
            onClick={onSendMessage}
            disabled={sending || !message.trim()}
            className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-4 text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            aria-label={t("broadcast.chatSendAria")}
          >
            <SendHorizonal aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 text-right text-[11px] text-gray-400 dark:text-gray-500">
          {message.length}/{MAX_MSG}
        </div>
      </div>
    </section>
  );
}

export default function BroadcastRoomPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const { t } = useI18n();

  const { user, token, ready } = useAuth();

  const roomIdFromUrl = useMemo(() => params?.roomId, [params]);

  const [liveInfo, setLiveInfo] = useState<LiveDTO | null>(null);

  const isHost = useMemo(() => {
    if (!liveInfo) return true;
    if (!user?.id || !liveInfo?.user?.id) return false;
    return String(user.id) === String(liveInfo.user.id);
  }, [user?.id, liveInfo]);

  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");

  const {
    state,
    roomId,
    localStream,
    remoteStreams,
    error,
    hostExistingRoom,
    joinAsCoStreamer,
    stopLive,
    removeRemoteStream,
  } = useWebRTC(token ?? undefined);

  const [hasStarted, setHasStarted] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const displayRoom = roomId ?? roomIdFromUrl;

  useEffect(() => {
    if (!ready || !token || !roomIdFromUrl || hasStarted || state !== "idle") return;

    if (mode === "join" && !isHost && liveInfo?.status === "live") {
      setHasStarted(true);
      joinAsCoStreamer(roomIdFromUrl).catch((err) => {
        console.error("Failed to join stream as viewer/co-streamer:", err);
      });
    }
  }, [ready, token, roomIdFromUrl, hasStarted, state, mode, isHost, liveInfo?.status, joinAsCoStreamer]);

  const { label: statusLabel, dotClassName } = getBroadcastStatusMeta(
    state as BroadcastState,
    t
  );

  const emptyStateMessage = getBroadcastEmptyStateMessage(
    ready,
    token,
    state as BroadcastState,
    t
  );

  const canLaunch = ready && !!token && !!roomIdFromUrl;
  const isStreaming = state === "live" || state === "connecting";
  const isDisconnected = state === "disconnected";

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
    await stopLive();
    router.replace("/home");
  };

  const handleKickParticipant = async (_index: number, stream: MediaStream) => {
    if (!displayRoom || !token) return;
    if (!window.confirm(t("broadcast.kickConfirm"))) return;

    try {
      await kickParticipant(displayRoom, { streamId: stream.id }, token);
    } catch (err) {
      console.warn("Kick participant error:", err);
    } finally {
      removeRemoteStream(stream.id);
    }
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

  const fetchRoom = useCallback(async () => {
    if (!displayRoom || !token) return;

    try {
      const rooms = await getRooms(token);
      const current = rooms?.find((r) => r.id === displayRoom) ?? null;
      setRoom(current);
    } catch (err) {
      console.warn("[ROOM] fetch failed:", err);
    }
  }, [displayRoom, token]);

  useEffect(() => {
    if (!ready || !token || !displayRoom) return;

    fetchChat();
    fetchRoom();

    getLiveByRoomId(displayRoom, token)
      .then((data) => setLiveInfo(data))
      .catch(() => setLiveInfo(null));

    const interval = window.setInterval(() => {
      fetchChat();
      fetchRoom();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [ready, token, displayRoom, fetchChat, fetchRoom]);

  // Derive real participants when people join the room (co-streamers, room participants, active chatters)
  const actualParticipants = useMemo(() => {
    const list: { username: string; progress?: number; step?: number }[] = [];
    const seen = new Set<string>();

    // 1. From remote video streams (connected co-streamers)
    remoteStreams.forEach((_, idx) => {
      const name = `Co-streamer ${idx + 1}`;
      if (!seen.has(name)) {
        seen.add(name);
        list.push({ username: name });
      }
    });

    // 2. From room participants registered in backend
    if (room?.participants && Array.isArray(room.participants)) {
      room.participants.forEach((p: any) => {
        const name = typeof p === "string" ? p : p?.username || p?.name;
        if (name && name !== user?.username && !seen.has(name)) {
          seen.add(name);
          list.push({ username: name });
        }
      });
    }

    // 3. From users active in the chat
    chatMessages.forEach((msg) => {
      if (msg.username && msg.username !== user?.username && !seen.has(msg.username)) {
        seen.add(msg.username);
        list.push({ username: msg.username });
      }
    });

    return list;
  }, [remoteStreams, room?.participants, chatMessages, user?.username]);

  const parsedRecipe = useMemo(() => {
    const rawDesc = liveInfo?.description || "";
    const marker = "---FOODSTREAM_RECIPE---";

    if (!rawDesc.includes(marker)) {
      return null;
    }

    const parts = rawDesc.split(marker);

    if (parts.length < 2) {
      return null;
    }

    try {
      return JSON.parse(parts[1].trim());
    } catch (error) {
      console.warn("Failed to parse cooking recipe for streamer room:", error);
      return null;
    }
  }, [liveInfo?.description]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (state === "disconnected") {
      router.replace("/home");
    }
  }, [state, router]);

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
    <main id="main-content" className="min-h-screen">
      <div className="mx-auto w-full max-w-375 px-4 py-5 sm:px-6 lg:py-7">
        <header className="mb-5 overflow-hidden rounded-[30px] border border-black/8 bg-white/75 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-[#120b05]/65 dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={handleBack}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/8 bg-white text-gray-900 shadow-sm transition hover:-translate-x-0.5 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
                type="button"
                aria-label={t("broadcast.backAria")}
              >
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                    {t("broadcast.studioTitle")}
                  </h1>

                  <BroadcastStatusPill
                    label={statusLabel}
                    dotClassName={dotClassName}
                  />
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{t("broadcast.modeHost")}</span>
                  <span
                    aria-hidden="true"
                    className="h-1 w-1 rounded-full bg-gray-300 dark:bg-white/30"
                  />
                  <span>
                    {t("broadcast.roomLabel")}{" "}
                    <strong className="font-semibold text-gray-700 dark:text-gray-200">
                      {displayRoom ? `${displayRoom.slice(0, 8)}…` : "—"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <HeaderActions
              isHost={isHost}
              isStreaming={isStreaming}
              canLaunch={canLaunch}
              hasStarted={hasStarted}
              onLaunchLive={handleLaunchLive}
              onStopLive={handleStopLive}
            />
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-700 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
          >
            {error}
          </div>
        ) : null}

        {!isHost && liveInfo?.status === "scheduled" && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm font-medium text-blue-700 backdrop-blur-sm dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-bold">{t("broadcast.scheduledNotStartedTitle")}</p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
                {t("broadcast.scheduledNotStartedDesc")}
              </p>
            </div>
            <button
              onClick={() => router.push("/home")}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shrink-0"
            >
              {t("common.back")}
            </button>
          </div>
        )}

        {isHost && liveInfo?.status === "scheduled" && !hasStarted && (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm font-medium text-orange-900 dark:text-orange-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
          >
            <div>
              <p className="font-bold flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <Radio className="h-4 w-4" />
                {t("broadcast.hostScheduledTitle")}
              </p>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                {t("broadcast.hostScheduledDesc")}
              </p>
            </div>
            <button
              disabled={!canLaunch}
              onClick={handleLaunchLive}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-orange-400 transition shrink-0"
            >
              <Radio className="h-4 w-4" />
              {t("broadcast.launchNowBtn")}
            </button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)_340px] xl:grid-cols-[400px_minmax(0,1fr)_360px] items-start">
          {/* LEFT COLUMN: Cuisine coop */}
          <aside className="space-y-5 order-2 lg:order-1" aria-label={t("broadcast.coopTitle")}>
            <section className="overflow-hidden rounded-[30px] border border-black/8 bg-white/75 shadow-[0_16px_50px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/65 dark:shadow-[0_16px_50px_rgba(0,0,0,0.35)] flex flex-col h-[780px] sticky top-6">
              <div className="flex items-center justify-between border-b border-black/8 px-5 py-4 dark:border-white/10">
                <div>
                  <h2 className="text-base font-bold text-gray-950 dark:text-white">
                    {t("broadcast.coopTitle")}
                  </h2>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t("broadcast.coopSubtitle")}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <CookingAssistant
                  dishName={liveInfo?.dish_name}
                  roomTitle={displayRoom ? `Studio ${displayRoom.slice(0, 8)}` : "Studio"}
                  roomParticipants={actualParticipants}
                  recipeData={parsedRecipe}
                />
              </div>
            </section>
          </aside>

          {/* CENTER COLUMN: Vidéo & Statistiques */}
          <section className="min-w-0 space-y-5 order-1 lg:order-2" aria-label={t("broadcast.previewTitle")}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-black/8 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
                <div className="mb-2 inline-flex rounded-2xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                  <Video aria-hidden="true" className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold text-gray-950 dark:text-white">
                  {state === "live" ? "ON" : "OFF"}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t("broadcast.statCamera")}
                </div>
              </div>

              <div className="rounded-3xl border border-black/8 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
                <div className="mb-2 inline-flex rounded-2xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                  <Users aria-hidden="true" className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold text-gray-950 dark:text-white">
                  {remoteStreams.length}/5
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t("broadcast.statCoStreamers")}
                </div>
              </div>

              <div className="rounded-3xl border border-black/8 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60">
                <div className="mb-2 inline-flex rounded-2xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold text-gray-950 dark:text-white">
                  {chatMessages.length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t("broadcast.statMessages")}
                </div>
              </div>
            </div>

            <LivePreview
              isDisconnected={isDisconnected}
              localStream={localStream}
              isStreaming={isStreaming}
              emptyStateMessage={emptyStateMessage}
            />
          </section>

          {/* RIGHT COLUMN: Co-streamers & Chat */}
          <aside className="space-y-5 order-3" aria-label={t("broadcast.coStreamersTitle")}>
            <section className="rounded-[30px] border border-black/8 bg-white/75 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/65 dark:shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-950 dark:text-white">
                    {t("broadcast.coStreamersTitle")}
                  </h2>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t("broadcast.coStreamersDesc")}
                  </div>
                </div>

                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                  {remoteStreams.length}/5
                </span>
              </div>

              {remoteStreams.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-6 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
                  {t("broadcast.noCoStreamers")}
                </div>
              ) : (
                <div className="grid gap-3">
                  {remoteStreams.map((stream, index) => (
                    <BroadcastRemoteCard
                      key={stream.id}
                      stream={stream}
                      index={index}
                      isHost={isHost}
                      onKick={() => handleKickParticipant(index, stream)}
                    />
                  ))}
                </div>
              )}
            </section>

            <ChatPanel
              chatMessages={chatMessages}
              message={message}
              sending={sending}
              onMessageChange={setMessage}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void onSendMessage();
                }
              }}
              onSendMessage={onSendMessage}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
