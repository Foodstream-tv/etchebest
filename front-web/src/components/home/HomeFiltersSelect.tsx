"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, RotateCcw, SlidersHorizontal, X, type LucideIcon } from "lucide-react";

import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";

type FilterGroup = Readonly<{
  label: string;
  icon?: LucideIcon;
  tags: readonly string[];
}>;

type HomeFiltersSelectProps = Readonly<{
  groups: readonly FilterGroup[];
  label: string;
  description: string;
  closeLabel: string;
  resetLabel: string;
  applyLabel: string;
  /** Selected tags; an empty list means no filter. */
  value: readonly string[];
  onChange: (tags: string[]) => void;
}>;

/** Prevents the page behind the modal from scrolling while it is open. */
function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const { body, documentElement } = document;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    const previous = {
      htmlOverflow: documentElement.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
    };

    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";
    // Compensate for the disappearing scrollbar to avoid a layout shift.
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      documentElement.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.paddingRight = previous.bodyPaddingRight;
    };
  }, [locked]);
}

export default function HomeFiltersSelect({
  groups,
  label,
  description,
  closeLabel,
  resetLabel,
  applyLabel,
  value,
  onChange,
}: HomeFiltersSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([...value]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const trigger = triggerRef.current;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      // Keep keyboard focus inside the dialog.
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])"
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [isOpen]);

  const open = () => {
    setDraft([...value]);
    setIsOpen(true);
  };

  const toggleTag = (tag: string) => {
    setDraft((current) =>
      current.includes(tag)
        ? current.filter((selected) => selected !== tag)
        : [...current, tag]
    );
  };

  const apply = () => {
    const hasChanged =
      draft.length !== value.length || draft.some((tag) => !value.includes(tag));
    if (hasChanged) onChange(draft);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="flex h-12 items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm transition hover:border-black/25 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/10 dark:focus-visible:ring-offset-neutral-950"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="home-filters-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={() => setIsOpen(false)}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="home-filters-title"
                aria-describedby="home-filters-description"
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
                className="home-filters-panel flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-black/5 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] outline-none sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:max-w-xl sm:rounded-[28px] dark:border-white/10 dark:bg-neutral-950"
              >
                {/* Grab handle (mobile bottom sheet affordance) */}
                <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
                  <span className="h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/15" />
                </div>

                <header className="flex items-start gap-4 border-b border-black/5 px-5 pb-4 pt-3 sm:px-7 sm:pt-6 dark:border-white/10">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-[0_8px_20px_rgba(249,115,22,0.3)]"
                    style={{ background: ORANGE_GRADIENT_CSS }}
                    aria-hidden="true"
                  >
                    <SlidersHorizontal className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      id="home-filters-title"
                      className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white"
                    >
                      {label}
                    </h2>
                    <p
                      id="home-filters-description"
                      className="mt-0.5 text-sm text-gray-500 dark:text-gray-400"
                    >
                      {description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label={closeLabel}
                    className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-500 transition hover:bg-black/5 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </header>

                <div className="flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
                  {groups.map((group) => {
                    const Icon = group.icon;
                    const selectedCount = group.tags.filter((tag) =>
                      draft.includes(tag)
                    ).length;

                    return (
                      <section key={group.label} aria-label={group.label}>
                        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                          {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                          {group.label}
                          {selectedCount > 0 ? (
                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-orange-100 px-1.5 text-[11px] font-bold tracking-normal text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                              {selectedCount}
                            </span>
                          ) : null}
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {group.tags.map((tag) => {
                            const isSelected = draft.includes(tag);

                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleTag(tag)}
                                aria-pressed={isSelected}
                                style={
                                  isSelected
                                    ? { background: ORANGE_GRADIENT_CSS }
                                    : undefined
                                }
                                className={[
                                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-[0.97] dark:focus-visible:ring-offset-neutral-950",
                                  isSelected
                                    ? "border-transparent text-white shadow-[0_6px_16px_rgba(249,115,22,0.3)]"
                                    : "border-black/10 bg-stone-50 text-gray-800 hover:border-orange-300 hover:bg-orange-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:border-orange-400/40 dark:hover:bg-orange-500/10",
                                ].join(" ")}
                              >
                                {isSelected ? (
                                  <Check className="-ml-1 h-4 w-4" aria-hidden="true" />
                                ) : null}
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>

                <footer className="flex items-center gap-3 border-t border-black/5 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-5 dark:border-white/10 dark:bg-neutral-950">
                  <button
                    type="button"
                    onClick={() => setDraft([])}
                    disabled={draft.length === 0}
                    className="inline-flex h-12 items-center gap-2 rounded-2xl px-3 text-sm font-semibold text-gray-700 underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline dark:text-gray-200 dark:disabled:text-gray-600"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {resetLabel}
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    className="ml-auto h-12 flex-1 rounded-2xl px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:flex-none dark:focus-visible:ring-offset-neutral-950"
                    style={{ background: ORANGE_GRADIENT_CSS }}
                  >
                    {applyLabel}
                  </button>
                </footer>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
