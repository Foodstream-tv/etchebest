"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/useAuth";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useI18n } from "@/i18n";
import {
  SESSION_TERMINATED_EVENT,
  formatBanMessage,
  type SessionTerminationDetail,
} from "@/lib/session";

function buildToast(
  detail: SessionTerminationDetail,
  t: (key: any, vars?: Record<string, string | number>) => string,
  locale: "fr" | "en"
): {
  title: string;
  message: string;
} {
  if (detail.reason === "banned") {
    return {
      title: t("notifications.session.bannedTitle"),
      message: formatBanMessage(detail.bannedUntil, locale),
    };
  }

  return {
    title: t("notifications.session.expiredTitle"),
    message: t("notifications.session.expiredDesc"),
  };
}

/**
 * Listens for session-termination events emitted by apiFetch (ban / revoked
 * token) and, when one fires, signs the user out, shows a toast explaining
 * why and redirects to the sign-in page.
 */
export default function SessionGuard() {
  const router = useRouter();
  const { token, signOut } = useAuth();
  const { pushNotification } = useNotifications();
  const { t, locale } = useI18n();

  // Several requests can fail at once (e.g. a page firing multiple GETs);
  // handle only the first termination to avoid duplicate toasts/redirects.
  const handledRef = useRef(false);

  // Re-arm the guard whenever a new session starts so a user who signs back
  // in (and is later banned again) still gets notified.
  useEffect(() => {
    if (token) handledRef.current = false;
  }, [token]);

  useEffect(() => {
    const onTerminated = (event: Event) => {
      if (handledRef.current) return;
      handledRef.current = true;

      const detail = (event as CustomEvent<SessionTerminationDetail>).detail;
      const { title, message } = buildToast(detail, t, locale);

      signOut();
      pushNotification({ title, message });
      router.replace("/signin");
    };

    window.addEventListener(SESSION_TERMINATED_EVENT, onTerminated);
    return () => {
      window.removeEventListener(SESSION_TERMINATED_EVENT, onTerminated);
    };
  }, [router, signOut, pushNotification]);

  return null;
}
