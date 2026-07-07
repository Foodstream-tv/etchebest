"use client";

import Image from "next/image";

import { startSocialAuth, type SocialProvider } from "@/lib/socialAuth";

type OAuthButtonProps = Readonly<{
  provider: SocialProvider;
  disabled?: boolean;
}>;

export default function OAuthButton({
  provider,
  disabled = false,
}: OAuthButtonProps) {
  const label = "Continuer avec Google";

  const logoSrc = "/images/icons8-logo-google-16.png";

  return (
    <button
      type="button"
      onClick={() => startSocialAuth(provider)}
      disabled={disabled}
      aria-label={label}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-black/8 bg-white/70 px-4 text-sm font-medium text-gray-900 shadow-sm backdrop-blur-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.045] dark:text-gray-50 dark:hover:bg-white/[0.08]"
    >
      <Image
        src={logoSrc}
        alt=""
        width={20}
        height={20}
        aria-hidden="true"
      />

      <span>{label}</span>
    </button>
  );
}