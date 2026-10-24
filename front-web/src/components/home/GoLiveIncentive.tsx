"use client";

import Link from "next/link";

import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import { useI18n } from "@/i18n/LanguageContext";

/**
 * Shown where there is no live at all: instead of a dead end, invite the visitor
 * to start cooking. Kept deliberately light: a title, one sentence, two actions.
 */
export default function GoLiveIncentive() {
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="go-live-incentive-title"
      className="rounded-[28px] border border-black/10 bg-white p-6 text-center shadow-none dark:border-white/10 dark:bg-white/[0.04] md:p-10"
    >
      <h2
        id="go-live-incentive-title"
        className="font-display mx-auto max-w-2xl text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50"
      >
        {t("incentive.title")}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-gray-600 dark:text-gray-400">
        {t("incentive.desc")}
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/studio"
          className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-[#1a0f05] shadow-none transition hover:scale-[1.01] active:scale-[0.98]"
          style={{ background: ORANGE_GRADIENT_CSS }}
        >
          {t("incentive.cta")}
        </Link>

        <Link
          href="/studio"
          className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:text-orange-600 dark:text-gray-300 dark:hover:text-orange-300"
        >
          {t("incentive.ctaSecondary")}
        </Link>
      </div>
    </section>
  );
}
