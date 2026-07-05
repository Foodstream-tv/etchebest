export default function ProfileProgressRow({
  label,
  value,
  percent,
}: Readonly<{
  label: string;
  value: string;
  percent: number;
}>) {
  const safePercent = Math.max(0, Math.min(100, percent));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
        <span className="font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </span>

        <span>{value}</span>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safePercent}
        aria-valuetext={value}
        className="h-2 w-full rounded-full bg-black/[0.06] dark:bg-white/10"
      >
        <div
          aria-hidden="true"
          className="h-2 rounded-full bg-orange-500"
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}