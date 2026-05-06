type ChipProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export default function Chip({ label, active = false, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-gray-900 text-white dark:bg-white dark:text-neutral-900"
          : "bg-black/[0.04] text-gray-800 hover:bg-black/[0.08] dark:bg-white/[0.05] dark:text-white/80 dark:ring-1 dark:ring-white/10 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}