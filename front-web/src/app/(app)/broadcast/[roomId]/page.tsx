"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import StreamView from "@/components/StreamView";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/lib/useAuth";

export default function BroadcastRoomPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const params = useParams<{ roomId: string }>();

  const { token, ready } = useAuth();

  const mode = sp.get("mode") ?? "host";
  const isHost = mode !== "join";

  const roomIdFromUrl = useMemo(() => params?.roomId, [params]);

  // ✅ IMPORTANT: on passe le token au hook
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

  // Auto-join si mode=join (co-streamer)
  useEffect(() => {
    if (!ready) return;
    if (!token) return; // ✅ évite les 401
    if (!roomIdFromUrl) return;

    if (!isHost && !hasStarted) {
      setHasStarted(true);
      joinAsCoStreamer(roomIdFromUrl);
    }
  }, [ready, token, isHost, roomIdFromUrl, hasStarted, joinAsCoStreamer]);

  const displayRoom = roomId ?? roomIdFromUrl;

  return (
    <div style={{ padding: 24, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={async () => {
            await stopLive();
            router.back();
          }}
        >
          ← Retour
        </button>

        <div style={{ fontWeight: 800 }}>
          {state === "live"
            ? "🔴 EN DIRECT"
            : state === "connecting"
            ? "Connexion…"
            : state === "creating"
            ? "Création…"
            : "Prêt"}
        </div>

        <div style={{ opacity: 0.7, marginLeft: "auto" }}>
          Room: {displayRoom ? `${displayRoom.slice(0, 8)}…` : "—"}
        </div>

        {roomIdFromUrl ? (
          <Link href={`/watch/${encodeURIComponent(roomIdFromUrl)}`} style={{ marginLeft: 12 }}>
            Ouvrir le viewer (HLS)
          </Link>
        ) : null}
      </div>

      {/* petit bandeau si auth pas prête */}
      {!ready && <div style={{ opacity: 0.75 }}>Chargement de la session…</div>}
      {ready && !token && (
        <div style={{ color: "tomato" }}>
          Non authentifié. Connecte-toi pour lancer/rejoindre un live.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div style={{ height: 520 }}>
          {localStream ? (
            <StreamView stream={localStream} muted />
          ) : (
            <div
              style={{
                height: "100%",
                borderRadius: 12,
                background: "#111",
                display: "grid",
                placeItems: "center",
              }}
            >
              <div style={{ opacity: 0.8 }}>
                {!ready
                  ? "Chargement…"
                  : !token
                  ? "Connecte-toi pour activer la caméra"
                  : state === "creating"
                  ? "Création…"
                  : state === "connecting"
                  ? "Connexion…"
                  : "Caméra non active"}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {remoteStreams.map((s) => (
            <div key={s.id} style={{ height: 160 }}>
              <StreamView stream={s} />
            </div>
          ))}
          {remoteStreams.length === 0 && (
            <div style={{ opacity: 0.6, fontSize: 13 }}>Aucun co-streamer pour l’instant</div>
          )}
        </div>
      </div>

      {error && <div style={{ color: "tomato" }}>{error}</div>}

      <div style={{ display: "flex", gap: 12 }}>
        {!hasStarted && isHost && (
          <button
            disabled={!ready || !token || !roomIdFromUrl}
            onClick={async () => {
              if (!ready || !token) return;
              if (!roomIdFromUrl) return;

              setHasStarted(true);
              await hostExistingRoom(roomIdFromUrl);
            }}
          >
            Lancer le live
          </button>
        )}

        {(state === "live" || state === "connecting") && (
          <button onClick={stopLive}>Arrêter</button>
        )}
      </div>
    </div>
  );
}
