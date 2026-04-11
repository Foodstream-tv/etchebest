export default function BroadcastEmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="grid h-full place-items-center bg-[linear-gradient(180deg,rgba(255,255,255,0.5),rgba(243,244,246,0.95))] p-6 text-center dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]">
      <div>
        <div className="mb-2 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          {title}
        </div>
        <div className="mx-auto max-w-sm text-sm leading-7 text-gray-500 dark:text-gray-400">
          {message}
        </div>
      </div>
    </div>
  );
}