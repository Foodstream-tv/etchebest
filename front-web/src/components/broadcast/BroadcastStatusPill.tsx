export default function BroadcastStatusPill({
  label,
  dotClassName,
}: {
  label: string;
  dotClassName: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/72 px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-50">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClassName}`} />
      <span>{label}</span>
    </div>
  );
}