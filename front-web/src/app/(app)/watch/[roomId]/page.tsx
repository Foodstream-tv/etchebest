"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getHLSUrl } from "@/services/streaming";

type PlayerMode = "native" | "hlsjs" | "unsupported";

type ChatMessage = {
  id: number;
  user: string;
  text: string;
  time: string;
};

export default function WatchRoomPage() {
  const routeParams = useParams<{ roomId: string }>();
  const roomId = routeParams?.roomId;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [playerMode, setPlayerMode] = useState<PlayerMode>("hlsjs");

  const [viewerCount, setViewerCount] = useState(128);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(942);
  const [message, setMessage] = useState("");

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 1, user: "Lina", text: "Le live est super propre 🔥", time: "14:02" },
    { id: 2, user: "Max", text: "On t'entend bien maintenant", time: "14:03" },
    { id: 3, user: "Nina", text: "Montre l’interface mobile aussi 👀", time: "14:04" },
  ]);

  const hlsUrl = useMemo(() => {
    return roomId ? getHLSUrl(roomId) : "";
  }, [roomId]);

  const liveTitle = "Foodstream Live Session";
  const hostName = "Foodstream Creator";
  const liveDescription =
    "Regarde le live en direct et échange avec la communauté.";

  useEffect(() => {
    const video = videoRef.current;
    if (!roomId || !hlsUrl || !video) return;

    setLoading(true);
    setError(null);

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

      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
      });

      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data?.fatal) {
          setLoading(false);

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            setError("Erreur réseau HLS.");
            return;
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            setError("Erreur média HLS.");
            return;
          }

          setError(`Impossible de lire le stream HLS (${data.details || "fatal"}).`);

          try {
            hls.destroy();
          } catch {}
          hlsRef.current = null;
        }
      });

      return () => {
        try {
          hls.destroy();
        } catch {}
        hlsRef.current = null;
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      setPlayerMode("native");
      video.src = hlsUrl;

      const onLoaded = () => {
        setLoading(false);
        video.play().catch(() => {});
      };

      const onVideoError = () => {
        setLoading(false);
        setError("Impossible de charger le stream HLS.");
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
    setError("HLS non supporté sur ce navigateur.");
  }, [roomId, hlsUrl, reloadKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(1, prev + delta);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  const onRetry = () => {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const onLike = () => {
    setIsLiked((prev) => {
      const next = !prev;
      setLikeCount((count) => (next ? count + 1 : Math.max(0, count - 1)));
      return next;
    });
  };

  const onSendMessage = () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        user: "You",
        text: trimmed,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    setMessage("");
  };

  const onShare = async () => {
    const shareUrl =
      typeof window !== "undefined" ? window.location.href : hlsUrl || "";

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
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={topBarStyle}>
          <div style={topLeftStyle}>
            <Link href="/watch" style={ghostLinkStyle}>
              ← Retour
            </Link>

            <div style={livePillStyle}>
              <span style={liveDotStyle} />
              En direct
            </div>

            <div style={metaTextStyle}>
              {viewerCount} spectateurs
            </div>
          </div>

          <div style={topRightStyle}>
            <div style={metaTextStyle}>
              Room: {roomId ? `${roomId.slice(0, 8)}…` : "—"}
            </div>

            <button onClick={onRetry} style={ghostButtonStyle}>
              Réessayer
            </button>
          </div>
        </div>

        <div style={layoutStyle}>
          <section style={mainColumnStyle}>
            <div style={playerCardStyle}>
              <div style={videoWrapStyle}>
                <video
                  key={`${roomId ?? "no-room"}-${reloadKey}`}
                  ref={videoRef}
                  controls
                  playsInline
                  style={videoStyle}
                />

                {loading && (
                  <div style={loadingOverlayStyle}>
                    Préparation du stream…
                  </div>
                )}
              </div>

              <div style={contentStyle}>
                <div style={titleRowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <h1 style={titleStyle}>{liveTitle}</h1>
                    <div style={subTextStyle}>par {hostName}</div>
                  </div>

                  <div style={actionsStyle}>
                    <button onClick={onLike} style={ghostButtonStyle}>
                      {isLiked ? "❤️" : "🤍"} {likeCount}
                    </button>
                    <button onClick={onShare} style={ghostButtonStyle}>
                      Partager
                    </button>
                  </div>
                </div>

                <p style={descriptionStyle}>{liveDescription}</p>

                <div style={infoRowStyle}>
                  <span style={softBadgeStyle}>{viewerCount} viewers</span>
                  <span style={softBadgeStyle}>Mode: {playerMode}</span>
                </div>

                {error && (
                  <div style={errorStyle}>
                    {error}
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside style={sideColumnStyle}>
            <div style={chatCardStyle}>
              <div style={chatHeaderStyle}>
                <div style={chatTitleStyle}>Chat</div>
                <div style={metaTextStyle}>{chatMessages.length} messages</div>
              </div>

              <div ref={chatScrollRef} style={chatListStyle}>
                {chatMessages.map((msg) => (
                  <div key={msg.id} style={chatMessageStyle}>
                    <div style={chatMetaRowStyle}>
                      <span style={chatUserStyle}>{msg.user}</span>
                      <span style={chatTimeStyle}>{msg.time}</span>
                    </div>
                    <div style={chatTextStyle}>{msg.text}</div>
                  </div>
                ))}
              </div>

              <div style={chatInputAreaStyle}>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSendMessage();
                  }}
                  placeholder="Écrire un message..."
                  style={inputStyle}
                />
                <button onClick={onSendMessage} style={primaryButtonStyle}>
                  Envoyer
                </button>
              </div>
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

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const topLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const topRightStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 340px",
  gap: 16,
  alignItems: "start",
};

const mainColumnStyle: React.CSSProperties = {
  minWidth: 0,
};

const sideColumnStyle: React.CSSProperties = {
  minWidth: 0,
};

const playerCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  overflow: "hidden",
  background: "#ffffff",
  boxShadow: "0 8px 30px rgba(17, 24, 39, 0.04)",
};

const videoWrapStyle: React.CSSProperties = {
  position: "relative",
  background: "#d1d5db",
};

const videoStyle: React.CSSProperties = {
  width: "100%",
  height: 620,
  maxHeight: "78vh",
  background: "#000",
  display: "block",
};

const loadingOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "rgba(17, 24, 39, 0.18)",
  color: "#ffffff",
  fontWeight: 700,
};

const contentStyle: React.CSSProperties = {
  padding: 20,
  display: "grid",
  gap: 14,
};

const titleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.1,
  fontWeight: 800,
  color: "#111827",
};

const subTextStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#6b7280",
};

const descriptionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  color: "#4b5563",
};

const infoRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const softBadgeStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const chatCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  background: "#ffffff",
  overflow: "hidden",
  boxShadow: "0 8px 30px rgba(17, 24, 39, 0.04)",
};

const chatHeaderStyle: React.CSSProperties = {
  padding: "16px 16px 12px",
  borderBottom: "1px solid #eef0f3",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const chatTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 16,
  color: "#111827",
};

const chatListStyle: React.CSSProperties = {
  height: 420,
  overflowY: "auto",
  padding: 16,
  display: "grid",
  gap: 10,
  background: "#fafafa",
};

const chatMessageStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: 12,
  background: "#ffffff",
  border: "1px solid #eceff3",
};

const chatMetaRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 6,
};

const chatUserStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#111827",
};

const chatTimeStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#9ca3af",
};

const chatTextStyle: React.CSSProperties = {
  color: "#4b5563",
  lineHeight: 1.5,
  fontSize: 14,
};

const chatInputAreaStyle: React.CSSProperties = {
  padding: 14,
  borderTop: "1px solid #eef0f3",
  display: "grid",
  gap: 10,
  background: "#ffffff",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#111827",
  padding: "12px 14px",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "11px 16px",
  fontWeight: 600,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "11px 16px",
  fontWeight: 600,
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
};

const ghostLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "11px 16px",
  fontWeight: 600,
  background: "#ffffff",
  color: "#111827",
};

const livePillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #fee2e2",
  background: "#fff1f2",
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 700,
};

const liveDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#ef4444",
  display: "inline-block",
};

const metaTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
};

const errorStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#dc2626",
};
