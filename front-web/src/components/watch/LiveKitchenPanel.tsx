"use client";

import Link from "next/link";
import { ChefHat, Radio, Users } from "lucide-react";

import { useI18n } from "@/i18n/LanguageContext";

type Props = {
  roomId: string;
  isHost: boolean;
  chef?: string;
  cooks: number | null;
  maxCooks: number | null;
  // No place left for this user (a user who already has one can always come in).
  full: boolean;
  // "overlay" covers the video frame (no live player); "bar" sits under the live player.
  variant: "overlay" | "bar";
};

// A running live is a kitchen people join to cook with the chef (camera and microphone on), not a
// stream to watch: say so, with the places left. Watching comes with the replay at the end.
export default function LiveKitchenPanel({ roomId, isHost, chef, cooks, maxCooks, full, variant }: Props) {
  const { t } = useI18n();
  const broadcastUrl = (mode: "host" | "join") => `/broadcast/${encodeURIComponent(roomId)}?mode=${mode}`;
  const places =
    cooks !== null && maxCooks !== null ? (
      <span className="inline-flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        {t("watch.room.cooksCount", { count: cooks, max: maxCooks })}
      </span>
    ) : null;

  let action;
  if (isHost) {
    action = (
      <Link
        href={broadcastUrl("host")}
        className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-[#1a0f05] shadow-lg transition hover:bg-orange-400"
      >
        <Radio className="h-4 w-4" aria-hidden="true" />
        {t("watch.room.accessHostStudio")}
      </Link>
    );
  } else if (full) {
    action = <p className="text-sm font-medium text-gray-300">{t("watch.room.kitchenFull")}</p>;
  } else {
    action = (
      <Link
        href={broadcastUrl("join")}
        className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white shadow-[0_10px_25px_rgba(239,68,68,0.35)] transition hover:bg-red-400"
      >
        <ChefHat className="h-4 w-4" aria-hidden="true" />
        {t("watch.room.joinKitchen")}
      </Link>
    );
  }

  const title = chef ? t("watch.room.cookLiveTitle", { chef }) : t("watch.room.cookLiveTitleNoChef");

  if (variant === "bar") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 px-5 py-4 text-white">
        <div className="min-w-0 text-sm">
          <p className="font-bold">{isHost ? title : t("watch.room.cookLiveBar")}</p>
          {places ? <p className="mt-0.5 text-xs text-gray-300">{places}</p> : null}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-red-950 via-neutral-900 to-black p-6 text-center text-white">
      <div className="mb-3 hidden h-16 w-16 place-items-center rounded-2xl bg-red-500 sm:grid text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]">
        <Radio className="h-8 w-8 animate-pulse" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      {isHost ? null : <p className="mt-2 max-w-md text-sm text-gray-300">{t("watch.room.cookLiveDesc")}</p>}
      {places ? (
        <p className="mt-3 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-gray-200">
          {places}
        </p>
      ) : null}
      <div className="mt-5">{action}</div>
    </div>
  );
}
