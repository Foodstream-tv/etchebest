"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";

type CardItem = {
  id: string;
  badge: string;
  title: string;
  author: string;
  viewers?: number;
  when?: string;
  isLive?: boolean;
};

export default function LiveGridCard({ item }: { item: CardItem }) {
  return (
    <Link
      href={`/watch/${encodeURIComponent(item.id)}`}
      className="block overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_22px_50px_rgba(0,0,0,0.45)]"
    >
      <div className="relative aspect-[16/9] w-full bg-black/[0.06] dark:bg-white/10">
        {item.isLive ? (
          <div
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
            style={{ background: ORANGE_GRADIENT_CSS }}
          >
            LIVE
          </div>
        ) : null}

        <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white">
          {item.badge}
        </div>

        <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white">
          <Eye className="h-3.5 w-3.5" />
          {item.viewers ?? 0}
        </div>
      </div>

      <div className="p-4">
        <div className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          {item.title}
        </div>

        <div className="mt-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>👤 {item.author}</span>
          {item.when ? (
            <span className="text-gray-500 dark:text-gray-500">{item.when}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
