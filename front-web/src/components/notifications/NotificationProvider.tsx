"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { BellRing, X } from "lucide-react";

type ToastNotification = {
  id: string;
  title: string;
  message: string;
  href?: string;
};

type NotificationContextValue = {
  pushNotification: (notification: Omit<ToastNotification, "id">) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushNotification = useCallback(
    (notification: Omit<ToastNotification, "id">) => {
      const id = crypto.randomUUID();

      setNotifications((prev) => [
        {
          id,
          ...notification,
        },
        ...prev,
      ]);

      window.setTimeout(() => {
        removeNotification(id);
      }, 5000);
    },
    [removeNotification]
  );

  return (
    <NotificationContext.Provider value={{ pushNotification }}>
      {children}

      <div className="pointer-events-none fixed right-4 top-20 z-[9999] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {notifications.map((notification) => {
          const content = (
            <div className="pointer-events-auto animate-[slideIn_.25s_ease-out] overflow-hidden rounded-3xl border border-orange-200/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-orange-500/20 dark:bg-neutral-950/95">
              <div className="flex gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300">
                  <BellRing className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-950 dark:text-white">
                    {notification.title}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                    {notification.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    removeNotification(notification.id);
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );

          return notification.href ? (
            <Link
              key={notification.id}
              href={notification.href}
              onClick={() => removeNotification(notification.id)}
            >
              {content}
            </Link>
          ) : (
            <div key={notification.id}>{content}</div>
          );
        })}
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }

  return context;
}