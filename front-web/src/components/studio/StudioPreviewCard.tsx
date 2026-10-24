import Image from "next/image";

import formatPreviewDate from "@/components/studio/formatPreviewDate";
import { useI18n } from "@/i18n/LanguageContext";

export default function StudioPreviewCard({
  safeImage,
  previewTitle,
  previewTags,
  date,
  time,
}: Readonly<{
  safeImage: string;
  previewTitle: string;
  previewTags: readonly string[];
  date: string;
  time: string;
}>) {
  const { t, locale } = useI18n();

  return (
    <article
      aria-labelledby="studio-preview-title"
      className="rounded-[28px] border border-black/8 bg-white/72 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#1f1712]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
    >
      <h3
        id="studio-preview-title"
        className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/80"
      >
        {t("studio.broadcast.preview")}
      </h3>

      <div className="overflow-hidden rounded-2xl border border-black/8 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="relative h-44 w-full overflow-hidden bg-black/5 dark:bg-white/5">
          {safeImage ? (
            <Image
              src={safeImage}
              alt={t("studio.broadcast.previewAlt", { title: previewTitle })}
              fill
              sizes="(max-width: 768px) 100vw, 360px"
              className="object-cover"
              // Object URLs cannot be processed by Next.js's image optimizer.
              unoptimized
              priority
            />
          ) : (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_30%_20%,#f6e7d2_0%,#e9d9c2_70%)] px-6 text-center dark:bg-[radial-gradient(ellipse_at_30%_20%,#3a2616_0%,#1a120c_72%)]"
              role="img"
              aria-label={t("studio.preview.placeholder")}
            >
              <svg
                viewBox="0 0 120 80"
                className="h-16 w-24 text-[#8a6a4a] dark:text-[#d9ccb6]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="60" cy="40" r="28" />
                <circle cx="60" cy="40" r="19" opacity="0.55" />
                <path d="M14 14v22c0 4 3 6 6 6s6-2 6-6V14M20 14v52" />
                <path d="M106 14c-6 4-8 12-8 22 0 4 2 6 5 6h3V14zM106 42v24" />
              </svg>
              <p className="max-w-[16rem] text-xs font-medium text-[#6b5236] dark:text-[#d9ccb6]/80">
                {t("studio.preview.placeholder")}
              </p>
            </div>
          )}

          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-[#1a0f05] shadow-sm">
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-white"
              aria-hidden="true"
            />
            LIVE
          </span>
        </div>

        <div className="space-y-2 p-4">
          {previewTags.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-label={t("watch.liveTagsAria")}>
              {previewTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-700 ring-1 ring-orange-100 dark:bg-white/5 dark:text-white/80 dark:ring-white/10"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <p className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-50 break-all [overflow-wrap:anywhere]">
            {previewTitle}
          </p>

          <p className="text-xs text-gray-500 dark:text-white/50">
            {t("studio.preview.byYou")} • {formatPreviewDate(date, t("common.today"), locale)}, {time}
          </p>
        </div>
      </div>
    </article>
  );
}
