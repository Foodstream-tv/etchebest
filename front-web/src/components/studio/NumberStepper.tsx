"use client";

import { Minus, Plus } from "lucide-react";

import { useI18n } from "@/i18n/LanguageContext";

type NumberStepperProps = Readonly<{
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  ariaLabel: string;
  /** Show an empty field instead of "0" (optional durations). */
  emptyWhenZero?: boolean;
}>;

// Same height as the field between them (h-12), so the three read as one big control.
const buttonClass =
  "group inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-200/80 bg-orange-50 text-orange-600 shadow-sm transition active:scale-90 hover:bg-orange-500 hover:text-[#1a0f05] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-orange-50 disabled:hover:text-orange-600 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500 dark:hover:text-[#1a0f05] dark:disabled:hover:bg-orange-500/10 dark:disabled:hover:text-orange-300";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 5,
  unit = "min",
  ariaLabel,
  emptyWhenZero = false,
}: NumberStepperProps) {
  const { t } = useI18n();

  const safeValue = Number.isFinite(value) ? value : min;

  return (
    <div className="flex w-full items-stretch gap-2">
      <button
        type="button"
        className={buttonClass}
        aria-label={`${t("common.decrease")} – ${ariaLabel}`}
        onClick={() => onChange(clamp(safeValue - step, min, max))}
        disabled={safeValue <= min}
      >
        <Minus className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="fs-field relative flex h-12 min-w-0 flex-1 items-center rounded-2xl border border-black/8 bg-white focus-within:border-orange-400 dark:border-white/10 dark:bg-[#1f1712]/80">
        {/* key={value}: remounting replays the pulse each time the number changes */}
        <span
          key={safeValue}
          aria-hidden="true"
          className="fs-bump-ring pointer-events-none absolute inset-0 rounded-2xl"
        />

        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={Number.isFinite(max) ? max : undefined}
          aria-label={ariaLabel}
          value={emptyWhenZero && safeValue === 0 ? "" : safeValue}
          placeholder="0"
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(Number.isFinite(next) ? clamp(next, min, max) : min);
          }}
          className="h-full min-w-0 flex-1 bg-transparent pl-4 pr-1 text-center text-lg font-bold text-gray-900 outline-none placeholder:text-gray-300 dark:text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        {unit ? (
          <span className="pointer-events-none pr-4 text-sm font-semibold text-gray-400 dark:text-gray-500">
            {unit}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        className={buttonClass}
        aria-label={`${t("common.increase")} – ${ariaLabel}`}
        onClick={() => onChange(clamp(safeValue + step, min, max))}
        disabled={safeValue >= max}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
