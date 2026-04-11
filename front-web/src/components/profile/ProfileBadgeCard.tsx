export default function ProfileBadgeCard({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle?: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl bg-black/[0.03] p-3 text-center ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
      <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
        {title}
      </div>
      {subtitle ? (
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          {subtitle}
        </div>
      ) : (
        <div className="h-4" />
      )}
      <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        {meta}
      </div>
    </div>
  );
}