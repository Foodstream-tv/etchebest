type BroadcastEmptyStateProps = Readonly<{
  title: string;
  message: string;
}>;

/** Shown inside the (dark) video stage while there is no camera stream. */
export default function BroadcastEmptyState({
  title,
  message,
}: BroadcastEmptyStateProps) {
  return (
    <section
      aria-labelledby="broadcast-empty-title"
      className="grid h-full place-items-center bg-neutral-900 p-6 text-center"
    >
      <div>
        <h2
          id="broadcast-empty-title"
          className="mb-2 text-lg font-semibold tracking-tight text-white"
        >
          {title}
        </h2>

        <p className="mx-auto max-w-sm text-sm leading-7 text-gray-300">
          {message}
        </p>
      </div>
    </section>
  );
}
