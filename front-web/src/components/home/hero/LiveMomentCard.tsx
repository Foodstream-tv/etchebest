"use client";

import { Flame } from "lucide-react";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";

export default function LiveMomentCard() {
  return (
    <div className="rounded-[28px] border border-black/8 bg-white/72 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-50">
        <Flame className="h-4 w-4 text-orange-500" />
        Live du moment
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/8 dark:border-white/10">
        <div className="relative h-52 bg-black/[0.06] dark:bg-white/10">
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
            style={{ background: ORANGE_GRADIENT_CSS }}
          >
            LIVE
          </span>

          <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
            👁 4
          </span>
        </div>

        <div className="p-4">
          <div className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Ramen Tonkotsu
          </div>

          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            par Aiko Tanaka
          </div>

          <button
            className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400"
            style={{ background: ORANGE_GRADIENT_CSS }}
          >
            Rejoindre
          </button>
        </div>
      </div>
    </div>
  );
}