export default function FeaturedCreatorRow({
  name,
  tag,
}: {
  name: string;
  tag: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-black/[0.06] dark:bg-white/10" />
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {name}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">{tag}</div>
        </div>
      </div>

      <button className="rounded-xl bg-black/[0.04] px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-black/[0.08] dark:bg-white/[0.05] dark:text-gray-100 dark:hover:bg-white/10">
        Suivre
      </button>
    </div>
  );
}