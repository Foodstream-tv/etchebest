"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Glasses, RotateCcw, X } from "lucide-react";

import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";
import {
  COLOR_BLIND_MODES,
  TEXT_SIZES,
  type ColorBlindMode,
  type TextSize,
} from "@/lib/accessibility";
import { COLOR_BLIND_SWATCHES } from "@/lib/accessibilitySwatches";
import { ORANGE_GRADIENT_CSS } from "@/lib/ui/colors";
import { useI18n } from "@/i18n/LanguageContext";

type Props = {
  /** `nav`: round icon button for the top bar. `floating`: fixed corner button (auth pages). */
  variant?: "nav" | "floating";
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function AccessibilityButton({ variant = "nav" }: Props) {
  const { t } = useI18n();
  const { settings, update, reset, isCustomized } = useAccessibility();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const trigger = triggerRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

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
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [isOpen]);

  const sizeLabel = (size: TextSize) => t(`a11y.textSize.${size}`);
  const modeLabel = (mode: ColorBlindMode) => t(`a11y.cb.${mode}`);
  const modeHint = (mode: ColorBlindMode) => t(`a11y.cb.${mode}.hint`);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={t("a11y.open")}
        title={t("a11y.open")}
        className={cx(
          "inline-flex h-10 items-center justify-center gap-2 rounded-full text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 active:scale-95 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white",
          // `relative` must not be set on the floating one: it would override `fixed` and leave the button in the page flow.
          variant === "nav" && "relative px-3",
          variant === "floating" &&
            "fixed bottom-5 right-5 z-40 h-12 border border-black/10 bg-white px-4 shadow-lg dark:border-white/15 dark:bg-neutral-900"
        )}
      >
        <Glasses className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="text-sm font-semibold">{t("a11y.open")}</span>
        {isCustomized ? (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-neutral-950"
            style={{ background: ORANGE_GRADIENT_CSS }}
          />
        ) : null}
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="home-filters-overlay fixed inset-0 z-[60] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={() => setIsOpen(false)}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="a11y-title"
                aria-describedby="a11y-description"
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
                className="home-filters-panel flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-black/5 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] outline-none sm:max-w-xl sm:rounded-[28px] dark:border-white/10 dark:bg-neutral-950"
              >
                <header className="flex items-start gap-4 border-b border-black/5 px-5 pb-4 pt-5 sm:px-7 sm:pt-6 dark:border-white/10">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[#1a0f05]"
                    style={{ background: ORANGE_GRADIENT_CSS }}
                    aria-hidden="true"
                  >
                    <Glasses className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      id="a11y-title"
                      className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white"
                    >
                      {t("a11y.title")}
                    </h2>
                    <p
                      id="a11y-description"
                      className="mt-0.5 text-sm text-gray-600 dark:text-gray-400"
                    >
                      {t("a11y.description")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label={t("common.close")}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </header>

                <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5 sm:px-7">
                  {/* Text size */}
                  <section aria-labelledby="a11y-text-title">
                    <h3
                      id="a11y-text-title"
                      className="text-sm font-bold text-gray-900 dark:text-white"
                    >
                      {t("a11y.textSize.title")}
                    </h3>
                    <div
                      role="radiogroup"
                      aria-labelledby="a11y-text-title"
                      className="mt-3 grid grid-cols-3 gap-2"
                    >
                      {TEXT_SIZES.map((size, index) => {
                        const selected = settings.textSize === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => update({ textSize: size })}
                            className={cx(
                              "flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition active:scale-95",
                              selected
                                ? "border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-500/10 dark:text-orange-300"
                                : "border-black/10 bg-white text-gray-800 hover:border-black/25 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100"
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className="font-semibold leading-none"
                              style={{ fontSize: `${1 + index * 0.4}rem` }}
                            >
                              Aa
                            </span>
                            <span className="text-xs font-semibold">
                              {sizeLabel(size)} · {size} %
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* High contrast */}
                  <section aria-labelledby="a11y-contrast-title">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h3
                          id="a11y-contrast-title"
                          className="text-sm font-bold text-gray-900 dark:text-white"
                        >
                          {t("a11y.contrast.title")}
                        </h3>
                        <p
                          id="a11y-contrast-desc"
                          className="mt-0.5 text-sm text-gray-600 dark:text-gray-400"
                        >
                          {t("a11y.contrast.desc")}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={settings.contrast === "high"}
                        aria-labelledby="a11y-contrast-title"
                        aria-describedby="a11y-contrast-desc"
                        onClick={() =>
                          update({
                            contrast: settings.contrast === "high" ? "normal" : "high",
                          })
                        }
                        className={cx(
                          "relative h-8 w-14 shrink-0 rounded-full border transition",
                          settings.contrast === "high"
                            ? "border-orange-600 bg-orange-500"
                            : "border-gray-400 bg-gray-200 dark:border-gray-500 dark:bg-white/10"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cx(
                            "absolute top-0.5 grid h-6 w-6 place-items-center rounded-full bg-white shadow transition-all",
                            settings.contrast === "high" ? "left-[1.75rem]" : "left-0.5"
                          )}
                        >
                          {settings.contrast === "high" ? (
                            <Check className="h-3.5 w-3.5 text-orange-600" />
                          ) : null}
                        </span>
                      </button>
                    </div>
                  </section>

                  {/* Colour vision */}
                  <section aria-labelledby="a11y-cb-title">
                    <h3
                      id="a11y-cb-title"
                      className="text-sm font-bold text-gray-900 dark:text-white"
                    >
                      {t("a11y.cb.title")}
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                      {t("a11y.cb.desc")}
                    </p>
                    <div
                      role="radiogroup"
                      aria-labelledby="a11y-cb-title"
                      className="mt-3 grid gap-2"
                    >
                      {COLOR_BLIND_MODES.map((mode) => {
                        const selected = settings.colorBlind === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => update({ colorBlind: mode })}
                            className={cx(
                              "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]",
                              selected
                                ? "border-orange-500 bg-orange-50 dark:border-orange-400 dark:bg-orange-500/10"
                                : "border-black/10 bg-white hover:border-black/25 dark:border-white/10 dark:bg-white/[0.04]"
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cx(
                                "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                                selected
                                  ? "border-orange-600 bg-orange-500 text-[#1a0f05] dark:border-orange-400"
                                  : "border-gray-400 dark:border-gray-500"
                              )}
                            >
                              {selected ? <Check className="h-3 w-3" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                                {modeLabel(mode)}
                              </span>
                              <span className="block text-xs text-gray-600 dark:text-gray-400">
                                {modeHint(mode)}
                              </span>
                            </span>
                            <span className="flex shrink-0 -space-x-1" aria-hidden="true">
                              {COLOR_BLIND_SWATCHES[mode].map((color, index) => (
                                <span
                                  key={index}
                                  className="h-5 w-5 rounded-full border-2 border-white dark:border-neutral-900"
                                  style={{ background: color }}
                                />
                              ))}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Live preview, rendered with the active palette */}
                  <section aria-labelledby="a11y-preview-title">
                    <h3
                      id="a11y-preview-title"
                      className="text-sm font-bold text-gray-900 dark:text-white"
                    >
                      {t("a11y.preview.title")}
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 p-4 dark:border-white/10">
                      <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                        {t("a11y.preview.live")}
                      </span>
                      <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                        {t("a11y.preview.scheduled")}
                      </span>
                      <span className="rounded-full bg-green-700 px-3 py-1 text-xs font-bold text-white">
                        {t("a11y.preview.done")}
                      </span>
                      <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-gray-900">
                        {t("a11y.preview.warning")}
                      </span>
                      <span
                        className="rounded-full px-3 py-1 text-xs font-bold text-[#1a0f05]"
                        style={{ background: ORANGE_GRADIENT_CSS }}
                      >
                        {t("a11y.preview.brand")}
                      </span>
                      <p className="mt-1 w-full text-sm text-gray-700 dark:text-gray-300">
                        {t("a11y.preview.text")}
                      </p>
                    </div>
                  </section>
                </div>

                <footer className="flex items-center gap-3 border-t border-black/5 px-5 py-4 sm:px-7 dark:border-white/10">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={!isCustomized}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-black/10 px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-gray-100 dark:hover:bg-white/10"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {t("a11y.reset")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="ml-auto h-11 flex-1 rounded-2xl px-6 text-sm font-semibold text-[#1a0f05] transition active:scale-95 sm:flex-none"
                    style={{ background: ORANGE_GRADIENT_CSS }}
                  >
                    {t("a11y.done")}
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
