type HomeHeroTagProps = Readonly<{
  label: string;
  onClick?: () => void;
  active?: boolean;
}>;

export default function HomeHeroTag({
  label,
  onClick,
  active = false,
}: HomeHeroTagProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition ${
        active
          ? "border-orange-400 bg-orange-500 text-white"
          : "border-black/8 bg-white/70 text-gray-700 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]"
      }`}
    >
      {label}
    </button>
  );
}