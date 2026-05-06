"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Image as ImageIcon,
  Radio,
  Video,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import HomeFooter from "@/components/home/HomeFooter";
import Field from "@/components/studio/Field";
import Chip from "@/components/studio/Chip";
import StudioPreviewCard from "@/components/studio/StudioPreviewCard";

type Level = "Débutant" | "Intermédiaire" | "Avancé";
type Visibility = "Public" | "Non listé" | "Privé";

const CUISINES = [
  "Asiatique",
  "Pâtisserie",
  "Street food",
  "Healthy",
  "BBQ",
  "Végétarien",
];

type CreateRoomRes = { roomId: string };
type UploadImageRes = { url: string };

export default function StudioPage() {
  const { token, user, ready } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState<string[]>(["Asiatique"]);
  const [level, setLevel] = useState<Level>("Débutant");
  const [date, setDate] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [time, setTime] = useState<string>(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${min}`;
  });

  const [duration, setDuration] = useState<number>(60);
  const [visibility, setVisibility] = useState<Visibility>("Public");
  const [imageUrl, setImageUrl] = useState<string>("");

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");

  const [latency, setLatency] = useState<"Normale" | "Faible">("Normale");
  const [quality, setQuality] = useState<"Auto (1080p)" | "720p" | "480p">(
    "Auto (1080p)"
  );
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

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(thumbnailFile);
    setThumbnailPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [thumbnailFile]);

  const previewTitle = title.trim() || "Ramen Tonkotsu en 30 minutes";
  const previewTags = useMemo(() => [tags[0] || "Asiatique", level], [tags, level]);

  const safeImage =
    thumbnailPreview || imageUrl?.trim() || "/images/live-fallback.jpg";

  const canCreate = title.trim().length > 0;
  const canSchedule = canCreate && !!date && !!time;

  const toggleTag = (tag: string) => {
    setTags([tag]);
  };

  const buildScheduledAt = (): string | null => {
    if (!date || !time) return null;
    const dt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  const appendDescriptionHint = (hint: string) => {
    setDesc((prev) => {
      if (prev.includes(hint)) return prev;
      return prev.trim() ? `${prev}\n• ${hint}` : `• ${hint}`;
    });
  };

  const removeSelectedFile = () => {
    setThumbnailFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setThumbnailFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Le fichier sélectionné doit être une image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("L’image ne doit pas dépasser 5 Mo.");
      return;
    }

    setError(null);
    setThumbnailFile(file);
    setImageUrl("");
  };

  const uploadThumbnail = async (file: File): Promise<string> => {
    if (!token) throw new Error("Missing token");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? ""}/uploads/image`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (!res.ok) {
      let message = "Impossible d’uploader l’image";
      try {
        const data = await res.json();
        message = data?.message || data?.error || message;
      } catch {}
      throw new Error(message);
    }

    const data: UploadImageRes = await res.json();
    if (!data?.url) {
      throw new Error("Aucune URL retournée après l’upload de l’image.");
    }

    return data.url;
  };

  const buildPayload = async (mode: "draft" | "scheduled" | "live") => {
    const scheduledAt = buildScheduledAt();
    const roomName = title.trim() || `Live ${new Date().toISOString()}`;

    let finalThumbnailUrl: string | null = imageUrl?.trim() || null;

    if (thumbnailFile) {
      finalThumbnailUrl = await uploadThumbnail(thumbnailFile);
    }

    return {
      name: roomName,
      title: roomName,
      description: desc.trim(),
      tags,
      level,
      durationMinutes: duration,
      visibility,
      thumbnailUrl: finalThumbnailUrl,
      chatActive,
      slowMode,
      subsOnly,
      replaysEnabled: replays,
      latencyMode: latency === "Faible" ? "low" : "normal",
      qualityPreset: quality,
      status: mode,
      scheduledAt: mode === "scheduled" ? scheduledAt : null,
    };
  };

  const createRoom = async (mode: "draft" | "scheduled" | "live") => {
    if (!token) throw new Error("Missing token");

    const payload = await buildPayload(mode);

    if (mode === "scheduled" && !payload.scheduledAt) {
      throw new Error("Choisis une date et une heure pour planifier.");
    }

    const res = await apiFetch<CreateRoomRes>("/rooms", {
      method: "POST",
      body: JSON.stringify(payload),
      token,
    });

    return res.roomId;
  };

  const onSaveDraft = async () => {
    try {
      setError(null);
      setStatus("creating");
      await createRoom("draft");
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Erreur");
    }
  };

  const onSchedule = async () => {
    try {
      setError(null);
      setStatus("creating");
      const id = await createRoom("scheduled");
      setStatus("idle");
      router.push(`/watch/${encodeURIComponent(id)}`);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Erreur");
    }
  };

  const onGoLiveNow = async () => {
    try {
      setError(null);
      setStatus("creating");
      const id = await createRoom("live");
      setStatus("idle");
      router.push(`/broadcast/${encodeURIComponent(id)}?mode=host`);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Erreur");
    }
  };

  if (!ready) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-7xl px-6 py-10">Chargement…</div>
      </main>
    );
  }

  if (!token || !user) return null;

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:py-10">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-[32px] border border-black/8 bg-white/72 p-5 text-gray-900 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-md md:p-7 dark:border-white/10 dark:bg-[#120b05]/60 dark:text-gray-100 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="mb-7 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-500 shadow-[0_10px_24px_rgba(249,115,22,0.28)]">
                <Radio className="h-5 w-5 text-white" />
              </div>

              <div className="leading-tight">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500 dark:text-orange-400">
                  Foodstream Studio
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  Créer un nouveau live
                </h1>
              </div>
            </div>

            <div className="space-y-6">
              <Field label="Titre du live">
                <div className="rounded-2xl border border-black/8 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <input
                    className="w-full rounded-xl border border-black/8 bg-white px-4 py-3 text-base font-semibold text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30 md:text-lg dark:border-white/10 dark:bg-[#120b05]/80 dark:text-white dark:placeholder:text-white/35 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                    placeholder="Ex. : Ramen Tonkotsu en 30 minutes"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </Field>

              <Field label="Description">
                <div className="rounded-2xl border border-black/8 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/75">
                      <FileText className="h-4 w-4" />
                      <span>Présentation du live</span>
                    </div>

                    <span className="shrink-0 text-xs text-gray-400 dark:text-white/35">
                      {desc.length}/500
                    </span>
                  </div>

                  <textarea
                    className="w-full min-h-[180px] resize-y rounded-xl border border-black/8 bg-white px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30 dark:border-white/10 dark:bg-[#120b05]/80 dark:text-white dark:placeholder:text-white/35 dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
                    placeholder="Présente ton live : ce que tu vas cuisiner, les étapes, le niveau, les ingrédients ou le matériel nécessaire…"
                    value={desc}
                    maxLength={500}
                    onChange={(e) => setDesc(e.target.value)}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      "Recette maison",
                      "Pas à pas",
                      "Débutant friendly",
                      "Matériel simple",
                    ].map((hint) => (
                      <button
                        key={hint}
                        type="button"
                        onClick={() => appendDescriptionHint(hint)}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-black/5 transition hover:bg-gray-100 dark:bg-white/5 dark:text-white/75 dark:ring-white/10 dark:hover:bg-white/10"
                      >
                        + {hint}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Cuisine / catégorie">
                  <div className="flex flex-wrap gap-2">
                    {CUISINES.map((tag) => (
                      <Chip
                        key={tag}
                        active={tags.includes(tag)}
                        onClick={() => toggleTag(tag)}
                        label={tag}
                      />
                    ))}
                  </div>
                </Field>

                <Field label="Niveau">
                  <div className="flex flex-wrap gap-2">
                    {(["Débutant", "Intermédiaire", "Avancé"] as Level[]).map((item) => (
                      <Chip
                        key={item}
                        active={level === item}
                        onClick={() => setLevel(item)}
                        label={item}
                      />
                    ))}
                  </div>
                </Field>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Date">
                  <div className="flex w-full items-center gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                    <Calendar className="h-5 w-5 shrink-0 text-gray-400 dark:text-white/40" />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full min-w-0 bg-transparent text-sm text-gray-900 outline-none dark:text-white"
                    />
                  </div>
                </Field>

                <Field label="Heure (heure locale)">
                  <div className="flex w-full items-center gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                    <Clock className="h-5 w-5 shrink-0 text-gray-400 dark:text-white/40" />
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full min-w-0 bg-transparent text-sm text-gray-900 outline-none dark:text-white"
                    />
                  </div>
                </Field>
              </div>

              <Field label="Durée du live">
                <div className="rounded-2xl border border-black/8 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold">Durée</span>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-900 ring-1 ring-black/5 dark:bg-[#120b05]/80 dark:text-white dark:ring-white/10">
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
                    {[30, 45, 60, 90].map((item) => (
                      <Chip
                        key={item}
                        active={duration === item}
                        onClick={() => setDuration(item)}
                        label={`${item} min`}
                      />
                    ))}
                  </div>
                </div>
              </Field>

              <Field label="Image du live">
                <div className="rounded-2xl border border-black/8 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white/70">
                    <ImageIcon className="h-4 w-4" />
                    <span>Miniature du live</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl border border-black/8 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#120b05]/80">
                      <ImageIcon className="h-5 w-5 shrink-0 text-gray-400 dark:text-white/40" />
                      <input
                        placeholder="https://mon-site.com/miniature-live.jpg"
                        value={imageUrl}
                        onChange={(e) => {
                          setImageUrl(e.target.value);
                          if (e.target.value.trim()) {
                            setThumbnailFile(null);
                          }
                        }}
                        className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-white/35"
                      />
                    </div>

                    <div className="relative rounded-xl border border-dashed border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#120b05]/80">
                      <input
                        id="thumbnail-file"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />

                      <label
                        htmlFor="thumbnail-file"
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-400"
                      >
                        <Upload className="h-4 w-4" />
                        Choisir une image depuis mon fichier
                      </label>

                      <p className="mt-2 text-xs text-gray-500 dark:text-white/45">
                        PNG, JPG, WEBP… 5 Mo maximum.
                      </p>

                      {thumbnailFile ? (
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-black/[0.03] px-3 py-2 dark:border-white/10 dark:bg-white/5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                              {thumbnailFile.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-white/45">
                              {(thumbnailFile.size / 1024 / 1024).toFixed(2)} Mo
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={removeSelectedFile}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 ring-1 ring-black/5 transition hover:bg-gray-100 dark:bg-white/10 dark:text-white dark:ring-white/10 dark:hover:bg-white/15"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-gray-500 dark:text-white/45">
                    Tu peux soit coller une URL, soit importer une image depuis ton appareil.
                  </p>
                </div>
              </Field>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={onSaveDraft}
                  disabled={status !== "idle" || !canCreate}
                  className="rounded-2xl border border-black/8 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  Enregistrer le brouillon
                </button>

                <button
                  onClick={onSchedule}
                  disabled={status !== "idle" || !canSchedule}
                  className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400 disabled:opacity-50"
                  title={
                    !canSchedule
                      ? "Choisis une date et une heure pour planifier"
                      : undefined
                  }
                >
                  Planifier le live
                </button>

                <button
                  onClick={onGoLiveNow}
                  disabled={status !== "idle" || !canCreate}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                  <Video className="h-4 w-4" />
                  Démarrer maintenant
                </button>
              </div>

              {error ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </p>
              ) : null}
            </div>
          </section>

          <aside className="space-y-6">
            <StudioPreviewCard
              safeImage={safeImage}
              previewTitle={previewTitle}
              previewTags={previewTags}
              date={date}
              time={time}
            />
          </aside>
        </div>
      </div>

      <HomeFooter />
    </main>
  );
}