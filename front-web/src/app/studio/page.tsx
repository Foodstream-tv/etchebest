"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Radio,
  Calendar,
  Clock,
  Image as ImageIcon,
  Settings2,
  Shield,
  Eye,
} from "lucide-react";

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

export default function StudioPage() {
  // ----- FORM STATE -----
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState<string[]>(["Asiatique"]);
  const [level, setLevel] = useState<Level>("Débutant");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [duration, setDuration] = useState<number>(60);
  const [visibility, setVisibility] = useState<Visibility>("Public");
  const [imageUrl, setImageUrl] = useState<string>("");

  // quick settings
  const [latency, setLatency] = useState<"Normale" | "Faible">("Normale");
  const [quality, setQuality] = useState<"Auto (1080p)" | "720p" | "480p">(
    "Auto (1080p)",
  );
  const [replays, setReplays] = useState<boolean>(true);
  const [chatActive, setChatActive] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [subsOnly, setSubsOnly] = useState(false);

  const previewTitle = title || "Ramen Tonkotsu en 30 minutes (aperçu)";
  const previewTags = useMemo(
    () => [tags[0] || "Asiatique", level],
    [tags, level],
  );

  function toggleTag(t: string) {
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function onSaveDraft() {
    alert("Brouillon enregistré (démo front).");
  }

  function onSchedule() {
    alert("Live planifié (démo front).");
  }

  const today = new Date();
  const prettyToday = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const safeImage =
    imageUrl ||
    "https://images.unsplash.com/photo-1604908176997-431289f7c730?q=80&w=1200&auto=format&fit=crop";

  return (
    <main className="min-h-screen bg-neutral-50 text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
      {/* Top bar */}
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
              Bêta créateur
            </span>
            <span className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-gray-600 dark:border-white/10 dark:text-white/70">
              Auto-save activé
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: form card */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 text-gray-900 shadow-lg md:p-6 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400">
              <Radio className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-lg font-semibold">Paramètres du live</h2>
          </div>

          {/* Title */}
          <Field
            label="Titre du live"
            hint="Un bon titre donne envie de cliquer et résume la recette."
          >
            <input
              className="input-dark"
              placeholder="Ex : Ramen Tonkotsu en 30 minutes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          {/* Description */}
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

          {/* Tags + level */}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cuisine / catégorie">
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((t) => (
                  <Chip
                    key={t}
                    active={tags.includes(t)}
                    onClick={() => toggleTag(t)}
                    label={t}
                  />
                ))}
              </div>
            </Field>

            <Field
              label="Niveau"
              hint="Le niveau s’affichera sur la carte de ton live."
            >
              <div className="flex flex-wrap gap-2">
                {(["Débutant", "Intermédiaire", "Avancé"] as Level[]).map(
                  (l) => (
                    <Chip
                      key={l}
                      active={level === l}
                      onClick={() => setLevel(l)}
                      label={l}
                    />
                  ),
                )}
              </div>
            </Field>
          </div>

          {/* Date / Time */}
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

          {/* Duration + presets */}
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
                <Chip
                  key={d}
                  active={duration === d}
                  onClick={() => setDuration(d)}
                  label={`${d} min`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-white/40">
              Durée estimée : 45–90 min
            </p>
          </Field>

          {/* Visibility */}
          <Field label="Visibilité">
            <div className="flex flex-wrap gap-2">
              {(["Public", "Non listé", "Privé"] as Visibility[]).map((v) => (
                <Chip
                  key={v}
                  active={visibility === v}
                  onClick={() => setVisibility(v)}
                  label={v}
                />
              ))}
            </div>
          </Field>

          {/* Image */}
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
              <p className="mt-2 text-xs text-gray-500 dark:text-white/40">
                JPG ou PNG, format 16:9 recommandé.
              </p>
            </Field>

            <Field label="Chat & interaction">
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={chatActive}
                  onClick={() => setChatActive((v) => !v)}
                  label="Chat activé"
                />
                <Chip
                  active={slowMode}
                  onClick={() => setSlowMode((v) => !v)}
                  label="Slow mode"
                />
                <Chip
                  active={subsOnly}
                  onClick={() => setSubsOnly((v) => !v)}
                  label="Abonnés seulement"
                />
              </div>
            </Field>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onSaveDraft}
              className="rounded-xl border border-neutral-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              Enregistrer le brouillon
            </button>
            <button
              onClick={onSchedule}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
            >
              <Radio className="h-4 w-4" />
              Planifier le live
            </button>
          </div>
        </section>

        {/* Right: preview + quick settings */}
        <aside className="space-y-6">
          {/* Preview card */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-gray-900 shadow-lg dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/80">
              Aperçu de la carte live
            </h3>
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-neutral-800">
              <div className="relative h-40 w-full">
                <Image
                  src={safeImage}
                  alt={previewTitle}
                  fill
                  className="object-cover"
                />
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
                <p className="line-clamp-2 text-sm font-semibold">
                  {previewTitle}
                </p>
                <p className="text-xs text-gray-500 dark:text-white/50">
                  par Vous • Aujourd’hui, {time || "19:00"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-white/40">
              Ce n’est qu’un aperçu visuel, les infos seront générées à partir
              de ton formulaire.
            </p>
          </div>

          {/* Quick settings */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-gray-900 shadow-lg dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white/80">
              <Settings2 className="h-4 w-4" />
              Réglages rapides
            </h3>

            <QuickRow
              label="Latence"
              value={latency}
              onClick={() =>
                setLatency(latency === "Normale" ? "Faible" : "Normale")
              }
            />
            <QuickRow
              label="Qualité"
              value={quality}
              onClick={() =>
                setQuality(
                  quality === "Auto (1080p)"
                    ? "720p"
                    : quality === "720p"
                      ? "480p"
                      : "Auto (1080p)",
                )
              }
            />
            <QuickRow
              label="Enregistrement"
              value={replays ? "Replays activés" : "Replays off"}
              onClick={() => setReplays((v) => !v)}
            />

            <div className="mt-4 rounded-xl border border-neutral-200 p-3 text-xs text-gray-600 dark:border-white/10 dark:text-white/60">
              <div className="mb-1 flex items-center gap-2 font-medium text-gray-800 dark:text-white/80">
                <Shield className="h-4 w-4" />
                Contrôles de modération
              </div>
              <p>
                Le slow-mode, le chat abonnés et la visibilité influencent la
                découverte de ton live.
              </p>
            </div>
          </div>

          {/* Tiny info */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-gray-600 shadow-lg dark:border-white/10 dark:bg-neutral-900 dark:text-white/60">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <p>
                Aujourd’hui :{" "}
                <span className="font-semibold text-gray-800 dark:text-white/80">
                  {prettyToday}
                </span>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
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
      {hint && (
        <p className="mt-1 text-xs text-gray-500 dark:text-white/40">{hint}</p>
      )}
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

function QuickRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between rounded-xl border border-neutral-200 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
      <span className="text-sm text-gray-800 dark:text-white/80">{label}</span>
      <button
        onClick={onClick}
        className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-gray-800 hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-800 dark:text-white/80 dark:hover:bg-neutral-700"
      >
        {value}
      </button>
    </div>
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
