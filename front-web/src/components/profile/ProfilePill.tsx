import type { ReactNode } from "react";

type ProfilePillProps = Readonly<{
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}>;

export default function ProfilePill({
  children,
  active = false,
  onClick,
}: ProfilePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 ${
        active
          ? "bg-orange-500 text-white shadow-[0_6px_16px_rgba(249,115,22,0.25)]"
          : "bg-black/[0.04] text-gray-700 hover:bg-black/[0.08] dark:bg-white/[0.05] dark:text-gray-200 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}