"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import TextField from "@/components/auth/TextField";
import { useI18n } from "@/i18n";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }
      );

      if (!res.ok) {
        throw new Error(t("auth.forgot.errorFailed"));
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.forgot.errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      label={t("auth.forgot.label")}
      title={sent ? t("auth.forgot.titleSent") : t("auth.forgot.title")}
      subtitle={
        sent
          ? t("auth.forgot.subtitleSent")
          : t("auth.forgot.subtitle")
      }
      bottomText={t("auth.forgot.rememberPassword")}
      bottomLinkHref="/signin"
      bottomLinkLabel={t("auth.forgot.signinLink")}
    >
      {!sent ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <TextField
            icon={Mail}
            value={email}
            onChange={setEmail}
            placeholder={t("auth.signin.emailPlaceholder")}
            type="email"
            autoComplete="email"
            required
            disabled={loading}
            aria-describedby={error ? "forgot-password-error" : undefined}
          />

          {error ? (
            <p
              id="forgot-password-error"
              role="alert"
              className="text-sm font-medium text-red-500"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="auth-btn-primary"
          >
            {loading ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
          </button>
        </form>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300"
        >
          {t("auth.forgot.sentBanner")}
        </div>
      )}

      {!sent ? (
        <div className="mt-5 text-center">
          <Link
            href="/signin"
            className="text-sm font-medium text-orange-500 transition hover:text-orange-400 hover:underline"
          >
            {t("auth.forgot.backToSignin")}
          </Link>
        </div>
      ) : null}
    </AuthCard>
  );
}