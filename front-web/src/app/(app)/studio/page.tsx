"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Radio,
  Calendar,
  Clock,
  Image as ImageIcon,
  Shield,
  Eye,
  Video,
  VideoOff,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";

type Level = "Débutant" | "Intermédiaire" | "Avancé";
type Visibility = "Public" | "Non listé" | "Privé";

const CUISINES = ["Asiatique", "Pâtisserie", "Street food", "Healthy", "BBQ", "Végétarien"];

type CreateRoomRes = { roomId: string };
type SdpAnswerRes = { sdp: string };

function joinRoomIdFromUrl(path: string) {
  return `/watch/${path}`;
}

function seconds(n: number) {
  return n * 1000;
}

function useMediaVideo(stream: MediaStream | null) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    (ref.current as any).srcObject = stream;
  }, [stream]);
  return ref;
}

export default function StudioPage() {
  const { token, user, ready } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState<string[]>(["Asiatique"]);
  const [level, setLevel] = useState<Level>("Débutant");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [duration, setDuration] = useState<number>(60);
  const [visibility, setVisibility] = useState<Visibility>("Public");
  const [imageUrl, setImageUrl] = useState<string>("");

  const [latency, setLatency] = useState<"Normale" | "Faible">("Normale");
  const [quality, setQuality] = useState<"Auto (1080p)" | "720p" | "480p">("Auto (1080p)");
  const [replays, setReplays] = useState<boolean>(true);
  const [chatActive, setChatActive] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [subsOnly, setSubsOnly] = useState(false);

  const [roomId, setRoomId] = useState<string>("");
  const [status, setStatus] = useState<
    "idle" | "creating" | "reserved" | "connecting" | "live" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);

  const localVideoRef = useMediaVideo(localStream);

  const previewTitle = title || "Ramen Tonkotsu en 30 minutes (aperçu)";
  const previewTags = useMemo(() => [tags[0] || "Asiatique", level], [tags, level]);

  const safeImage =
    imageUrl ||
    "https://images.unsplash.com/photo-1604908176997-431289f7c730?q=80&w=1200&auto=format&fit=crop";

  useEffect(() => {
    if (!ready) return;
    if (!token || !user) router.replace("/signin");
  }, [ready, token, user, router]);

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function buildPayload(status: "draft" | "scheduled" | "live") {
    const scheduledAt =
      date && time
        ? new Date(`${date}T${time}:00`).toISOString()
        : null;

    return {
      title: title.trim(),
      description: desc.trim(),
      tags,
      level,
      durationMinutes: duration,
      visibility,
      thumbnailUrl: imageUrl || null,
      chatActive,
      slowMode,
      subsOnly,
      replaysEnabled: replays,
      latencyMode: latency === "Faible" ? "low" : "normal",
      qualityPreset: quality,
      status,
      scheduledAt,
    };
  }

  async function createRoom(mode: "draft" | "scheduled" | "live") {
    if (!token) throw new Error("Missing token");

    const payload = buildPayload(mode);

    const res = await apiFetch<CreateRoomRes>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(payload),
      token,
    });

    setRoomId(res.roomId);
    return res.roomId;
  }

  async function reserveSpot(id: string) {
    if (!token) throw new Error("Missing token");
    await apiFetch(`/api/rooms/${id}/reserve`, {
      method: "POST",
      body: JSON.stringify({}),
      token,
    });
  }

  async function startWebRTC(id: string) {
    if (!token) throw new Error("Missing token");

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.ontrack = (ev) => {
      const s = ev.streams?.[0];
      if (!s) return;
      setRemoteStreams((prev) => {
        if (prev.some((x) => x.id === s.id)) return prev;
        return [...prev, s];
      });
    };

    pc.onicecandidate = async (ev) => {
      if (!ev.candidate) return;
      try {
        await apiFetch(`/api/ice?roomId=${encodeURIComponent(id)}`, {
          method: "POST",
          body: JSON.stringify({
            candidate: ev.candidate.toJSON?.() ?? ev.candidate,
          }),
          token,
        });
      } catch {}
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    setLocalStream(stream);

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await pc.setLocalDescription(offer);

    const answer = await apiFetch<SdpAnswerRes>(
      `/api/webrtc?roomId=${encodeURIComponent(id)}`,
      {
        method: "POST",
        body: JSON.stringify({ type: "offer", sdp: offer.sdp || "" }),
        token,
      }
    );

    await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
  }

  async function disconnect() {
    const id = roomId;

    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {}

    pcRef.current = null;

    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}

    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams([]);

    if (token && id) {
      try {
        await apiFetch(`/api/rooms/${id}/disconnect`, {
          method: "POST",
          body: JSON.stringify({}),
          token,
        });
      } catch {}
    }

    setStatus("idle");
  }

  async function onSaveDraft() {
    try {
      setError(null);
      setStatus("creating");
      await createRoom("draft");
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Erreur");
    }
  }

  async function onSchedule() {
    try {
      setError(null);
      setStatus("creating");
      const id = await createRoom("scheduled");
      setStatus("idle");
      router.push(joinRoomIdFromUrl(id));
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Erreur");
    }
  }

  async function onGoLiveNow() {
    try {
      setError(null);
      setStatus("creating");
      const id = await createRoom("live");

      setStatus("reserved");
      await reserveSpot(id);

      setStatus("connecting");
      await startWebRTC(id);

      setStatus("live");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Erreur");
    }
  }

  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();
  const prettyToday = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  if (!ready) {
    return (
      <main className="min-h-screen bg-neutral-50 text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-10">Chargement…</div>
      </main>
    );
  }

  if (!token || !user) return null;

  const watchUrl = roomId
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8081"}/api/hls/${roomId}/index.m3u8`
    : "";

  return (
    <main className="min-h-screen bg-neutral-50 text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
      <div className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-neutral-950/90">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded bg-orange-500">
              <Radio className="h-4 w-4 text-white" />
            </div>
            <div className="leading-none">
              <p className="text-[11px] uppercase text-gray-500 dark:text-white/60">
                FoodStream Studio
              </p>
              <p className="text-sm font-semibold">Créer un nouveau live</p>
            </div>
          </div>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <span className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-gray-600 dark:border-white/10 dark:text-white/70">
              {prettyToday}
            </span>
            {roomId ? (
              <span className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-gray-600 dark:border-white/10 dark:text-white/70">
                Room: <span className="font-mono">{roomId}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 text-gray-900 shadow-lg md:p-6 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400">
              <Radio className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-lg font-semibold">Paramètres du live</h2>
          </div>

          <Field label="Titre du live" hint="Un bon titre donne envie de cliquer et résume la recette.">
            <input
              className="input-dark"
              placeholder="Ex : Ramen Tonkotsu en 30 minutes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field
            label="Description"
            hint="Présente ton live, les étapes, le niveau de difficulté, les ustensiles à prévoir…"
          >
            <textarea
              className="input-dark min-h-[130px] resize-y"
              placeholder="Tu peux aussi coller la liste d’ingrédients ici, les viewers pourront la copier facilement."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cuisine / catégorie">
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((t) => (
                  <Chip key={t} active={tags.includes(t)} onClick={() => toggleTag(t)} label={t} />
                ))}
              </div>
            </Field>

            <Field label="Niveau" hint="Le niveau s’affichera sur la carte de ton live.">
              <div className="flex flex-wrap gap-2">
                {(["Débutant", "Intermédiaire", "Avancé"] as Level[]).map((l) => (
                  <Chip key={l} active={level === l} onClick={() => setLevel(l)} label={l} />
                ))}
              </div>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Date">
              <div className="relative">
                <input
                  type="date"
                  className="input-dark pl-10"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <Calendar className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-white/40" />
              </div>
            </Field>

            <Field label="Heure (heure locale)">
              <div className="relative">
                <input
                  type="time"
                  className="input-dark pl-10"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
                <Clock className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-white/40" />
              </div>
            </Field>
          </div>

          <Field label="Durée du live">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <input
                type="number"
                min={10}
                className="input-dark"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
              <span className="grid place-items-center rounded-xl border border-neutral-200 px-3 text-sm text-gray-700 dark:border-white/10 dark:text-white/70">
                minutes
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[30, 45, 60, 90].map((d) => (
                <Chip key={d} active={duration === d} onClick={() => setDuration(d)} label={`${d} min`} />
              ))}
            </div>
          </Field>

          <Field label="Visibilité">
            <div className="flex flex-wrap gap-2">
              {(["Public", "Non listé", "Privé"] as Visibility[]).map((v) => (
                <Chip key={v} active={visibility === v} onClick={() => setVisibility(v)} label={v} />
              ))}
            </div>
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Image du live">
              <div className="relative">
                <input
                  className="input-dark pl-10"
                  placeholder="URL de l’image (optionnel)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <ImageIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-white/40" />
              </div>
            </Field>

            <Field label="Chat & interaction">
              <div className="flex flex-wrap gap-2">
                <Chip active={chatActive} onClick={() => setChatActive((v) => !v)} label="Chat activé" />
                <Chip active={slowMode} onClick={() => setSlowMode((v) => !v)} label="Slow mode" />
                <Chip active={subsOnly} onClick={() => setSubsOnly((v) => !v)} label="Abonnés seulement" />
              </div>
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onSaveDraft}
              disabled={status !== "idle"}
              className="rounded-xl border border-neutral-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              Enregistrer le brouillon
            </button>

            <button
              onClick={onSchedule}
              disabled={status !== "idle"}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              <Radio className="h-4 w-4" />
              Planifier le live
            </button>

            <button
              onClick={onGoLiveNow}
              disabled={status !== "idle"}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Video className="h-4 w-4" />
              Démarrer maintenant
            </button>

            {status === "live" ? (
              <button
                onClick={disconnect}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-white/15 dark:hover:bg-white/10"
              >
                <VideoOff className="h-4 w-4" />
                Arrêter
              </button>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </p>
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-gray-900 shadow-lg dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/80">
              Aperçu de la carte live
            </h3>
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-neutral-800">
              <div className="relative h-40 w-full">
                <Image src={safeImage} alt={previewTitle} fill className="object-cover" />
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                  LIVE
                </span>
              </div>
              <div className="space-y-1 p-3">
                <div className="flex flex-wrap gap-2">
                  {previewTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-orange-100 dark:bg-white/5 dark:text-white/80 dark:ring-white/10"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="line-clamp-2 text-sm font-semibold">{previewTitle}</p>
                <p className="text-xs text-gray-500 dark:text-white/50">
                  par Vous • {date ? date : "Aujourd’hui"}, {time || "19:00"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-gray-900 shadow-lg dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400">
                <Users className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white/80">
                Prévisualisation WebRTC
              </h3>
            </div>

            <div className="overflow-hidden rounded-xl bg-black ring-1 ring-black/10">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full" />
            </div>

            <div className="mt-3 grid gap-2">
              {remoteStreams.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:text-white/60">
                  Aucun co-streamer connecté.
                </div>
              ) : (
                remoteStreams.map((s) => (
                  <RemoteTile key={s.id} stream={s} />
                ))
              )}
            </div>

            {roomId ? (
              <div className="mt-4 space-y-2 text-xs text-gray-600 dark:text-white/60">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <Link className="underline" href={`/watch/${roomId}`}>
                    Ouvrir en viewer (HLS)
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="font-mono break-all">{watchUrl}</span>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}

function RemoteTile({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    (ref.current as any).srcObject = stream;
  }, [stream]);

  return (
    <div className="overflow-hidden rounded-xl bg-black ring-1 ring-black/10">
      <video ref={ref} autoPlay playsInline className="w-full" />
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-semibold text-gray-800 dark:text-white/80">
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1 text-xs text-gray-500 dark:text-white/40">{hint}</p>
      ) : null}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm transition ${
        active
          ? "bg-gray-900 text-white dark:bg-white dark:text-neutral-900"
          : "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-white/5 dark:text-white/80 dark:ring-1 dark:ring-white/10 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

const _css = `
.input-dark {
  @apply w-full rounded-xl border px-3 py-2 text-sm outline-none ring-0
          border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-gray-900
          dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:focus:border-white/25;
}
`;
export const __keepTailwind = _css;
