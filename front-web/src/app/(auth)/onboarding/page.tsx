"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import AuthCard from "@/components/auth/AuthCard";
import {
  type AvailableTime,
  type CookingLevel,
  saveOnboarding,
} from "@/lib/onboarding";
import { useAuth } from "@/lib/useAuth";
import { useI18n } from "@/i18n";

const TOTAL_STEPS = 3;

const CUISINES = [
  "Français",
  "Italien",
  "Asiatique",
  "Japonais",
  "Coréen",
  "Chinois",
  "Indien",
  "Mexicain",
  "Africain",
  "Américain",
  "Méditerranéen",
  "Pâtisserie",
  "Street Food",
  "Healthy",
];

const DIETS = [
  "Végétarien",
  "Vegan",
  "Sans gluten",
  "Sans lactose",
  "Halal",
  "Aucune restriction",
];

const NO_DIET = "Aucune restriction";

function ChoiceChip({
  label,
  active,
  onClick,
}: Readonly<{ label: string; active: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
        active
          ? "bg-orange-500 text-[#1a0f05] shadow-sm"
          : "bg-white/80 text-gray-700 ring-1 ring-black/8 hover:bg-orange-50 hover:text-orange-700 dark:bg-white/5 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-orange-500/10 dark:hover:text-orange-300"
      }`}
    >
      {active ? <Check className="fs-pop h-3.5 w-3.5" aria-hidden="true" /> : null}
      {label}
    </button>
  );
}

function OptionCard({
  label,
  hint,
  active,
  onClick,
}: Readonly<{
  label: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-orange-500 bg-orange-50 ring-2 ring-orange-400/30 dark:bg-orange-500/10"
          : "border-black/8 bg-white/70 hover:border-orange-300 dark:border-white/10 dark:bg-white/[0.04]"
      }`}
    >
      <span className="block text-sm font-semibold text-gray-900 dark:text-white">
        {label}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function toggle(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [availableTime, setAvailableTime] = useState<AvailableTime | null>(null);
  const [level, setLevel] = useState<CookingLevel | null>(null);
  const [diets, setDiets] = useState<string[]>([]);

  const timeOptions: { value: AvailableTime; label: string; hint: string }[] = [
    { value: "15", label: t("onboarding.time.15"), hint: t("onboarding.time.15hint") },
    { value: "30", label: t("onboarding.time.30"), hint: t("onboarding.time.30hint") },
    { value: "45", label: t("onboarding.time.45"), hint: t("onboarding.time.45hint") },
    { value: "60", label: t("onboarding.time.60"), hint: t("onboarding.time.60hint") },
  ];

  const levelOptions: { value: CookingLevel; label: string; hint: string }[] = [
    { value: "beginner", label: t("onboarding.level.beginner"), hint: t("onboarding.level.beginnerHint") },
    { value: "intermediate", label: t("onboarding.level.intermediate"), hint: t("onboarding.level.intermediateHint") },
    { value: "advanced", label: t("onboarding.level.advanced"), hint: t("onboarding.level.advancedHint") },
  ];

  const goHome = () => router.replace("/home");

  const finish = (skipped: boolean) => {
    if (user?.id) {
      saveOnboarding(user.id, {
        cuisines: skipped ? [] : cuisines,
        availableTime: skipped ? null : availableTime,
        level: skipped ? null : level,
        diets: skipped ? [] : diets.filter((item) => item !== NO_DIET),
        skipped,
      });
    }
    goHome();
  };

  const toggleDiet = (value: string) => {
    if (value === NO_DIET) {
      setDiets((prev) => (prev.includes(NO_DIET) ? [] : [NO_DIET]));
      return;
    }
    setDiets((prev) => toggle(prev.filter((item) => item !== NO_DIET), value));
  };

  const isLast = step === TOTAL_STEPS;

  return (
    <AuthCard
      label={t("onboarding.label")}
      title={t("onboarding.title")}
      subtitle={t("onboarding.subtitle")}
    >
      <div className="space-y-6">
        <div>
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-valuenow={step}
            aria-label={t("onboarding.stepOf", {
              current: step,
              total: TOTAL_STEPS,
            })}
            className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
          >
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            {t("onboarding.stepOf", { current: step, total: TOTAL_STEPS })}
          </p>
        </div>

        {step === 1 ? (
          <fieldset key="s1" className="fs-rise space-y-3">
            <legend className="text-base font-semibold text-gray-900 dark:text-gray-50">
              {t("onboarding.cuisine.title")}
            </legend>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("onboarding.cuisine.hint")}
            </p>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((item) => (
                <ChoiceChip
                  key={item}
                  label={item}
                  active={cuisines.includes(item)}
                  onClick={() => setCuisines((prev) => toggle(prev, item))}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <div key="s2" className="fs-rise space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-base font-semibold text-gray-900 dark:text-gray-50">
                {t("onboarding.time.title")}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {timeOptions.map((item) => (
                  <OptionCard
                    key={item.value}
                    label={item.label}
                    hint={item.hint}
                    active={availableTime === item.value}
                    onClick={() => setAvailableTime(item.value)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-base font-semibold text-gray-900 dark:text-gray-50">
                {t("onboarding.level.title")}
              </legend>
              <div className="grid gap-2">
                {levelOptions.map((item) => (
                  <OptionCard
                    key={item.value}
                    label={item.label}
                    hint={item.hint}
                    active={level === item.value}
                    onClick={() => setLevel(item.value)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}

        {step === 3 ? (
          <fieldset key="s3" className="fs-rise space-y-3">
            <legend className="text-base font-semibold text-gray-900 dark:text-gray-50">
              {t("onboarding.diet.title")}
            </legend>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("onboarding.diet.hint")}
            </p>
            <div className="flex flex-wrap gap-2">
              {DIETS.map((item) => (
                <ChoiceChip
                  key={item}
                  label={item}
                  active={diets.includes(item)}
                  onClick={() => toggleDiet(item)}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => prev - 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("onboarding.back")}
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => (isLast ? finish(false) : setStep((prev) => prev + 1))}
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-[#1a0f05] shadow-sm transition hover:bg-orange-400"
          >
            {isLast ? t("onboarding.finish") : t("onboarding.next")}
            {isLast ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => finish(true)}
          className="mx-auto block text-sm font-medium text-gray-500 underline-offset-4 transition hover:text-orange-500 hover:underline dark:text-gray-400"
        >
          {t("onboarding.skip")}
        </button>
      </div>
    </AuthCard>
  );
}
