import type { ReactNode } from "react";

type StatCardProps = Readonly<{
  label: string;
  value: string;
  icon: ReactNode;
}>;

export default function StatCard({
  label,
  value,
  icon,
}: StatCardProps) {
  return (
    <article
      aria-label={`${label} : ${value}`}
      className="rounded-[28px] border border-black/8 bg-white/72 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
    >
      <div
        aria-hidden="true"
        className="mb-3 inline-flex rounded-2xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200"
      >
        {icon}
      </div>

      <p className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {label}
      </p>
    </article>
  );
}