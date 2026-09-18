"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/LanguageContext";

export default function HomeFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-20 border-t border-black/8 bg-transparent dark:border-white/10">
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Foodstream
            </h2>

            <p className="mt-3 max-w-md text-sm leading-7 text-gray-600 dark:text-gray-400">
              {t("footer.tagline")}
            </p>
          </div>

          <nav aria-labelledby="footer-product-title">
            <h3
              id="footer-product-title"
              className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              {t("footer.product")}
            </h3>

            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>
                <Link href="/watch" className="hover:text-orange-500 dark:hover:text-orange-400 transition">
                  {t("footer.lives")}
                </Link>
              </li>
              <li>
                <Link href="/studio" className="hover:text-orange-500 dark:hover:text-orange-400 transition">
                  {t("footer.studio")}
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-orange-500 dark:hover:text-orange-400 transition">
                  {t("footer.shop")}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-nav-title">
            <h3
              id="footer-nav-title"
              className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              {t("footer.navigation")}
            </h3>

            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>
                <Link href="/home" className="hover:text-orange-500 dark:hover:text-orange-400 transition">
                  {t("footer.home")}
                </Link>
              </li>
              <li>
                <Link href="/replays" className="hover:text-orange-500 dark:hover:text-orange-400 transition">
                  {t("nav.replays")}
                </Link>
              </li>
              <li>
                <Link href="/profile" className="hover:text-orange-500 dark:hover:text-orange-400 transition">
                  {t("footer.myProfile")}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal-title">
            <h3
              id="footer-legal-title"
              className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              {t("footer.legal")}
            </h3>

            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>
                <Link href="/confidentialite" className="hover:text-orange-500 dark:hover:text-orange-400 transition">
                  {t("footer.privacy")}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <p className="mt-8 border-t border-black/8 pt-5 text-xs text-gray-500 dark:border-white/10 dark:text-gray-500">
          {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
}