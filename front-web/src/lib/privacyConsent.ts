export type PrivacyConsent = "necessary" | "all";

export const PRIVACY_CONSENT_COOKIE = "fs_privacy_consent";

export function isPrivacyConsent(value: string | undefined): value is PrivacyConsent {
  return value === "necessary" || value === "all";
}

export function readPrivacyConsentCookie(): PrivacyConsent | null {
  if (typeof document === "undefined") {
    return null;
  }

  const value = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${PRIVACY_CONSENT_COOKIE}=`))
    ?.split("=")[1];

  return isPrivacyConsent(value) ? value : null;
}

export function writePrivacyConsentCookie(consent: PrivacyConsent) {
  document.cookie = `${PRIVACY_CONSENT_COOKIE}=${consent}; path=/; max-age=31536000; samesite=lax`;
}

export function clearPrivacyConsentCookie() {
  document.cookie = `${PRIVACY_CONSENT_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
