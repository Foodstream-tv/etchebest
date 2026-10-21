"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { ApiError } from "@/lib/api";
import { removeReplay } from "@/lib/lives";
import { useI18n } from "@/i18n/LanguageContext";

type Props = {
  roomId: string;
  token: string | null;
  onRemoved: () => void;
};

// Anyone who took part in the live (and its host) can withdraw the replay. Strangers get a clear
// answer instead of a silent failure.
export default function ReplayRemovalCard({ roomId, token, onRemoved }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  if (!token) return null;

  const onClick = async () => {
    if (!window.confirm(t("replays.removal.confirm"))) return;
    setBusy(true);
    setMessage(null);
    try {
      await removeReplay(roomId, token);
      setMessage({ text: t("replays.removal.done"), error: false });
      onRemoved();
    } catch (err) {
      const forbidden = err instanceof ApiError && err.status === 403;
      setMessage({
        text: forbidden ? t("replays.removal.forbidden") : t("replays.removal.failed"),
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="replay-removal-title"
      className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-black/8 bg-white/60 px-5 py-4 dark:border-white/10 dark:bg-white/[0.04]"
    >
      <div className="flex min-w-0 items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
        <div className="min-w-0">
          <h2 id="replay-removal-title" className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("replays.removal.title")}
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t("replays.removal.body")}</p>
          {message ? (
            <p
              role={message.error ? "alert" : "status"}
              className={`mt-1 text-xs font-medium ${message.error ? "text-red-600 dark:text-red-300" : "text-green-600 dark:text-green-300"}`}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
      >
        {busy ? t("replays.removal.busy") : t("replays.removal.button")}
      </button>
    </section>
  );
}
