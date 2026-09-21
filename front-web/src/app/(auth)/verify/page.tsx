"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useI18n } from "@/i18n";

type VerifyResponse = {
  message: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
};

type ResendResponse = {
  message: string;
  userId: string;
  target: string;
  devCode?: string;
};

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { setAuth } = useAuth();

  const userId = searchParams.get("userId") || "";
  const initialEmail = searchParams.get("email") || "";
  const initialDevCode = searchParams.get("devCode") || "";

  const [targetDisplay, setTargetDisplay] = useState(initialEmail);
  const [code, setCode] = useState(initialDevCode);
  const [devCode, setDevCode] = useState(initialDevCode);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const maskedTarget = useMemo(() => {
    if (!targetDisplay) return "votre adresse e-mail";
    if (targetDisplay.includes("@")) {
      const [name, domain] = targetDisplay.split("@");
      if (name.length <= 2) return `${name.slice(0, 1)}***@${domain}`;
      return `${name[0]}***${name[name.length - 1]}@${domain}`;
    }
    return targetDisplay;
  }, [targetDisplay]);

  async function handleVerify(codeToVerify?: string) {
    const val = (codeToVerify ?? code).trim();
    if (val.length < 4) {
      setError(t("auth.verify.errorInvalidCode"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<VerifyResponse>("/verify", {
        method: "POST",
        body: JSON.stringify({
          userId: userId || undefined,
          email: initialEmail || undefined,
          code: val,
        }),
      });

      if (res.token && res.user) {
        setAuth({
          token: res.token,
          user: res.user,
        });
        setIsSuccess(true);
        setTimeout(() => {
          router.replace("/home");
        }, 1200);
      } else {
        setIsSuccess(true);
        setTimeout(() => {
          router.replace("/signin");
        }, 1200);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || t("auth.verify.errorInvalidCode"));
      } else {
        setError(t("auth.verify.errorGeneric"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    setResendNotice(null);

    try {
      const res = await apiFetch<ResendResponse>("/resend-code", {
        method: "POST",
        body: JSON.stringify({
          userId: userId || undefined,
          email: initialEmail || undefined,
        }),
      });

      if (res.target) {
        setTargetDisplay(res.target);
      }
      if (res.devCode) {
        setDevCode(res.devCode);
        setCode(res.devCode);
      }
      setResendNotice(t("auth.verify.resendSuccess"));
      setCountdown(60);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || t("auth.verify.errorGeneric"));
      } else {
        setError(t("auth.verify.errorGeneric"));
      }
    } finally {
      setResending(false);
    }
  }

  function handleCodeChange(val: string) {
    // Only accept digits, max 6 characters
    const digitsOnly = val.replace(/\D/g, "").slice(0, 6);
    setCode(digitsOnly);
    setError(null);

    // Auto-submit when 6 digits are typed
    if (digitsOnly.length === 6) {
      handleVerify(digitsOnly);
    }
  }

  if (isSuccess) {
    return (
      <AuthCard
        label={t("auth.verify.label")}
        title={t("auth.verify.title")}
        subtitle="Compte vérifié avec succès !"
      >
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-500 ring-8 ring-green-500/10">
            <CheckCircle2 className="h-10 w-10 animate-bounce" />
          </div>
          <p className="text-sm text-gray-300">
            Votre compte est désormais activé. Redirection en cours…
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      label={t("auth.verify.label")}
      title={t("auth.verify.title")}
      subtitle={t("auth.verify.subtitle", { target: maskedTarget })}
      bottomText=""
      bottomLinkHref=""
      bottomLinkLabel=""
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify();
        }}
        className="space-y-5"
      >
        {/* Destination email badge */}
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3.5 py-2.5 text-xs text-gray-400 border border-white/10">
          <Mail className="h-4 w-4 text-orange-400 shrink-0" />
          <span>
            Code envoyé à :{" "}
            <strong className="text-white font-medium">{maskedTarget}</strong>
          </span>
        </div>

        {/* 6-Digit Code Input */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            {t("auth.verify.codeLabel")}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="000000"
              disabled={loading}
              className="w-full text-center tracking-[0.6em] text-2xl font-mono font-bold py-3.5 px-4 rounded-xl bg-black/40 border border-white/15 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition"
              autoFocus
            />
          </div>
        </div>

        {/* Dev mode helper */}
        {devCode && (
          <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
            <span>{t("auth.verify.devNotice", { code: devCode })}</span>
            <button
              type="button"
              onClick={() => {
                setCode(devCode);
                handleVerify(devCode);
              }}
              className="font-semibold underline hover:text-amber-200 ml-2 cursor-pointer"
            >
              Remplir & Valider
            </button>
          </div>
        )}

        {/* Notices and errors */}
        {resendNotice && (
          <p className="text-sm font-medium text-green-400 text-center">
            {resendNotice}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-red-500 text-center"
          >
            {error}
          </p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading || code.trim().length < 4}
          className="auth-btn-primary"
        >
          {loading ? t("auth.verify.submitting") : t("auth.verify.submit")}
        </button>

        {/* Resend code footer */}
        <div className="flex items-center justify-between pt-2 text-xs text-gray-400 border-t border-white/10">
          <Link
            href="/signin"
            className="inline-flex items-center gap-1 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("auth.verify.backToSignin")}
          </Link>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || countdown > 0}
            className="inline-flex items-center gap-1.5 font-medium text-orange-400 hover:text-orange-300 disabled:text-gray-500 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`}
            />
            {countdown > 0
              ? t("auth.verify.resendWait", { seconds: countdown })
              : t("auth.verify.resend")}
          </button>
        </div>
      </form>
    </AuthCard>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-white">Chargement…</div>}>
      <VerifyContent />
    </Suspense>
  );
}
