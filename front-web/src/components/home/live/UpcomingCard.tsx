"use client";

import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";

type UpcomingCardProps = Readonly<{
  title: string;
  when: string;
  author: string;
}>;

export default function UpcomingCard({
  title,
  when,
  author,
}: UpcomingCardProps) {
  return (
    <article
      aria-labelledby={`upcoming-${title}`}
      className="rounded-2xl bg-black/[0.03] p-3 ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10"
    >
      <h3
        id={`upcoming-${title}`}
        className="text-sm font-semibold text-gray-900 dark:text-gray-50"
      >
        {title}
      </h3>

      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        {when} — {author}
      </p>

      <button
        type="button"
        aria-label={`Être prévenu pour ${title} par ${author}`}
        className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.24)] transition hover:bg-orange-400"
        style={{ background: ORANGE_GRADIENT_CSS }}
      >
        Me prévenir
      </button>
    </article>
  );
}