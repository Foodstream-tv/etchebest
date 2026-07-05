import { useId } from "react";

type ProfileBadgeCardProps = Readonly<{
  title: string;
  subtitle?: string;
  meta: string;
}>;

export default function ProfileBadgeCard({
  title,
  subtitle,
  meta,
}: ProfileBadgeCardProps) {
  const titleId = useId();

  return (
    <article
      aria-labelledby={titleId}
      className="rounded-2xl bg-black/[0.03] p-3 text-center ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10"
    >
      <h3
        id={titleId}
        className="text-xs font-semibold text-gray-800 dark:text-gray-200"
      >
        {title}
      </h3>

      {subtitle ? (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      ) : (
        <div className="h-4" aria-hidden="true" />
      )}

      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        {meta}
      </p>
    </article>
  );
}