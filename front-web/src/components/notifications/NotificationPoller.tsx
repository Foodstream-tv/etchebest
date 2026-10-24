"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { getMyActivities } from "@/lib/activity";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useAuth } from "@/lib/useAuth";
import { usePolling } from "@/lib/usePolling";

type Activity = {
  id: string;
  text: string;
  created_at: string;
};

function getReadActivityIds(storageKey: string): string[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

export default function NotificationPoller() {
  const pathname = usePathname();
  const { ready, user, token } = useAuth();
  const { pushNotification } = useNotifications();

  // Read through a ref: navigating must not restart the polling (nor trigger an extra request).
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const userId = user?.id;
  const enabled = Boolean(ready && userId && token);

  const checkActivities = useCallback(async () => {
    if (!enabled || !userId || !token) return;

    const storageKey = `readActivityIds:${userId}`;

    try {
      const res = await getMyActivities(token);

      const activities: Activity[] = Array.isArray(res.activities)
        ? res.activities
        : [];

      const readActivityIds = new Set(getReadActivityIds(storageKey));

      const unreadActivities = activities.filter(
        (activity) => !readActivityIds.has(activity.id)
      );

      if (pathnameRef.current !== "/profile" && unreadActivities.length > 0) {
        unreadActivities.forEach((activity) => {
          pushNotification({
            title: "Nouvelle activité",
            message: activity.text,
            href: "/profile",
          });
        });
      }

      window.localStorage.setItem(
        storageKey,
        JSON.stringify(activities.map((activity) => activity.id))
      );
    } catch {
      // Échec silencieux pour éviter de gêner l'utilisateur.
    }
  }, [enabled, userId, token, pushNotification]);

  useEffect(() => {
    void checkActivities();
  }, [checkActivities]);

  // Every 30 s, but only while the tab is visible.
  usePolling(checkActivities, 30_000, enabled);

  return null;
}