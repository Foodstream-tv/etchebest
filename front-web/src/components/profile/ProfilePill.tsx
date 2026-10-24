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
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 ${
        active
          ? "bg-orange-500 text-[#1a0f05] shadow-sm"
          : "bg-white text-gray-800 ring-1 ring-black/15 shadow-sm hover:bg-[#fffaf2] dark:bg-[#f5ede0]/[0.10] dark:text-[#f5ede0] dark:shadow-none dark:ring-[#f5ede0]/25 dark:hover:bg-[#f5ede0]/[0.18]"
      }`}
    >
      {children}
    </button>
  );
}