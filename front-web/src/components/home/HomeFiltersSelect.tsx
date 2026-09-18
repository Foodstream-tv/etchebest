"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";

import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";

type FilterGroup = Readonly<{
  label: string;
  tags: readonly string[];
}>;

type HomeFiltersSelectProps = Readonly<{
  groups: readonly FilterGroup[];
  label: string;
  description: string;
  closeLabel: string;
  selectedLabel: string;
  value: string;
  onChange: (tag: string) => void;
}>;

export default function HomeFiltersSelect({
  groups,
  label,
  description,
  closeLabel,
  selectedLabel,
  value,
  onChange,
}: HomeFiltersSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const selectTag = (tag: string) => {
    onChange(tag);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="flex h-12 items-center gap-2 rounded-2xl border border-black bg-white px-3 text-sm font-semibold text-black shadow-sm transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
        <span className="max-w-24 truncate border-l border-black/15 pl-2 font-medium">
          {selectedLabel}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-filters-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-xl overflow-y-auto rounded-3xl border border-black/10 bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-7"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <p id="home-filters-title" className="text-lg font-semibold text-black">
                  {label}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={closeLabel}
                className="rounded-full p-2 text-black transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h3 className="text-sm font-semibold text-black">{group.label}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.tags.map((tag) => {
                      const isSelected = tag === value;

                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => selectTag(tag)}
                          aria-pressed={isSelected}
                          style={
                            isSelected
                              ? { background: ORANGE_GRADIENT_CSS }
                              : undefined
                          }
                          className={[
                            "rounded-xl border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2",
                            isSelected
                              ? "border-orange-500 text-white shadow-sm"
                              : "border-black/15 bg-white text-black hover:border-black hover:bg-stone-50",
                          ].join(" ")}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )
        : null}
    </>
  );
}
