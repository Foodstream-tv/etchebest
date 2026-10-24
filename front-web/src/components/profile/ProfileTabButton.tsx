import type { ReactNode } from "react";

type ProfileTabButtonProps = Readonly<{
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}>;

export default function ProfileTabButton({
  children,
  active = false,
  onClick,
}: ProfileTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-orange-500 text-[#1a0f05]"
          : "bg-white text-gray-800 ring-1 ring-black/15 shadow-sm hover:bg-[#fffaf2] dark:bg-[#f5ede0]/[0.10] dark:text-[#f5ede0] dark:shadow-none dark:ring-[#f5ede0]/25 dark:hover:bg-[#f5ede0]/[0.18]"
      }`}
    >
      {children}
    </button>
  );
}