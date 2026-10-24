import { API_BASE_URL } from "@/lib/api";

export type SocialProvider = "google";

export function startSocialAuth(provider: SocialProvider) {
  // API_BASE_URL falls back to "/api" (proxied to the backend by next.config.ts),
  // so the button works even when NEXT_PUBLIC_API_BASE_URL is not set.
  const callbackUrl = `${window.location.origin}/auth/callback`;
  const url = `${API_BASE_URL}/auth/${provider}?redirect=${encodeURIComponent(callbackUrl)}`;
  // /api is proxied to the backend, not a Next page: the browser must really leave the app.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = url;
}
