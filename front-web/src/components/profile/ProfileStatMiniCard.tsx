export default function ProfileStatMiniCard({
  value,
  label,
}: Readonly<{
  value: string;
  label: string;
}>) {
  return (
    <article
      aria-label={`${label} : ${value}`}
      className="rounded-2xl bg-black/[0.03] p-3 text-center ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10"
    >
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </article>
  );
}