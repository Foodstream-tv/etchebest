"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlarmClock, CalendarClock, Radio, X } from "lucide-react";

import { getMyScheduledLive, type MyScheduledLive } from "@/lib/lives";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import { useAuth } from "@/lib/useAuth";

type Urgency = "upcoming" | "imminent" | "overdue";

const TEN_MINUTES_MS = 10 * 60 * 1000;
const DISMISS_STORAGE_KEY = "scheduledLiveToastDismissedRoomId";

function getUrgency(scheduledAt: string | null | undefined, now: number): Urgency {
  if (!scheduledAt) return "upcoming";

  const scheduled = new Date(scheduledAt).getTime();
  if (Number.isNaN(scheduled)) return "upcoming";

  const remaining = scheduled - now;

  if (remaining <= 0) return "overdue";
  if (remaining <= TEN_MINUTES_MS) return "imminent";
  return "upcoming";
}

function formatTime(scheduledAt: string | null | undefined): string {
  if (!scheduledAt) return "";

  const scheduled = new Date(scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return "";

  return scheduled.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const URGENCY_CONTENT: Record<
  Urgency,
  {
    title: string;
    message: (title: string, time: string) => string;
    icon: React.ReactNode;
  }
> = {
  upcoming: {
    title: "Live planifié",
    message: (title, time) =>
      `« ${title} » est prévu le ${time}. Clique ici pour ouvrir le studio et lancer le live le moment venu.`,
    icon: <CalendarClock className="h-5 w-5" aria-hidden="true" />,
  },
  imminent: {
    title: "Ton live commence bientôt !",
    message: (title) =>
      `« ${title} » démarre dans moins de 10 minutes. Ouvre le studio et prépare-toi à lancer le live.`,
    icon: <AlarmClock className="h-5 w-5" aria-hidden="true" />,
  },
  overdue: {
    title: "Ton live devrait avoir commencé !",
    message: (title, time) =>
      `L'heure de « ${title} » (${time}) est dépassée et tes spectateurs voient toujours « À venir ». Clique ici pour le lancer maintenant.`,
    icon: <Radio className="h-5 w-5" aria-hidden="true" />,
  },
};

export default function ScheduledLiveToast() {
  const pathname = usePathname();
  const { ready, user, token } = useAuth();

  const [scheduledLive, setScheduledLive] = useState<MyScheduledLive | null>(
    null
  );
  const [now, setNow] = useState(() => Date.now());

  const [dismissedRoomId, setDismissedRoomId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(DISMISS_STORAGE_KEY);
  });

  // Un GET à chaque chargement / changement de page pour savoir si
  // l'utilisateur a un live planifié (null sinon).
  useEffect(() => {
    if (!ready || !user?.id || !token) return;

    let cancelled = false;

    getMyScheduledLive(token)
      .then((res) => {
        if (!cancelled) setScheduledLive(res.live ?? null);
      })
      .catch(() => {
        // Échec silencieux pour éviter de gêner l'utilisateur.
      });

    return () => {
      cancelled = true;
    };
  }, [ready, user?.id, token, pathname]);

  // Tick local pour faire évoluer l'urgence (orange → rouge → noir)
  // sans nouvelle requête.
  useEffect(() => {
    if (!scheduledLive) return;

    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [scheduledLive]);

  // Pas de toast sans session, ni sur la page de diffusion :
  // l'utilisateur y est déjà.
  if (!ready || !user?.id || !token) return null;
  if (!scheduledLive || pathname?.startsWith("/broadcast/")) return null;

  const urgency = getUrgency(scheduledLive.scheduled_at, now);

  // Seul le toast orange (échéance lointaine) peut être fermé ; le rouge et
  // le noir restent affichés quoi qu'il arrive.
  if (urgency === "upcoming" && dismissedRoomId === scheduledLive.room_id) {
    return null;
  }

  const { title, message, icon } = URGENCY_CONTENT[urgency];
  const time = formatTime(scheduledLive.scheduled_at);

  const dismiss = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDismissedRoomId(scheduledLive.room_id);
    window.sessionStorage.setItem(DISMISS_STORAGE_KEY, scheduledLive.room_id);
  };

  const background =
    urgency === "upcoming"
      ? ORANGE_GRADIENT_CSS
      : urgency === "imminent"
        ? "#dc2626"
        : "#0a0a0a";

  return (
    <Link
      href={`/broadcast/${encodeURIComponent(scheduledLive.room_id)}?mode=host`}
      aria-label={`${title} : ${message(scheduledLive.title, time)}`}
      className="fixed left-4 top-20 z-[9999] block w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl text-white shadow-2xl ring-1 ring-white/15 transition hover:scale-[1.02]"
      style={{ background }}
    >
      <div className="flex gap-3 p-4">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 ${
            urgency !== "upcoming" ? "animate-pulse" : ""
          }`}
          aria-hidden="true"
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title}</p>

          <p className="mt-0.5 text-sm text-white/85">
            {message(scheduledLive.title, time)}
          </p>
        </div>

        {urgency === "upcoming" ? (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Masquer le rappel de live planifié"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </Link>
  );
}
