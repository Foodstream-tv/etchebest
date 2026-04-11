export type SocialProvider = "google" | "apple";

export function startSocialAuth(provider: SocialProvider) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const callbackUrl = `${window.location.origin}/auth/callback`;
  const url = `${apiBase}/auth/${provider}?redirect=${encodeURIComponent(callbackUrl)}`;
  window.location.href = url;
}