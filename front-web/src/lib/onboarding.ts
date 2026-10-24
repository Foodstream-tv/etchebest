// Onboarding answers collected right after sign-up.
// The backend has no field for them yet, so they are kept in this browser, per
// user. Swap `saveOnboarding` / `readOnboarding` for an API call once the
// profile model carries these fields.

export type CookingLevel = "beginner" | "intermediate" | "advanced";
export type AvailableTime = "15" | "30" | "45" | "60";

export type OnboardingPreferences = {
  cuisines: string[];
  availableTime: AvailableTime | null;
  level: CookingLevel | null;
  diets: string[];
  completedAt: string;
  skipped?: boolean;
};

const KEY_PREFIX = "fs_onboarding:";

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export function readOnboarding(userId: string): OnboardingPreferences | null {
  if (typeof window === "undefined" || !userId) return null;

  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as OnboardingPreferences) : null;
  } catch {
    return null;
  }
}

export function saveOnboarding(
  userId: string,
  prefs: Omit<OnboardingPreferences, "completedAt">
) {
  if (typeof window === "undefined" || !userId) return;

  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ ...prefs, completedAt: new Date().toISOString() })
    );
  } catch {
    // Storage can be unavailable (private mode): onboarding is a nicety, never block on it.
  }
}
