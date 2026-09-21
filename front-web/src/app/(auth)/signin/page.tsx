"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useAuthSubmit } from "@/lib/useAuthSubmit";
import { apiFetch, ApiError } from "@/lib/api";
import { BANNED_ERROR, formatBanMessage } from "@/lib/session";
import { useI18n } from "@/i18n";
import AuthCard from "@/components/auth/AuthCard";
import TextField from "@/components/auth/TextField";
import PasswordField from "@/components/auth/PasswordField";
import OAuthButton from "@/components/auth/OAuthButton";

type LoginResponse = {
  token: string;
};

type MeResponse = {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackError = params.get("error");
  const resetSuccess = params.get("reset") === "success";
  const { t, locale } = useI18n();

  const { setAuth } = useAuth();
  const { submit, loading, error, setError } = useAuthSubmit<LoginResponse>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [unverifiedInfo, setUnverifiedInfo] = useState<{ userId?: string; email?: string } | null>(null);

  const hasError = Boolean(error || callbackError);

  const canSubmit = useMemo(() => {
    return isValidEmail(email) && password.length >= 1;
  }, [email, password]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUnverifiedInfo(null);

    if (!isValidEmail(email)) {
      setError(t("auth.signin.invalidEmail"));
      return;
    }

    if (!password.trim()) {
      setError(t("auth.signin.emptyPassword"));
      return;
    }

    try {
      const login = await submit("/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      if (!login?.token) {
        setError(t("auth.signin.serverError"));
        return;
      }

      const user = await apiFetch<MeResponse>("/users/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${login.token}`,
        },
      });

      if (!user?.id) {
        setError(t("auth.signin.fetchProfileError"));
        return;
      }

      setAuth(
        {
          token: login.token,
          user,
        },
        rememberMe
      );

      router.replace("/home");
    } catch (err) {
      console.error("Login error:", err);

      if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.body?.code === "ACCOUNT_NOT_VERIFIED"
      ) {
        setUnverifiedInfo({
          userId: err.body?.userId,
          email: err.body?.email || email,
        });
        setError(t("auth.signin.notVerified"));
        return;
      }

      if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.body?.error === BANNED_ERROR
      ) {
        setError(formatBanMessage(err.body?.bannedUntil, locale));
        return;
      }

      if (err instanceof ApiError && err.status === 401) {
        setError(t("auth.signin.invalidCreds"));
        return;
      }

      setError(t("auth.signin.genericError"));
    }
  }

  return (
    <AuthCard
      label={t("auth.signin.label")}
      title={t("auth.signin.title")}
      subtitle={t("auth.signin.subtitle")}
      bottomText={t("auth.signin.noAccount")}
      bottomLinkHref="/signup"
      bottomLinkLabel={t("auth.signin.signupLink")}
    >
      {resetSuccess ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300"
        >
          {t("auth.reset.success")}
        </div>
      ) : null}

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
          aria-describedby={hasError ? "signin-error" : undefined}
        />

        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder={t("auth.signin.passwordPlaceholder")}
          autoComplete="current-password"
          disabled={loading}
          aria-describedby={hasError ? "signin-error" : undefined}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-3 text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-gray-300 accent-amber-500"
            />
            <span>{t("auth.signin.rememberMe")}</span>
          </label>

          <Link
            href="/forgot-password"
            className="text-xs font-medium text-orange-500 transition hover:text-orange-400 hover:underline dark:text-orange-400 dark:hover:text-orange-300"
          >
            {t("auth.signin.forgotPassword")}
          </Link>
        </div>

        {hasError ? (
          <div className="space-y-1">
            <p
              id="signin-error"
              role="alert"
              className="text-sm font-medium text-red-500"
            >
              {error || t("auth.signin.externalAuthError")}
            </p>
            {unverifiedInfo ? (
              <p className="text-xs">
                <Link
                  href={`/verify?userId=${unverifiedInfo.userId || ""}&email=${encodeURIComponent(
                    unverifiedInfo.email || ""
                  )}`}
                  className="font-semibold text-orange-400 hover:text-orange-300 underline"
                >
                  {t("auth.signin.verifyNow")} →
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="auth-btn-primary"
        >
          {loading ? t("auth.signin.submitting") : t("auth.signin.submit")}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        <span>{t("auth.signin.or")}</span>
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      <div className="space-y-3">
        <OAuthButton provider="google" disabled={loading} />
      </div>
    </AuthCard>
  );
}