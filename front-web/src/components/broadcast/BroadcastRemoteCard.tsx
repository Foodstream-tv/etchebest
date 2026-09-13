"use client";

import StreamView from "@/components/StreamView";
import { useI18n } from "@/i18n/LanguageContext";

type BroadcastRemoteCardProps = Readonly<{
  stream: MediaStream;
  index: number;
}>;

export default function BroadcastRemoteCard({
  stream,
  index,
}: BroadcastRemoteCardProps) {
  const { t } = useI18n();
  const participantLabel = t("broadcast.participantLabel", { index: index + 1 });

  return (
    <article
      aria-labelledby={`remote-stream-${index}`}
      className="overflow-hidden rounded-2xl border border-black/8 bg-white/72 shadow-[0_12px_30px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
    >
      <h3
        id={`remote-stream-${index}`}
        className="border-b border-black/8 bg-white/70 px-3 py-2 text-xs font-semibold text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400"
      >
        {participantLabel}
      </h3>

      <div
        className="h-[170px] bg-black"
        aria-label={t("broadcast.participantStreamAria", { name: participantLabel })}
      >
        <StreamView stream={stream} />
      </div>
    </article>
  );
}