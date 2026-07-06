"use client";

import Link from "next/link";
import { useState } from "react";
import {
  type PrivacyConsent,
  writePrivacyConsentCookie,
} from "@/lib/privacyConsent";

type CookieConsentBannerProps = Readonly<{
  initialConsent?: PrivacyConsent | null;
}>;

export default function CookieConsentBanner({
  initialConsent = null,
}: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(initialConsent === null);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9998] px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 bg-white/95 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#120b05]/95 dark:shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500 dark:text-orange-400">
              Confidentialité
            </p>

            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Nous utilisons seulement les cookies nécessaires par défaut.
            </h2>

            <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
              FoodStream utilise des cookies fonctionnels pour l’authentification,
              le thème et les préférences de session. Nous n’activons aucun cookie
              non essentiel sans votre accord explicite.
            </p>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Consultez la <Link href="/confidentialite" className="font-medium text-orange-600 underline decoration-orange-400/40 underline-offset-4 transition hover:text-orange-500 dark:text-orange-300">politique de confidentialité</Link> pour connaître vos droits.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <button
              type="button"
              onClick={() => {
                writePrivacyConsentCookie("necessary");
                setVisible(false);
              }}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-black/10 px-4 text-sm font-semibold text-gray-900 transition hover:bg-black/5 dark:border-white/10 dark:text-gray-50 dark:hover:bg-white/10"
            >
              Refuser les non essentiels
            </button>

            <button
              type="button"
              onClick={() => {
                writePrivacyConsentCookie("all");
                setVisible(false);
              }}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-400"
            >
              Tout accepter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
