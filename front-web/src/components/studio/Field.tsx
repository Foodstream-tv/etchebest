import React from "react";

export default function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <label className="block text-sm font-semibold text-gray-800 dark:text-white/80">
        {label}
      </label>
      {children}
    </div>
  );
}