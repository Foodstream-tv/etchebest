"use client";

import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";

export default function UpcomingCard({
  title,
  when,
  author,
}: {
  title: string;
  when: string;
  author: string;
}) {
  return (
    <div className="rounded-2xl bg-black/[0.03] p-3 ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        {title}
      </div>

      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        {when} — {author}
      </div>

      <button
        className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.24)] transition hover:bg-orange-400"
        style={{ background: ORANGE_GRADIENT_CSS }}
      >
        Me prévenir
      </button>
    </div>
  );
}