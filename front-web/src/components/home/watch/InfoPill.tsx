import React from "react";

export default function InfoPill({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl bg-black/[0.04] px-3 py-2 text-sm text-gray-700 dark:bg-white/[0.05] dark:text-white/75">
      {icon}
      <span>{text}</span>
    </div>
  );
}