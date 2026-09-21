"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import PasswordField from "@/components/auth/PasswordField";
import { useI18n } from "@/i18n";
import { apiFetch, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { t } = useI18n();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(token && password.length >= 8 && confirmPassword.length >= 8);
  }, [token, password, confirmPassword]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(t("auth.reset.errorMissingToken"));
      return;
    }

    if (password.length < 8) {
      setError(t("auth.reset.errorLength"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.reset.errorMatch"));
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });

      router.push("/signin?reset=success");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || t("auth.reset.errorInvalidToken"));
      } else {
        setError(err instanceof Error ? err.message : t("auth.reset.errorInvalidToken"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      label={t("auth.reset.label")}
      title={t("auth.reset.title")}
      subtitle={t("auth.reset.subtitle")}
      bottomText={t("auth.forgot.rememberPassword")}
      bottomLinkHref="/signin"
      bottomLinkLabel={t("auth.forgot.signinLink")}
    >
      {!token ? (
        <div className="space-y-4">
          <div
            role="alert"
            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
          >
            {t("auth.reset.errorMissingToken")}
          </div>
          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-orange-500 transition hover:text-orange-400 hover:underline"
            >
              {t("auth.forgot.title")} →
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              {t("auth.reset.newPassword")}
            </label>
            <PasswordField
              value={password}
              onChange={setPassword}
              placeholder={t("auth.reset.newPassword")}
              autoComplete="new-password"
              required
              disabled={loading}
              hasError={Boolean(error)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              {t("auth.reset.confirmPassword")}
            </label>
            <PasswordField
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder={t("auth.reset.confirmPassword")}
              autoComplete="new-password"
              required
              disabled={loading}
              hasError={Boolean(error)}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="text-sm font-medium text-red-500"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="auth-btn-primary"
          >
            {loading ? t("auth.reset.submitting") : t("auth.reset.submit")}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
