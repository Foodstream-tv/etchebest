"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getMyActivities } from "@/lib/activity";
import { useNotifications } from "@/components/notifications/NotificationProvider";

type Activity = {
  id: string;
  text: string;
  created_at: string;
};

export default function NotificationPoller() {
  const pathname = usePathname();
  const { ready, user, token } = useAuth();
  const { pushNotification } = useNotifications();

  useEffect(() => {
    if (!ready || !user || !token) return;

    const storageKey = `readActivityIds:${user.id}`;

    const checkActivities = async () => {
      try {
        const res = await getMyActivities(token ?? undefined);
        const activities: Activity[] = res.activities ?? [];

        const readActivityIds = JSON.parse(
          localStorage.getItem(storageKey) || "[]"
        ) as string[];

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

          localStorage.setItem(
            storageKey,
            JSON.stringify(activities.map((activity) => activity.id))
          );
        }
      } catch {
        // silencieux pour éviter de spam console
      }
    };

    checkActivities();

    const interval = window.setInterval(checkActivities, 3000);

    return () => window.clearInterval(interval);
  }, [ready, user, token, pathname, pushNotification]);

  return null;
}