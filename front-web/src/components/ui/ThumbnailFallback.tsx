/**
 * Default visual for a live or replay that has no thumbnail: a warm dark plate with a plate and cutlery.
 * Always dark, in both themes, because the cards put white text over their thumbnail.
 * Fills its (relatively positioned) parent.
 */
export default function ThumbnailFallback({
  className = "",
}: Readonly<{ className?: string }>) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_30%_20%,#3a2616_0%,#1a120c_72%)] ${className}`}
    >
      <svg
        viewBox="0 0 120 80"
        className="h-16 w-24 text-[#d9ccb6]/60"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <circle cx="60" cy="40" r="28" />
        <circle cx="60" cy="40" r="19" opacity="0.55" />
        <path d="M14 14v22c0 4 3 6 6 6s6-2 6-6V14M20 14v52" />
        <path d="M106 14c-6 4-8 12-8 22 0 4 2 6 5 6h3V14zM106 42v24" />
      </svg>
    </div>
  );
}
