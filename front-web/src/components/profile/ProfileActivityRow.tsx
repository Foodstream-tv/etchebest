type ProfileActivityRowProps = {
  text: string;
  empty?: boolean;
};

export default function ProfileActivityRow({
  text,
  empty = false,
}: ProfileActivityRowProps) {
  return (
    <div
      className={
        empty
          ? "rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-5 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400"
          : "rounded-2xl bg-black/[0.03] px-3 py-3 text-sm text-gray-700 ring-1 ring-black/5 dark:bg-white/[0.04] dark:text-gray-200 dark:ring-white/10"
      }
    >
      {text}
    </div>
  );
}