"use client";

import BroadcastEmptyState from "@/components/broadcast/BroadcastEmptyState";
import BroadcastStatusPill from "@/components/broadcast/BroadcastStatusPill";
import VideoGrid, { type VideoTile } from "@/components/broadcast/VideoGrid";
import getBroadcastEmptyStateMessage from "@/components/broadcast/getBroadcastEmptyStateMessage";
import getBroadcastStatusMeta, {
  type BroadcastState,
} from "@/components/broadcast/getBroadcastStatusMeta";

import {
  getChatMessages,
  getRoom,
  getRooms,
  postChatMessage,
  kickParticipant,
  type ChatMessage,
  type RoomInfo,
} from "@/services/streaming";
import CookingAssistant from "@/components/watch/CookingAssistant";
import RecordingConsentDialog from "@/components/watch/RecordingConsentDialog";
import LiveDetailsCard from "@/components/broadcast/LiveDetailsCard";
import { getLiveByRoomId, updateLiveTags, type LiveDTO } from "@/lib/lives";

import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/lib/useAuth";
import { mergeChatMessages } from "@/lib/chatMessages";
import { usePolling } from "@/lib/usePolling";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/LanguageContext";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  ArrowLeft,
  BookOpen,
  MessageCircle,
  Mic,
  MicOff,
  Radio,
  SendHorizonal,
  Square,
  LogOut,
  Video,
  VideoOff,
  X,
} from "lucide-react";

const MAX_MSG = 500;

type PanelName = "chat" | "recipe";

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

type ToolbarButtonProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
  /** Visible text next to the icon (hidden on very small screens). */
  text?: string;
  pressed?: boolean;
  disabled?: boolean;
  tone?: "neutral" | "lit" | "off";
  badge?: boolean;
  /** Pressed state fills the button with a colour sliding in from this side. */
  slideFrom?: "left" | "right";
};

/** Round-ish icon button of the top bar (Teams-style). */
function ToolbarButton({
  label,
  onClick,
  children,
  text,
  pressed,
  disabled,
  tone = "neutral",
  badge,
  slideFrom,
}: Readonly<ToolbarButtonProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cx(
        "relative inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
        tone === "lit" &&
          "border-orange-500 bg-orange-500 text-[#1a0f05] shadow-[0_0_0_4px_rgba(249,115,22,0.18)] hover:bg-orange-400",
        tone === "off" &&
          "border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-300",
        tone === "neutral" &&
          (slideFrom
            ? cx(
                "border-black/10 bg-white transition-colors duration-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/10",
                pressed
                  ? "!border-orange-500 text-[#1a0f05] dark:!border-orange-500"
                  : "text-gray-800 dark:text-gray-100"
              )
            : pressed
              ? "border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-500/15 dark:text-orange-200"
              : "border-black/10 bg-white text-gray-800 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-100 dark:hover:bg-white/10")
      )}
    >
      {slideFrom ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          <span
            className={cx(
              "absolute inset-0 bg-orange-500 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              slideFrom === "left" ? "origin-left" : "origin-right",
              pressed ? "scale-x-100" : "scale-x-0"
            )}
          />
        </span>
      ) : null}
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
        {text ? <span className="hidden sm:inline">{text}</span> : null}
      </span>
      {badge ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-500 dark:border-neutral-950"
        />
      ) : null}
    </button>
  );
}

type SidePanelProps = {
  title: string;
  open: boolean;
  /** Which side of the cameras it is docked to (it slides in from that side). */
  side: "left" | "right";
  closeLabel: string;
  onClose: () => void;
  /** Most recently opened: sits above the other one when both are sheets on a small screen. */
  onTop?: boolean;
  children: ReactNode;
};

const PANEL_WIDTH = "lg:w-[320px] xl:w-[400px]";

/**
 * Drawer docked beside the stage on desktop (its width animates, so the cameras glide to make room),
 * and a sheet sliding up on small screens. Always mounted so its state survives; hidden from
 * keyboard and screen readers while closed.
 */
function SidePanel({ title, open, side, closeLabel, onClose, onTop, children }: Readonly<SidePanelProps>) {
  return (
    <aside
      aria-label={title}
      aria-hidden={!open}
      className={cx(
        "fixed inset-x-3 bottom-3 top-24 flex flex-col overflow-hidden rounded-[28px] border border-black/8 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.3)] dark:border-white/10 dark:bg-[#1f1712]",
        onTop ? "z-50" : "z-40",
        "transition-[transform,opacity,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        "lg:static lg:inset-auto lg:z-auto lg:shrink-0 lg:translate-y-0 lg:shadow-none",
        "lg:transition-[width,margin,opacity,visibility,border-width]",
        open
          ? `visible translate-y-0 opacity-100 ${PANEL_WIDTH}`
          : cx(
              "invisible translate-y-[110%] opacity-0 lg:w-0 lg:border-0",
              // The flex gap would leave a 12px hole next to a zero-width panel.
              side === "left" ? "lg:-mr-3" : "lg:-ml-3"
            )
      )}
    >
      {/* Fixed width so the content does not reflow while the drawer animates. */}
      <div className={cx("flex h-full min-h-0 w-full flex-col", PANEL_WIDTH)}>
        <header className="flex shrink-0 items-center justify-between border-b border-black/8 px-4 py-3 dark:border-white/10">
          <h2 className="text-sm font-bold text-gray-950 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            tabIndex={open ? 0 : -1}
            className="grid h-9 w-9 place-items-center rounded-xl text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </aside>
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
    <section className="flex h-full flex-col" aria-label={t("broadcast.chatLive")}>
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
              <div className="text-gray-700 dark:text-gray-300">{msg.message}</div>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-black/8 p-4 dark:border-white/10">
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(e) => onMessageChange(e.target.value.slice(0, MAX_MSG))}
            onKeyDown={onKeyDown}
            placeholder={t("broadcast.chatPlaceholder")}
            aria-label={t("broadcast.chatInputAria")}
            maxLength={MAX_MSG}
            disabled={sending}
            className="min-w-0 flex-1 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#1f1712] dark:text-white"
          />

          <button
            onClick={onSendMessage}
            disabled={sending || !message.trim()}
            className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-4 text-[#1a0f05] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            aria-label={t("broadcast.chatSendAria")}
          >
            <SendHorizonal aria-hidden="true" className="h-4 w-4" />
          </button>
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

  const isHost = !liveInfo
    ? true
    : Boolean(user?.id && liveInfo.user?.id && String(user.id) === String(liveInfo.user.id));

  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");

  const {
    state,
    roomId,
    localStream,
    remoteStreams,
    error,
    isAudioMuted,
    isVideoMuted,
    toggleAudio,
    toggleVideo,
    hostExistingRoom,
    joinAsCoStreamer,
    stopLive,
    removeRemoteStream,
  } = useWebRTC(token ?? undefined);

  const [hasStarted, setHasStarted] = useState(false);
  const [consentNeeded, setConsentNeeded] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Recipe opens on the left of the cameras, chat on the right; each toggles on its own.
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [lastOpened, setLastOpened] = useState<PanelName>("chat");
  const [seenChatCount, setSeenChatCount] = useState(0);
  const hasUnreadChat = !chatOpen && chatMessages.length > seenChatCount;

  // Messages that arrived while the chat was open are read: count them when it closes.
  const closeChat = () => {
    setChatOpen(false);
    setSeenChatCount(chatMessages.length);
  };

  const togglePanel = (name: PanelName) => {
    const isOpen = name === "chat" ? chatOpen : recipeOpen;
    if (name === "chat" && isOpen) {
      closeChat();
    } else {
      (name === "chat" ? setChatOpen : setRecipeOpen)(!isOpen);
    }
    if (!isOpen) setLastOpened(name);
  };

  const displayRoom = roomId ?? roomIdFromUrl;

  // Joining is started once: the ref keeps a re-render from starting it twice before the state follows.
  const autoJoinStartedRef = useRef(false);

  useEffect(() => {
    if (!ready || !token || !roomIdFromUrl || hasStarted || state !== "idle") return;
    if (autoJoinStartedRef.current) return;

    if (mode === "join" && !isHost && liveInfo?.status === "live" && !consentNeeded) {
      autoJoinStartedRef.current = true;
      joinAsCoStreamer(roomIdFromUrl)
        .then((result) => {
          // A recorded live: ask first, the person appears in the replay.
          if (result === "consent-required") {
            autoJoinStartedRef.current = false;
            setConsentNeeded(true);
          } else {
            setHasStarted(true);
          }
        })
        .catch((err) => {
          console.error("Failed to join stream as viewer/co-streamer:", err);
        });
    }
  }, [ready, token, roomIdFromUrl, hasStarted, state, mode, isHost, liveInfo?.status, joinAsCoStreamer, consentNeeded]);

  // Tags are optional at creation: the host can complete them from here until the live ends.
  const liveTagNames = useMemo(
    () => (liveInfo?.tags ?? []).map((tag) => tag.name),
    [liveInfo?.tags]
  );

  const handleSaveTags = useCallback(
    async (tags: string[]) => {
      if (!displayRoom || !token) throw new Error("Missing room or token");
      const updated = await updateLiveTags(displayRoom, tags, token);
      setLiveInfo((prev) => ({ ...(prev ?? updated), ...updated, tags: updated.tags ?? [] }));
    },
    [displayRoom, token]
  );

  const handleAcceptRecording = () => {
    if (!roomIdFromUrl) return;
    setConsentNeeded(false);
    setHasStarted(true);
    joinAsCoStreamer(roomIdFromUrl, { consentToRecording: true }).catch((err) => {
      console.error("Failed to join stream after consent:", err);
    });
  };

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

  // A co-streamer leaves: only their own connection and place are released, the live goes on.
  const handleLeaveLive = async () => {
    await stopLive();
    router.replace("/watch");
  };

  const handleKickParticipant = async (stream: MediaStream) => {
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
      // Same reference when nothing new: no re-render of the whole page every poll.
      setChatMessages((prev) => mergeChatMessages(prev, msgs ?? []));
    } catch (err) {
      console.warn("[CHAT] fetch failed:", err);
    }
  }, [displayRoom, token]);

  // Fetch only this room (not the list of every room); fall back to the list on an older backend.
  const singleRoomEndpointRef = useRef(true);

  const fetchRoom = useCallback(async () => {
    if (!displayRoom || !token) return;

    try {
      let current: RoomInfo | null = null;

      if (singleRoomEndpointRef.current) {
        try {
          current = await getRoom(displayRoom, token);
        } catch {
          singleRoomEndpointRef.current = false;
        }
      }
      if (!singleRoomEndpointRef.current) {
        const rooms = await getRooms(token);
        current = rooms?.find((r) => r.id === displayRoom) ?? null;
      }

      // Keep the previous object when nothing changed so memoised children do not re-render.
      setRoom((prev) =>
        prev && current && JSON.stringify(prev) === JSON.stringify(current) ? prev : current
      );
    } catch (err) {
      console.warn("[ROOM] fetch failed:", err);
    }
  }, [displayRoom, token]);

  const pollRoomAndChat = useCallback(() => {
    void fetchChat();
    void fetchRoom();
  }, [fetchChat, fetchRoom]);

  // One-off load: live details.
  useEffect(() => {
    if (!ready || !token || !displayRoom) return;

    getLiveByRoomId(displayRoom, token)
      .then((data) => setLiveInfo(data))
      .catch(() => setLiveInfo(null));
  }, [ready, token, displayRoom]);

  // Chat and room: right away, then every 3 s while the tab is visible (usePolling resyncs when it comes back).
  usePolling(pollRoomAndChat, 3000, Boolean(ready && token && displayRoom), {
    immediate: true,
    key: displayRoom,
  });

  // Who is cooking along: the people really connected to the room, by name. Reservations that never
  // connected, the host's own id and people who only chat are not "connected" and are left out.
  const actualParticipants = useMemo(() => {
    const info = room?.participantsInfo;
    if (info) {
      return info
        .filter((p) => p.connected && p.role !== "host" && p.username && p.username !== user?.username)
        .map((p) => ({ username: p.username }));
    }
    // Older backend without participant info: one entry per remote video stream.
    return remoteStreams.map((_, idx) => ({ username: `Co-streamer ${idx + 1}` }));
  }, [remoteStreams, room?.participantsInfo, user?.username]);

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
  // Always points at the latest handler; written after render (refs must not change during it).
  const kickRef = useRef(handleKickParticipant);
  useEffect(() => {
    kickRef.current = handleKickParticipant;
  });

  const placeholderTitle = isDisconnected ? t("broadcast.status.offline") : t("broadcast.cameraInactive");
  const placeholderMessage = isDisconnected ? t("broadcast.liveEndedDesc") : emptyStateMessage;
  const youLabel = t("liveRoom.you");

  // Stable while nothing about the cameras changes, so polling (chat/room) never re-renders the video tiles.
  const tiles: VideoTile[] = useMemo(() => [
    {
      id: "local",
      stream: localStream,
      label: youLabel,
      local: true,
      cameraOff: isVideoMuted,
      micOff: isAudioMuted,
      placeholder: <BroadcastEmptyState title={placeholderTitle} message={placeholderMessage} />,
    },
    ...remoteStreams.map((stream, index) => ({
      id: stream.id,
      stream,
      label: t("broadcast.participantLabel", { index: index + 1 }),
      onKick: isHost ? () => void kickRef.current(stream) : undefined,
    })),
  ], [localStream, remoteStreams, isVideoMuted, isAudioMuted, isHost, youLabel, placeholderTitle, placeholderMessage, t]);

  const hasLocalStream = Boolean(localStream);

  return (
    <main
      id="main-content"
      className="flex h-[calc(100dvh-8rem)] min-h-[520px] flex-col gap-3"
    >
      {consentNeeded ? (
        <RecordingConsentDialog
          onAccept={handleAcceptRecording}
          onCancel={() => router.back()}
        />
      ) : null}

      {/* Top bar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={handleBack}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/10 bg-white text-gray-900 shadow-sm transition hover:-translate-x-0.5 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/10"
            type="button"
            aria-label={t("broadcast.backAria")}
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </button>

          <h1 className="sr-only">{t("broadcast.studioTitle")}</h1>
          <BroadcastStatusPill label={statusLabel} dotClassName={dotClassName} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <ToolbarButton
            label={isVideoMuted ? t("broadcast.enableCam") : t("broadcast.disableCam")}
            onClick={toggleVideo}
            disabled={!hasLocalStream}
            tone={!hasLocalStream ? "neutral" : isVideoMuted ? "off" : "lit"}
          >
            {isVideoMuted ? (
              <VideoOff aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Video aria-hidden="true" className="h-5 w-5" />
            )}
          </ToolbarButton>

          <ToolbarButton
            label={isAudioMuted ? t("broadcast.unmuteMic") : t("broadcast.muteMic")}
            onClick={toggleAudio}
            disabled={!hasLocalStream}
            tone={isAudioMuted && hasLocalStream ? "off" : "neutral"}
          >
            {isAudioMuted ? (
              <MicOff aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Mic aria-hidden="true" className="h-5 w-5" />
            )}
          </ToolbarButton>

          <ToolbarButton
            label={t("liveRoom.recipe")}
            text={t("liveRoom.recipe")}
            onClick={() => togglePanel("recipe")}
            slideFrom="left"
            pressed={recipeOpen}
          >
            <BookOpen aria-hidden="true" className="h-5 w-5" />
          </ToolbarButton>

          <ToolbarButton
            label={t("broadcast.chatLive")}
            text={t("liveRoom.chat")}
            onClick={() => togglePanel("chat")}
            slideFrom="right"
            pressed={chatOpen}
            badge={hasUnreadChat}
          >
            <MessageCircle aria-hidden="true" className="h-5 w-5" />
          </ToolbarButton>

          {!hasStarted && isHost ? (
            <button
              disabled={!canLaunch}
              onClick={handleLaunchLive}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-orange-500 px-5 text-sm font-bold text-[#1a0f05] shadow-sm transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              <Radio aria-hidden="true" className="h-4 w-4" />
              {t("broadcast.launchLive")}
            </button>
          ) : null}

          {isStreaming && isHost ? (
            <button
              onClick={handleStopLive}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-red-500 px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(239,68,68,0.25)] transition hover:bg-red-400"
              type="button"
            >
              <Square aria-hidden="true" className="h-4 w-4" />
              {t("broadcast.stopLive")}
            </button>
          ) : null}

          {!isHost && (isStreaming || state === "creating") ? (
            <button
              onClick={handleLeaveLive}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-red-500/40 bg-white px-5 text-sm font-bold text-red-600 shadow-sm transition hover:bg-red-50 dark:bg-white/[0.06] dark:text-red-300 dark:hover:bg-red-500/10"
              type="button"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              {t("broadcast.leaveLive")}
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="shrink-0 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
        >
          {error}
        </div>
      ) : null}

      {!isHost && liveInfo?.status === "scheduled" && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200"
        >
          <div>
            <p className="font-bold">{t("broadcast.scheduledNotStartedTitle")}</p>
            <p className="mt-0.5 text-xs text-blue-600 dark:text-blue-300">
              {t("broadcast.scheduledNotStartedDesc")}
            </p>
          </div>
          <button
            onClick={() => router.push("/home")}
            className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-500"
          >
            {t("common.back")}
          </button>
        </div>
      )}

      {isHost && !hasStarted ? (
        <p className="shrink-0 text-xs text-gray-600 dark:text-gray-400">
          {t("broadcast.recordingNotice")}
        </p>
      ) : null}

      {isHost && !hasStarted && liveInfo && liveInfo.status !== "ended" ? (
        <LiveDetailsCard tags={liveTagNames} onSave={handleSaveTags} dismissKey={roomIdFromUrl} />
      ) : null}

      {/* Stage + drawers */}
      <div className="flex min-h-0 flex-1 gap-3">
        <SidePanel
          title={t("broadcast.coopTitle")}
          open={recipeOpen}
          side="left"
          closeLabel={t("common.close")}
          onClose={() => setRecipeOpen(false)}
          onTop={lastOpened === "recipe"}
        >
          <CookingAssistant
            dishName={liveInfo?.dish_name}
            roomTitle={displayRoom ? `Studio ${displayRoom.slice(0, 8)}` : "Studio"}
            roomParticipants={actualParticipants}
            recipeData={parsedRecipe}
          />
        </SidePanel>

        <section
          aria-label={t("broadcast.previewTitle")}
          className="min-w-0 flex-1 rounded-[28px] bg-neutral-950 p-3"
        >
          <VideoGrid tiles={tiles} />
        </section>

        <SidePanel
          title={t("broadcast.chatLive")}
          open={chatOpen}
          side="right"
          closeLabel={t("common.close")}
          onClose={closeChat}
          onTop={lastOpened === "chat"}
        >
          <ChatPanel
            chatMessages={chatMessages}
            message={message}
            sending={sending}
            scrollRef={chatScrollRef}
            onMessageChange={setMessage}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void onSendMessage();
              }
            }}
            onSendMessage={onSendMessage}
          />
        </SidePanel>
      </div>
    </main>
  );
}
