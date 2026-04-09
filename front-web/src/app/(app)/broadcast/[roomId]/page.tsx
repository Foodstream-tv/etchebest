"use client";

import StreamView from "@/components/StreamView";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type BroadcastState = ReturnType<typeof useWebRTC>["state"];

function getStatusMeta(state: BroadcastState): { label: string; dotColor: string } {
  switch (state) {
    case "live":
      return { label: "En direct", dotColor: "#ef4444" };
    case "connecting":
      return { label: "Connexion…", dotColor: "#f59e0b" };
    case "creating":
      return { label: "Création…", dotColor: "#3b82f6" };
    default:
      return { label: "Prêt", dotColor: "#9ca3af" };
  }
}

function getEmptyStateMessage(
  ready: boolean,
  token: string | null | undefined,
  state: BroadcastState
): string {
  if (!ready) {
    return "Chargement…";
  }

  if (!token) {
    return "Connecte-toi pour activer la caméra.";
  }

  if (state === "creating") {
    return "Création en cours…";
  }

  if (state === "connecting") {
    return "Connexion en cours…";
  }

  return "Le flux local n’est pas encore disponible.";
}

export default function BroadcastRoomPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const params = useParams<{ roomId: string }>();

  const { token, ready } = useAuth();

  const mode = sp.get("mode") ?? "host";
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
  const { label: statusLabel, dotColor: statusDotColor } = getStatusMeta(state);
  const emptyStateMessage = getEmptyStateMessage(ready, token, state);

  async function handleBack() {
    await stopLive();
    router.back();
  }

  return (
    <div style={pageStyle}>
      <style>{`
        @media (max-width: 900px) {
          .broadcast-layout { grid-template-columns: 1fr !important; }
          .broadcast-video-frame { height: 56vw !important; min-height: 200px !important; max-height: 400px !important; }
          .broadcast-remote-video { height: 130px !important; }
        }
      `}</style>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <div style={headerLeftStyle}>
            <button onClick={handleBack} style={ghostButtonStyle}>
              ← Retour
            </button>

            <div style={statusPillStyle}>
              <span
                style={{
                  ...statusDotStyle,
                  background: statusDotColor,
                }}
              />
              <span>{statusLabel}</span>
            </div>

            <div style={subtleTextStyle}>{isHost ? "Host" : "Co-streamer"}</div>
          </div>

          <div style={headerRightStyle}>
            <div style={subtleTextStyle}>
              Room: {displayRoom ? `${displayRoom.slice(0, 8)}…` : "—"}
            </div>

            {viewerHref ? (
              <Link href={viewerHref} style={ghostLinkStyle}>
                Viewer
              </Link>
            ) : null}
          </div>
        </header>

        {!ready && <div style={infoStyle}>Chargement de la session…</div>}

        {ready && !token && (
          <div style={errorStyle}>
            Non authentifié. Connecte-toi pour lancer ou rejoindre un live.
          </div>
        )}

        {error && <div style={errorStyle}>{error}</div>}

        <div className="broadcast-layout" style={layoutStyle}>
          <section style={mainColumnStyle}>
            <div style={videoCardStyle}>
              <div style={videoHeaderStyle}>
                <div>
                  <div style={titleStyle}>Studio live</div>
                  <div style={captionStyle}>Prévisualisation de ton flux principal</div>
                </div>

                <div style={actionsRowStyle}>
                  {!hasStarted && isHost && (
                    <button
                      disabled={!ready || !token || !roomIdFromUrl}
                      onClick={async () => {
                        if (!ready || !token || !roomIdFromUrl) return;
                        setHasStarted(true);
                        await hostExistingRoom(roomIdFromUrl);
                      }}
                      style={{
                        ...primaryButtonStyle,
                        opacity: !ready || !token || !roomIdFromUrl ? 0.55 : 1,
                        cursor:
                          !ready || !token || !roomIdFromUrl
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      Lancer le live
                    </button>
                  )}

                  {(state === "live" || state === "connecting") && (
                    <button
                      onClick={async () => {
                        await stopLive();
                      }}
                      style={ghostButtonStyle}
                    >
                      Arrêter
                    </button>
                  )}
                </div>
              </div>

              <div className="broadcast-video-frame" style={videoFrameStyle}>
                {localStream ? (
                  <StreamView stream={localStream} muted />
                ) : (
                  <div style={emptyStateStyle}>
                    <div style={emptyTitleStyle}>Caméra non active</div>
                    <div style={emptyTextStyle}>{emptyStateMessage}</div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside style={sideColumnStyle}>
            <div style={sideCardStyle}>
              <div style={sideTitleStyle}>Co-streamers</div>

              {remoteStreams.length === 0 ? (
                <div style={captionStyle}>Aucun co-streamer pour l’instant</div>
              ) : (
                <div style={remoteListStyle}>
                  {remoteStreams.map((stream, index) => (
                    <div key={stream.id} style={remoteCardStyle}>
                      <div style={remoteLabelStyle}>Participant {index + 1}</div>
                      <div className="broadcast-remote-video" style={remoteVideoStyle}>
                        <StreamView stream={stream} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f7f8fb",
  color: "#111827",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1400,
  margin: "0 auto",
  padding: "24px 20px 32px",
  display: "grid",
  gap: 16,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const headerLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const headerRightStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: 16,
  alignItems: "start",
};

const mainColumnStyle: React.CSSProperties = {
  minWidth: 0,
};

const sideColumnStyle: React.CSSProperties = {
  minWidth: 0,
};

const videoCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  background: "#ffffff",
  overflow: "hidden",
  boxShadow: "0 8px 30px rgba(17, 24, 39, 0.04)",
};

const videoHeaderStyle: React.CSSProperties = {
  padding: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  borderBottom: "1px solid #eef0f3",
};

const videoFrameStyle: React.CSSProperties = {
  height: 560,
  maxHeight: "72vh",
  background: "#111",
};

const sideCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  background: "#ffffff",
  padding: 14,
  display: "grid",
  gap: 12,
  boxShadow: "0 8px 30px rgba(17, 24, 39, 0.04)",
};

const sideTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#111827",
};

const remoteListStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 12,
};

const remoteCardStyle: React.CSSProperties = {
  border: "1px solid #edf0f2",
  borderRadius: 16,
  overflow: "hidden",
  background: "#fafafa",
};

const remoteLabelStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#6b7280",
  borderBottom: "1px solid #edf0f2",
  background: "#ffffff",
};

const remoteVideoStyle: React.CSSProperties = {
  height: 170,
  background: "#d1d5db",
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#111827",
};

const captionStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
};

const subtleTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
};

const actionsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const statusPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  fontSize: 13,
  fontWeight: 600,
  color: "#111827",
};

const statusDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  display: "inline-block",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 600,
  background: "#111827",
  color: "#ffffff",
};

const ghostButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 600,
  background: "#ffffff",
  color: "#111827",
};

const ghostLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 600,
  background: "#ffffff",
  color: "#111827",
};

const infoStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 14,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#4b5563",
};

const errorStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#dc2626",
};

const emptyStateStyle: React.CSSProperties = {
  height: "100%",
  display: "grid",
  placeItems: "center",
  padding: 24,
  textAlign: "center",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(243,244,246,0.95))",
};

const emptyTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 8,
  color: "#111827",
};

const emptyTextStyle: React.CSSProperties = {
  maxWidth: 360,
  fontSize: 14,
  lineHeight: 1.6,
  color: "#6b7280",
};
