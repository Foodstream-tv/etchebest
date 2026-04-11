export default function ProfileActivityRow({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-black/[0.03] px-3 py-3 text-sm text-gray-700 ring-1 ring-black/5 dark:bg-white/[0.04] dark:text-gray-200 dark:ring-white/10">
      {text}
    </div>
  );
}