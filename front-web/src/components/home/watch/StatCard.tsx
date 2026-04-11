import React from "react";

export default function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-black/8 bg-white/72 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-3 inline-flex rounded-2xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
        {icon}
      </div>

      <p className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  );
}