"use client";

import { useState } from "react";
import { MoreVertical, UserX } from "lucide-react";
import StreamView from "@/components/StreamView";
import { useI18n } from "@/i18n/LanguageContext";

type BroadcastRemoteCardProps = Readonly<{
  stream: MediaStream;
  index: number;
  isHost?: boolean;
  onKick?: () => void;
}>;

export default function BroadcastRemoteCard({
  stream,
  index,
  isHost,
  onKick,
}: BroadcastRemoteCardProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const participantLabel = t("broadcast.participantLabel", { index: index + 1 });

  return (
    <article
      aria-labelledby={`remote-stream-${index}`}
      className="overflow-hidden rounded-2xl border border-black/8 bg-white/72 shadow-[0_12px_30px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
    >
      <div className="relative flex items-center justify-between border-b border-black/8 bg-white/70 px-3 py-2 text-xs font-semibold text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
        <h3 id={`remote-stream-${index}`}>
          {participantLabel}
        </h3>

        {isHost && onKick ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={t("broadcast.participantOptionsAria")}
              className="grid h-6 w-6 place-items-center rounded-lg text-gray-400 transition hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-xl border border-black/10 bg-white/95 p-1 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#1a130e]">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onKick();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    <span>{t("broadcast.kickParticipant")}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div
        className="h-[170px] bg-black"
        aria-label={t("broadcast.participantStreamAria", { name: participantLabel })}
      >
        <StreamView stream={stream} />
      </div>
    </article>
  );
}