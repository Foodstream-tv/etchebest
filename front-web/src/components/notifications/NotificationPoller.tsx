"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { getMyActivities } from "@/lib/activity";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useAuth } from "@/lib/useAuth";

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

  useEffect(() => {
    if (!ready || !user?.id || !token) return;

    let cancelled = false;
    const storageKey = `readActivityIds:${user.id}`;

    const checkActivities = async () => {
      try {
        const res = await getMyActivities(token);

        if (cancelled) return;

        const activities: Activity[] = Array.isArray(res.activities)
          ? res.activities
          : [];

        const readActivityIds = getReadActivityIds(storageKey);

        const unreadActivities = activities.filter(
          (activity) => !readActivityIds.includes(activity.id)
        );

        if (pathname !== "/profile" && unreadActivities.length > 0) {
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
    };

    checkActivities();

    const interval = window.setInterval(checkActivities, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [ready, user?.id, token, pathname, pushNotification]);

  return null;
}