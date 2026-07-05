import Image from "next/image";

import formatPreviewDate from "@/components/studio/formatPreviewDate";

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
  return (
    <article
      aria-labelledby="studio-preview-title"
      className="rounded-[28px] border border-black/8 bg-white/72 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
    >
      <h3
        id="studio-preview-title"
        className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/80"
      >
        Aperçu de la carte live
      </h3>

      <div className="overflow-hidden rounded-2xl border border-black/8 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="relative h-44 w-full">
          <Image
            src={safeImage}
            alt={`Image d'aperçu du live ${previewTitle}`}
            fill
            sizes="(max-width: 768px) 100vw, 360px"
            className="object-cover"
            unoptimized
            priority
          />

          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-white"
              aria-hidden="true"
            />
            LIVE
          </span>
        </div>

        <div className="space-y-2 p-4">
          {previewTags.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-label="Tags du live">
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

          <p className="line-clamp-2 text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            {previewTitle}
          </p>

          <p className="text-xs text-gray-500 dark:text-white/50">
            par Vous • {formatPreviewDate(date)}, {time}
          </p>
        </div>
      </div>
    </article>
  );
}