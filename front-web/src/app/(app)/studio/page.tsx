"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Calendar, Clock, Image as ImageIcon, Radio, Video } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";

type Level = "Débutant" | "Intermédiaire" | "Avancé";
type Visibility = "Public" | "Non listé" | "Privé";

const CUISINES = ["Asiatique", "Pâtisserie", "Street food", "Healthy", "BBQ", "Végétarien"];

type CreateRoomRes = { roomId: string };

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

  const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token || !user) router.replace("/signin");
  }, [ready, token, user, router]);

  const previewTitle = title.trim() || "Ramen Tonkotsu en 30 minutes";
  const previewTags = useMemo(() => [tags[0] || "Asiatique", level], [tags, level]);
  const safeImage = imageUrl?.trim() || "/images/live-fallback.jpg";

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function buildScheduledAt(): string | null {
    if (!date || !time) return null;
    // Local time -> ISO UTC
    const dt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }

  function buildPayload(mode: "draft" | "scheduled" | "live") {
    const scheduledAt = buildScheduledAt();
    const roomName = title.trim() || `Live ${new Date().toISOString()}`;

    return {
      // Backend compatibility:
      name: roomName,
      title: roomName,

      description: desc.trim(),
      tags,
      level,
      durationMinutes: duration,
      visibility,
      thumbnailUrl: imageUrl?.trim() || null,

      chatActive,
      slowMode,
      subsOnly,
      replaysEnabled: replays,

      latencyMode: latency === "Faible" ? "low" : "normal",
      qualityPreset: quality,

      status: mode,
      scheduledAt: mode === "scheduled" ? scheduledAt : null,
    };
  }

  async function createRoom(mode: "draft" | "scheduled" | "live") {
    if (!token) throw new Error("Missing token");

    const payload = buildPayload(mode);

    // Si tu veux imposer une date+heure pour "scheduled"
    if (mode === "scheduled" && !payload.scheduledAt) {
      throw new Error("Choisis une date et une heure pour planifier.");
    }

    const res = await apiFetch<CreateRoomRes>("/rooms", {
      method: "POST",
      body: JSON.stringify(payload),
      token,
    });

    return res.roomId;
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

      // Option A (actuel) : aller direct sur la page watch de la room
      router.push(`/watch/${encodeURIComponent(id)}`);

      // Option B (souvent plus logique) : retour à la liste
      // router.push("/watch");
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
      setStatus("idle");

      // Important : mode=host pour coller au flow mobile
      router.push(`/broadcast/${encodeURIComponent(id)}?mode=host`);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Erreur");
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-neutral-50 text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-10">Chargement…</div>
      </main>
    );
  }

  if (!token || !user) return null;

  const canCreate = title.trim().length > 0;
  const canSchedule = canCreate && !!date && !!time;

  return (
    <main className="min-h-screen bg-neutral-50 text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 text-gray-900 shadow-lg md:p-7 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500">
              <Radio className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/60">
                Foodstream Studio
              </p>
              <h1 className="text-xl font-bold">Créer un nouveau live</h1>
            </div>
          </div>

          <Field label="Titre du live">
            <input
              className="input-dark text-base font-semibold md:text-lg"
              placeholder="Ex : Ramen Tonkotsu en 30 minutes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field label="Description">
            <textarea
              className="input-dark min-h-[160px] resize-y"
              placeholder="Décris ton live : recette, étapes, niveau, ustensiles…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Cuisine / catégorie">
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((t) => (
                  <Chip key={t} active={tags.includes(t)} onClick={() => toggleTag(t)} label={t} />
                ))}
              </div>
            </Field>

            <Field label="Niveau">
              <div className="flex flex-wrap gap-2">
                {(["Débutant", "Intermédiaire", "Avancé"] as Level[]).map((l) => (
                  <Chip key={l} active={level === l} onClick={() => setLevel(l)} label={l} />
                ))}
              </div>
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Date">
              <div className="flex justify-center">
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <Calendar className="h-5 w-5 text-gray-400 dark:text-white/40" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent outline-none text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </Field>

            <Field label="Heure (heure locale)">
              <div className="flex justify-center">
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <Clock className="h-5 w-5 text-gray-400 dark:text-white/40" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="bg-transparent outline-none text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </Field>
          </div>

          <Field label="Durée du live">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Durée</span>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-900 ring-1 ring-black/5 dark:bg-neutral-900 dark:text-white dark:ring-white/10">
                  {duration} min
                </span>
              </div>

              <input
                type="range"
                min={10}
                max={180}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {[30, 45, 60, 90].map((d) => (
                  <Chip key={d} active={duration === d} onClick={() => setDuration(d)} label={`${d} min`} />
                ))}
              </div>
            </div>
          </Field>

          <Field label="Visibilité">
            <div className="flex flex-wrap gap-2">
              {(["Public", "Non listé", "Privé"] as Visibility[]).map((v) => (
                <Chip key={v} active={visibility === v} onClick={() => setVisibility(v)} label={v} />
              ))}
            </div>
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Image du live">
              <div className="flex justify-center">
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5 w-full">
                  <ImageIcon className="h-5 w-5 text-gray-400 dark:text-white/40" />
                  <input
                    placeholder="URL de l’image (optionnel)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-gray-900 dark:text-white"
                  />
                </div>
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

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={onSaveDraft}
              disabled={status !== "idle" || !canCreate}
              className="rounded-2xl border border-neutral-300 bg-gray-50 px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              Enregistrer le brouillon
            </button>

            <button
              onClick={onSchedule}
              disabled={status !== "idle" || !canSchedule}
              className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
              title={!canSchedule ? "Choisis une date et une heure pour planifier" : undefined}
            >
              Planifier le live
            </button>

            <button
              onClick={onGoLiveNow}
              disabled={status !== "idle" || !canCreate}
              className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Video className="h-4 w-4" />
              Démarrer maintenant
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
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
        </aside>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="mb-2 block text-sm font-semibold text-gray-800 dark:text-white/80">
        {label}
      </label>
      {children}
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
  @apply w-full rounded-2xl border px-4 py-3 text-sm outline-none ring-0
          border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10
          dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/40 dark:focus:border-white/25 dark:focus:ring-white/10;
}`;

export const __keepTailwind = _css;
