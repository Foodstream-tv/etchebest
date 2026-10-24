"use client";

import { Check } from "lucide-react";

import { useI18n } from "@/i18n/LanguageContext";

/** Thin bar that fills (and eases) as the live form gets completed. */
export default function FormProgress({
  percent,
}: Readonly<{ percent: number }>) {
  const { t } = useI18n();
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  const done = safe >= 100;

  return (
    <div className="space-y-1.5">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safe}
        aria-label={t("studio.progress.label", { percent: safe })}
        className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
      >
        <div
          className="fs-progress-fill h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${safe}%` }}
        />
      </div>

      <p
        className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
          done
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {done ? (
          <Check className="fs-pop h-3.5 w-3.5" aria-hidden="true" />
        ) : null}
        {done
          ? t("studio.progress.done")
          : t("studio.progress.label", { percent: safe })}
      </p>
    </div>
  );
}
