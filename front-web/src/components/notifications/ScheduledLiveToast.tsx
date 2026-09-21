"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AlarmClock, CalendarClock, CalendarPlus, Download, Radio, X } from "lucide-react";

import { getMyScheduledLive, type MyScheduledLive } from "@/lib/lives";
import { getGoogleCalendarUrl, downloadIcsFile } from "@/lib/calendar";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import { useAuth } from "@/lib/useAuth";
import { useI18n } from "@/i18n";

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

function formatTime(scheduledAt: string | null | undefined, locale: "fr" | "en" = "fr"): string {
  if (!scheduledAt) return "";

  const scheduled = new Date(scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return "";

  return scheduled.toLocaleString(locale === "en" ? "en-US" : "fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScheduledLiveToast() {
  const router = useRouter();
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

  if (dismissedRoomId === scheduledLive.room_id) {
    return null;
  }

  const { t, locale } = useI18n();

  const dismiss = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDismissedRoomId(scheduledLive.room_id);
    window.sessionStorage.setItem(DISMISS_STORAGE_KEY, scheduledLive.room_id);
  };

  const handleOpenStudio = () => {
    router.push(`/broadcast/${encodeURIComponent(scheduledLive.room_id)}?mode=host`);
  };

  const time = formatTime(scheduledLive.scheduled_at, locale);

  let title = "";
  let message = "";
  let icon: React.ReactNode = null;

  if (urgency === "upcoming") {
    title = t("notifications.scheduled.upcomingTitle");
    message = t("notifications.scheduled.upcomingDesc", { title: scheduledLive.title, time });
    icon = <CalendarClock className="h-6 w-6 text-white" aria-hidden="true" />;
  } else if (urgency === "imminent") {
    title = t("notifications.scheduled.imminentTitle");
    message = t("notifications.scheduled.imminentDesc", { title: scheduledLive.title });
    icon = <AlarmClock className="h-6 w-6 text-white" aria-hidden="true" />;
  } else {
    title = t("notifications.scheduled.overdueTitle");
    message = t("notifications.scheduled.overdueDesc", { title: scheduledLive.title, time });
    icon = <Radio className="h-6 w-6 text-white" aria-hidden="true" />;
  }

  const background =
    urgency === "upcoming"
      ? ORANGE_GRADIENT_CSS
      : urgency === "imminent"
        ? "#dc2626"
        : "#0a0a0a";

  const origin = typeof window !== "undefined" ? window.location.origin : "https://foodstream.tv";
  const calendarOptions = {
    title: scheduledLive.title,
    description: `Mon live Foodstream: ${origin}/broadcast/${encodeURIComponent(scheduledLive.room_id)}?mode=host`,
    scheduledAt: scheduledLive.scheduled_at || new Date().toISOString(),
    durationMinutes: 60,
    liveUrl: `${origin}/broadcast/${encodeURIComponent(scheduledLive.room_id)}?mode=host`,
  };

  return (
    <div
      role="region"
      aria-label={`${title} : ${message}`}
      onClick={handleOpenStudio}
      className="fixed left-4 top-20 z-[9999] block w-[360px] max-w-[calc(100vw-2rem)] cursor-pointer overflow-hidden rounded-3xl text-white shadow-2xl ring-1 ring-white/15 transition hover:scale-[1.02]"
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
            {message}
          </p>

          <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const url = getGoogleCalendarUrl(calendarOptions);
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/30 active:scale-95"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span>Agenda</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadIcsFile(calendarOptions);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/30 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>.ics</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t("notifications.scheduled.hideAria")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

