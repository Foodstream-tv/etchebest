"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getHLSUrl, getChatMessages, postChatMessage, ChatMessage } from "@/services/streaming";
import { useAuth } from "@/lib/useAuth";

type PlayerMode = "native" | "hlsjs" | "unsupported";

const MAX_MSG = 500;

export default function WatchRoomPage() {
  const routeParams = useParams<{ roomId: string }>();
  const roomId = routeParams?.roomId;
  const { token } = useAuth();

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
  const [sending, setSending] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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

      let retryAttempts = 0;
      const maxRetries = 10;
      let retryTimer: NodeJS.Timeout | null = null;

      const loadHLS = () => {
        const hls = new Hls({
          lowLatencyMode: true,
          backBufferLength: 30,
        });

        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          setError(null);
          if (retryTimer) clearTimeout(retryTimer);
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data?.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Retry with exponential backoff for 404 errors
              if (retryAttempts < maxRetries) {
                retryAttempts++;
                const delay = Math.min(500 * retryAttempts, 5000);
                setError(`En attente du HLS... (tentative ${retryAttempts}/${maxRetries})`);
                
                try {
                  hls.destroy();
                } catch {}
                hlsRef.current = null;

                retryTimer = setTimeout(() => {
                  loadHLS();
                }, delay);
                return;
              } else {
                setLoading(false);
                setError("Erreur réseau HLS - dépassement des tentatives.");
                try {
                  hls.destroy();
                } catch {}
                hlsRef.current = null;
                return;
              }
            }

            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
              setError("Erreur média HLS.");
              return;
            }

            setLoading(false);
            setError(`Impossible de lire le stream HLS (${data.details || "fatal"}).`);

            try {
              hls.destroy();
            } catch {}
            hlsRef.current = null;
          }
        });
      };

      loadHLS();

      return () => {
        if (retryTimer) clearTimeout(retryTimer);
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

  const fetchChat = useCallback(async () => {
    if (!roomId) return;
    try {
      const msgs = await getChatMessages(roomId, token);
      setChatMessages(msgs ?? []);
    } catch {}
  }, [roomId, token]);

  useEffect(() => {
    fetchChat();
    const interval = setInterval(fetchChat, 5000);
    return () => clearInterval(interval);
  }, [fetchChat]);

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
      <style>{`
        @media (max-width: 900px) {
          .watch-layout { grid-template-columns: 1fr !important; }
          .watch-video { height: 56vw !important; max-height: 400px !important; }
          .chat-list { height: 280px !important; }
        }
      `}</style>

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

        <div className="watch-layout" style={layoutStyle}>
          <section style={mainColumnStyle}>
            <div style={playerCardStyle}>
              <div style={videoWrapStyle}>
                <video
                  key={`${roomId ?? "no-room"}-${reloadKey}`}
                  ref={videoRef}
                  controls
                  playsInline
                  className="watch-video"
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

              <div ref={chatScrollRef} className="chat-list" style={chatListStyle}>
                {chatMessages.length === 0 && (
                  <div style={chatEmptyStyle}>Aucun message pour l&apos;instant.</div>
                )}
                {chatMessages.map((msg) => (
                  <div key={msg.id} style={chatLineStyle}>
                    <span style={chatUserStyle}>{msg.username}</span>
                    <span style={chatSepStyle}>: </span>
                    <span style={chatTextStyle}>{msg.message}</span>
                  </div>
                ))}
              </div>

              {token ? (
                <div style={chatInputAreaStyle}>
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_MSG))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSendMessage();
                    }}
                    placeholder="Écrire un message..."
                    style={inputStyle}
                    disabled={sending}
                    maxLength={MAX_MSG}
                  />
                  <div style={inputFooterStyle}>
                    <span style={charCountStyle}>{message.length}/{MAX_MSG}</span>
                    <button onClick={onSendMessage} style={primaryButtonStyle} disabled={sending}>
                      {sending ? "…" : "Envoyer"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={chatLoginPromptStyle}>
                  <Link href="/login" style={chatLoginLinkStyle}>Connectez-vous pour chatter</Link>
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
  background: "#000",
};

const videoStyle: React.CSSProperties = {
  width: "100%",
  height: 560,
  maxHeight: "72vh",
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
  fontSize: 22,
  lineHeight: 1.2,
  fontWeight: 800,
  color: "#111827",
};

const subTextStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
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
  padding: "5px 10px",
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
  display: "flex",
  flexDirection: "column",
};

const chatHeaderStyle: React.CSSProperties = {
  padding: "14px 16px 12px",
  borderBottom: "1px solid #eef0f3",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexShrink: 0,
};

const chatTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
  color: "#111827",
};

const chatListStyle: React.CSSProperties = {
  height: 420,
  overflowY: "auto",
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  background: "#fafafa",
  flexShrink: 0,
};

const chatLineStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const chatUserStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#111827",
};

const chatSepStyle: React.CSSProperties = {
  color: "#9ca3af",
};

const chatTextStyle: React.CSSProperties = {
  color: "#4b5563",
};

const chatInputAreaStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid #eef0f3",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  background: "#ffffff",
  flexShrink: 0,
};

const inputFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const charCountStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#9ca3af",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#111827",
  padding: "9px 12px",
  outline: "none",
  fontSize: 13,
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 14px",
  fontWeight: 600,
  fontSize: 13,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  flexShrink: 0,
};

const ghostButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "9px 14px",
  fontWeight: 600,
  fontSize: 13,
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
};

const ghostLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "9px 14px",
  fontWeight: 600,
  fontSize: 13,
  background: "#ffffff",
  color: "#111827",
};

const livePillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 12px",
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

const chatEmptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#9ca3af",
  textAlign: "center",
  padding: "24px 0",
};

const chatLoginPromptStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderTop: "1px solid #eef0f3",
  textAlign: "center",
  flexShrink: 0,
};

const chatLoginLinkStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#111827",
  textDecoration: "underline",
};

const errorStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#dc2626",
};
