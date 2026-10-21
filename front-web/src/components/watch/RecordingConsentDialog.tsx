"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Video } from "lucide-react";

import { useI18n } from "@/i18n/LanguageContext";

type Props = {
  busy?: boolean;
  onAccept: () => void;
  onCancel: () => void;
};

// A co-streamer appears in the recording of the live and in its public replay: ask for an explicit
// yes first. The button stays disabled until the box is ticked, nothing is pre-checked.
export default function RecordingConsentDialog({ busy = false, onAccept, onCancel }: Props) {
  const { t } = useI18n();
  const [agreed, setAgreed] = useState(false);
  const titleId = useId();
  const descId = useId();
  const checkboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    checkboxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-6 text-left text-white shadow-2xl"
      >
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-orange-500/20 text-orange-300">
          <Video aria-hidden="true" className="h-5 w-5" />
        </div>
        <h2 id={titleId} className="text-lg font-bold">
          {t("consent.recording.title")}
        </h2>
        <p id={descId} className="mt-2 text-sm text-gray-300">
          {t("consent.recording.body")}
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-orange-500"
          />
          <span>{t("consent.recording.checkbox")}</span>
        </label>

        <p className="mt-3 text-xs text-gray-400">{t("consent.recording.withdraw")}</p>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {t("consent.recording.cancel")}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!agreed || busy}
            className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t("consent.recording.busy") : t("consent.recording.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
