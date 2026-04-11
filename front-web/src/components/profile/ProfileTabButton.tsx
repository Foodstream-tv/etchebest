type ProfileTabButtonProps = {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
};

export default function ProfileTabButton({
  children,
  active = false,
  onClick,
}: ProfileTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-orange-500 text-white"
          : "bg-black/[0.04] text-gray-700 hover:bg-black/[0.08] dark:bg-white/[0.05] dark:text-gray-200 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}