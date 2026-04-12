type HomeHeroTagProps = {
  label: string;
};

export default function HomeHeroTag({ label }: HomeHeroTagProps) {
  return (
    <button className="rounded-full border border-black/8 bg-white/70 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]">
      {label}
    </button>
  );
}