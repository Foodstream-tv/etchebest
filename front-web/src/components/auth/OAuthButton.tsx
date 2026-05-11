"use client";

import { startSocialAuth, type SocialProvider } from "@/lib/socialAuth";

type OAuthButtonProps = {
  provider: SocialProvider;
  disabled?: boolean;
};

export default function OAuthButton({
  provider,
  disabled = false,
}: OAuthButtonProps) {
  const isGoogle = provider === "google";
  const label = isGoogle ? "Continuer avec Google" : "Continuer avec Apple";
  const logoSrc = isGoogle ? "/images/icons8-logo-google-16.png" : "/images/icons8-mac-os-50.png";

  return (
    <button
      type="button"
      onClick={() => startSocialAuth(provider)}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-black/8 bg-white/70 px-4 text-sm font-medium text-gray-900 shadow-sm backdrop-blur-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.045] dark:text-gray-50 dark:hover:bg-white/[0.08]"
    >
      <img src={logoSrc} alt={provider} className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );
}