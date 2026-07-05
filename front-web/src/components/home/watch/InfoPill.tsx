import type { ReactNode } from "react";

type InfoPillProps = Readonly<{
  icon: ReactNode;
  text: string;
}>;

export default function InfoPill({ icon, text }: InfoPillProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl bg-black/[0.04] px-3 py-2 text-sm text-gray-700 dark:bg-white/[0.05] dark:text-white/75">
      <span aria-hidden="true">{icon}</span>

      <span>{text}</span>
    </div>
  );
}