"use client";

import StreamView from "@/components/StreamView";
import BroadcastEmptyState from "@/components/broadcast/BroadcastEmptyState";
import BroadcastRemoteCard from "@/components/broadcast/BroadcastRemoteCard";
import BroadcastStatusPill from "@/components/broadcast/BroadcastStatusPill";
import getBroadcastEmptyStateMessage from "@/components/broadcast/getBroadcastEmptyStateMessage";
import getBroadcastStatusMeta, {
  type BroadcastState,
} from "@/components/broadcast/getBroadcastStatusMeta";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const autoJoinRoomRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    if (!roomIdFromUrl) return;
    if (isHost) return;
    if (autoJoinRoomRef.current === roomIdFromUrl) return;

    autoJoinRoomRef.current = roomIdFromUrl;

    joinAsCoStreamer(roomIdFromUrl).catch(() => {
      if (autoJoinRoomRef.current === roomIdFromUrl) {
        autoJoinRoomRef.current = null;
      }
    });
  }, [ready, token, isHost, roomIdFromUrl, joinAsCoStreamer]);

  const displayRoom = roomId ?? roomIdFromUrl;
  const viewerHref = displayRoom ? `/watch/${encodeURIComponent(displayRoom)}` : null;

  const { label: statusLabel, dotClassName } = getBroadcastStatusMeta(
    state as BroadcastState
  );

  const emptyStateMessage = getBroadcastEmptyStateMessage(
    ready,
    token,
    state as BroadcastState
  );

  const handleBack = async () => {
    await stopLive();
    router.back();
  };

  const handleLaunchLive = async () => {
    if (!ready || !token || !roomIdFromUrl) return;
    setHasStarted(true);
    await hostExistingRoom(roomIdFromUrl);
  };

  const canLaunch = ready && !!token && !!roomIdFromUrl;

  return (
    <main className="min-h-screen">
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleBack}
              className="rounded-xl border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm backdrop-blur-md transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
            >
              ← Retour
            </button>

            <BroadcastStatusPill label={statusLabel} dotClassName={dotClassName} />

            <div className="text-sm text-gray-500 dark:text-gray-400">
              {isHost ? "Host" : "Co-streamer"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Room: {displayRoom ? `${displayRoom.slice(0, 8)}…` : "—"}
            </div>

            {viewerHref ? (
              <Link
                href={viewerHref}
                className="rounded-xl border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm backdrop-blur-md transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
              >
                Viewer
              </Link>
            ) : null}
          </div>
        </header>

        {!ready ? (
          <div className="rounded-2xl border border-black/8 bg-white/72 px-4 py-3 text-sm text-gray-500 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400">
            Chargement de la session…
          </div>
        ) : null}

        {ready && !token ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            Non authentifié. Connecte-toi pour lancer ou rejoindre un live.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <section className="min-w-0">
            <div className="overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 px-4 py-4 dark:border-white/10">
                <div>
                  <div className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                    Studio live
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Prévisualisation de ton flux principal
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!hasStarted && isHost ? (
                    <button
                      disabled={!canLaunch}
                      onClick={handleLaunchLive}
                      className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      Lancer le live
                    </button>
                  ) : null}

                  {state === "live" || state === "connecting" ? (
                    <button
                      onClick={async () => {
                        await stopLive();
                      }}
                      className="rounded-xl border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm backdrop-blur-md transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
                    >
                      Arrêter
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="h-[56vw] min-h-[220px] max-h-[72vh] bg-black lg:h-[560px]">
                {localStream ? (
                  <StreamView stream={localStream} muted />
                ) : (
                  <BroadcastEmptyState
                    title="Caméra non active"
                    message={emptyStateMessage}
                  />
                )}
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            <div className="grid gap-3 rounded-[28px] border border-black/8 bg-white/72 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                Co-streamers
              </div>

              {remoteStreams.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Aucun co-streamer pour l’instant
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
          </aside>
        </div>
      </div>
    </main>
  );
}