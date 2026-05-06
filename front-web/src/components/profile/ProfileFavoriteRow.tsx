export default function ProfileFavoriteRow({
  title,
  meta,
}: {
  title: string;
  meta: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-3 py-3 text-sm ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
      <div className="min-w-0">
        <div className="truncate font-semibold text-gray-800 dark:text-gray-200">
          {title}
        </div>
        <div className="truncate text-[11px] text-gray-500 dark:text-gray-400">
          {meta}
        </div>
      </div>

      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
        Voir →
      </span>
    </div>
  );
}