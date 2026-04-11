export default function ProfileProgressRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  const safe = Math.max(0, Math.min(100, percent));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
        <span className="font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </span>
        <span>{value}</span>
      </div>

      <div className="h-2 w-full rounded-full bg-black/[0.06] dark:bg-white/10">
        <div
          className="h-2 rounded-full bg-orange-500"
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}