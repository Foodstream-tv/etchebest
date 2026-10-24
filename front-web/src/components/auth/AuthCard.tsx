import Link from "next/link";
import type { ReactNode } from "react";
import { authDisplay } from "@/components/auth/authFont";
import { useI18n } from "@/i18n";

type AuthCardProps = Readonly<{
  /** Kept for the existing call sites; the eyebrow label is no longer rendered. */
  label?: string;
  title: string;
  subtitle?: string;
  bottomText?: string;
  bottomLinkHref?: string;
  bottomLinkLabel?: string;
  showForgotPassword?: boolean;
  children: ReactNode;
}>;

export default function AuthCard({
  title,
  subtitle,
  bottomText,
  bottomLinkHref,
  bottomLinkLabel,
  showForgotPassword = false,
  children,
}: AuthCardProps) {
  const { t } = useI18n();
  return (
    <section
      aria-labelledby="auth-card-title"
      className="mx-auto w-full max-w-[600px]"
    >
      <div className="relative overflow-hidden rounded-[28px] border border-black/10 bg-white p-7 shadow-[0_24px_70px_rgba(60,35,10,0.12)] dark:border-white/12 dark:bg-[#1f1712] dark:shadow-[0_24px_80px_rgba(0,0,0,0.5)] md:p-10">
        <div className="relative z-10 mb-6">
          <h1
            id="auth-card-title"
            className={`${authDisplay.className} text-[2.85rem] font-semibold leading-[1.05] tracking-[-0.02em] text-[#1f1711] dark:text-[#f5ede0]`}
          >
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-3 text-lg leading-7 text-[#1f1711]/70 dark:text-[#f5ede0]/70">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="relative z-10">
          {children}

          {showForgotPassword ? (
            <div className="mt-5 text-right">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-orange-500 transition hover:text-orange-400 hover:underline"
              >
                {t("auth.signin.forgotPassword")}
              </Link>
            </div>
          ) : null}

          {bottomText && bottomLinkHref && bottomLinkLabel ? (
            <p className="mt-7 text-center text-base text-[#1f1711]/70 dark:text-[#f5ede0]/70">
              <span>{bottomText} </span>

              <Link
                href={bottomLinkHref}
                className="font-semibold text-[#1f1711] underline decoration-orange-500 decoration-2 underline-offset-4 transition hover:text-orange-600 dark:text-[#f5ede0] dark:hover:text-orange-300"
              >
                {bottomLinkLabel}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}