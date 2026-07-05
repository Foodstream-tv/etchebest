import Link from "next/link";
import type { ReactNode } from "react";
import { Flame } from "lucide-react";

type AuthCardProps = Readonly<{
  label: string;
  title: string;
  subtitle?: string;
  bottomText?: string;
  bottomLinkHref?: string;
  bottomLinkLabel?: string;
  showForgotPassword?: boolean;
  children: ReactNode;
}>;

export default function AuthCard({
  label,
  title,
  subtitle,
  bottomText,
  bottomLinkHref,
  bottomLinkLabel,
  showForgotPassword = false,
  children,
}: AuthCardProps) {
  return (
    <section
      aria-labelledby="auth-card-title"
      className="mx-auto w-full max-w-md"
    >
      <div className="relative overflow-hidden rounded-[32px] border border-black/8 bg-white/78 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/72 dark:shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[32px] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03)_26%,transparent_58%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_26%,transparent_58%)]"
        />

        <div className="relative z-10 mb-6">
          <div className="flex items-center gap-2">
            <Flame
              className="h-4 w-4 text-orange-500 dark:text-orange-400"
              aria-hidden="true"
            />

            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-orange-500 dark:text-orange-400">
              {label}
            </p>
          </div>

          <h1
            id="auth-card-title"
            className="mt-3 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] text-gray-900 dark:text-gray-50"
          >
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
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
                Mot de passe oublié ?
              </Link>
            </div>
          ) : null}

          {bottomText && bottomLinkHref && bottomLinkLabel ? (
            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              <span>{bottomText} </span>

              <Link
                href={bottomLinkHref}
                className="font-semibold uppercase tracking-wide text-orange-500 transition hover:text-orange-400"
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