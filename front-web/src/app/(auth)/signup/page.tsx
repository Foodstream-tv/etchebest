"use client";

import { type FormEvent, useState } from "react";
import { ChevronDown, Mail, User, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import PasswordField from "@/components/auth/PasswordField";
import PhoneField, {
  COUNTRY_CODES,
  type CountryCode,
} from "@/components/auth/PhoneField";
import TextField from "@/components/auth/TextField";
import TextAreaField from "@/components/auth/TextAreaField";
import OAuthButton from "@/components/auth/OAuthButton";
import { ApiError } from "@/lib/api";
import { useAuthSubmit } from "@/lib/useAuthSubmit";
import { useI18n } from "@/i18n";

type RegisterResponse = {
  message?: string;
  userId?: string;
  target?: string;
  devCode?: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    username: string;
  };
};

function isValidEmail(value: string) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
    value.trim()
  );
}

function minLen(value: string, min: number) {
  return value.trim().length >= min;
}

function isValidPhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

export default function SignUpPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { submit, loading, error, setError } = useAuthSubmit<RegisterResponse>();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [description, setDescription] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Step 1: account (e-mail, password). Step 2: profile (everything else).
  const [step, setStep] = useState<1 | 2>(1);
  // Phone and bio are optional: folded away by default to keep the step short.
  const [showMore, setShowMore] = useState(false);

  const errorId = error ? "signup-error" : undefined;

  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
    if (error) setError(null);
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    clearFieldError("email");
  };

  const handleFirstNameChange = (val: string) => {
    setFirstName(val);
    clearFieldError("firstName");
  };

  const handleLastNameChange = (val: string) => {
    setLastName(val);
    clearFieldError("lastName");
  };

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    clearFieldError("username");
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    clearFieldError("password");
  };

  const handlePhoneChange = (val: string) => {
    setPhoneNumber(val);
    clearFieldError("phone");
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    clearFieldError("description");
  };

  const handleAgeChange = (checked: boolean) => {
    setAgeConfirmed(checked);
    clearFieldError("age");
  };

  function validateAccount() {
    const errors: Record<string, string> = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = t("auth.signup.errorEmailRequired");
    } else if (!isValidEmail(trimmedEmail)) {
      errors.email = t("auth.signup.errorEmailInvalid");
    }

    if (!password) {
      errors.password = t("auth.signup.errorPasswordRequired");
    } else if (password.length < 8) {
      errors.password = t("auth.signup.errorPassword");
    }

    return errors;
  }

  function validateProfile() {
    const errors: Record<string, string> = {};

    const trimmedFirstName = firstName.trim();
    if (!trimmedFirstName) {
      errors.firstName = t("auth.signup.errorFirstNameRequired");
    } else if (!minLen(trimmedFirstName, 2)) {
      errors.firstName = t("auth.signup.errorFirstName");
    }

    const trimmedLastName = lastName.trim();
    if (!trimmedLastName) {
      errors.lastName = t("auth.signup.errorLastNameRequired");
    } else if (!minLen(trimmedLastName, 2)) {
      errors.lastName = t("auth.signup.errorLastName");
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      errors.username = t("auth.signup.errorUsernameRequired");
    } else if (!minLen(trimmedUsername, 3)) {
      errors.username = t("auth.signup.errorUsername");
    }

    const trimmedPhone = phoneNumber.trim();
    if (trimmedPhone && !isValidPhone(trimmedPhone)) {
      errors.phone = t("auth.signup.errorPhone");
    }

    if (description.trim().length > 500) {
      errors.description = t("auth.signup.errorBioMax");
    }

    if (!ageConfirmed) {
      errors.age = t("auth.signup.errorAge");
    }

    return errors;
  }

  function goToProfile() {
    const errors = validateAccount();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(Object.values(errors)[0] || t("auth.signup.errorFixFields"));
      return;
    }
    setFieldErrors({});
    setError(null);
    setStep(2);
  }

  function goBackToAccount() {
    setError(null);
    setStep(1);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Enter on the first step moves on to the second one.
    if (step === 1) {
      goToProfile();
      return;
    }

    const accountErrors = validateAccount();
    const errors = { ...accountErrors, ...validateProfile() };

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // An account error found at the last step sends the person back to it.
      if (Object.keys(accountErrors).length > 0) setStep(1);
      const firstError = Object.values(errors)[0];
      setError(firstError || t("auth.signup.errorFixFields"));
      return;
    }

    setFieldErrors({});

    const trimmedEmail = email.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedUsername = username.trim();
    const trimmedPhone = phoneNumber.trim();
    const trimmedBio = description.trim();

    try {
      const res = await submit("/register", {
        email: trimmedEmail.toLowerCase(),
        password,
        username: trimmedUsername,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        ...(trimmedBio ? { description: trimmedBio } : {}),
        ...(trimmedPhone
          ? { countryNumberPhone: countryCode.value, numberPhone: trimmedPhone }
          : {}),
        ageConfirmed: true,
        profileImage: "",
      });

      const params = new URLSearchParams();
      if (res?.userId) params.set("userId", res.userId);
      params.set("email", trimmedEmail.toLowerCase());
      if (res?.devCode) params.set("devCode", res.devCode);

      router.replace(`/verify?${params.toString()}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.body?.code : undefined;
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      if (
        code === "EMAIL_ALREADY_EXISTS" ||
        message.includes("email is already being used")
      ) {
        const errorMsg = t("auth.signup.errorEmailExists");
        setFieldErrors((prev) => ({ ...prev, email: errorMsg }));
        setError(errorMsg);
        setStep(1);
      } else if (
        code === "USERNAME_ALREADY_EXISTS" ||
        message.includes("username is already taken")
      ) {
        const errorMsg = t("auth.signup.errorUsernameExists");
        setFieldErrors((prev) => ({ ...prev, username: errorMsg }));
        setError(errorMsg);
      }
    }
  }

  const bioLength = description.trim().length;
  const optionalOpen = showMore || Boolean(fieldErrors.phone || fieldErrors.description);

  return (
    <AuthCard
      label={t("auth.signup.label")}
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      bottomText={t("auth.signup.hasAccount")}
      bottomLinkHref="/signin"
      bottomLinkLabel={t("auth.signup.signinLink")}
    >
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm font-medium text-[#1f1711]/70 dark:text-[#f5ede0]/70">
          <span>{t("signupSteps.progress", { current: step, total: 2 })}</span>
          <span>{step === 1 ? t("signupSteps.account") : t("signupSteps.profile")}</span>
        </div>
        <div className="mt-2 flex gap-2" aria-hidden="true">
          <span className="h-1.5 flex-1 rounded-full bg-[#1f1711] dark:bg-[#f5ede0]" />
          <span
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              step === 2 ? "bg-[#1f1711] dark:bg-[#f5ede0]" : "bg-black/10 dark:bg-white/15"
            }`}
          />
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {step === 1 ? (
          <>
            <div>
              <TextField
                icon={Mail}
                value={email}
                onChange={handleEmailChange}
                placeholder={t("auth.signin.emailPlaceholder")}
                type="email"
                autoComplete="email"
                disabled={loading}
                hasError={Boolean(fieldErrors.email)}
                aria-describedby={errorId}
              />
              {fieldErrors.email ? (
                <p className="mt-1.5 px-1 text-xs font-medium text-red-500">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div>
              <PasswordField
                value={password}
                onChange={handlePasswordChange}
                placeholder={t("auth.signin.passwordPlaceholder")}
                autoComplete="new-password"
                disabled={loading}
                hasError={Boolean(fieldErrors.password)}
                aria-describedby={errorId}
              />
              {fieldErrors.password ? (
                <p className="mt-1.5 px-1 text-xs font-medium text-red-500">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            {error ? (
              <p
                id="signup-error"
                role="alert"
                className="text-sm font-medium text-red-500"
              >
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={loading} className="auth-btn-primary">
              {t("signupSteps.next")}
            </button>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <TextField
                  icon={User}
                  value={firstName}
                  onChange={handleFirstNameChange}
                  placeholder={t("auth.signup.firstName")}
                  autoComplete="given-name"
                  disabled={loading}
                  hasError={Boolean(fieldErrors.firstName)}
                  aria-describedby={errorId}
                />
                {fieldErrors.firstName ? (
                  <p className="mt-1.5 px-1 text-xs font-medium text-red-500">
                    {fieldErrors.firstName}
                  </p>
                ) : null}
              </div>

              <div>
                <TextField
                  icon={User}
                  value={lastName}
                  onChange={handleLastNameChange}
                  placeholder={t("auth.signup.lastName")}
                  autoComplete="family-name"
                  disabled={loading}
                  hasError={Boolean(fieldErrors.lastName)}
                  aria-describedby={errorId}
                />
                {fieldErrors.lastName ? (
                  <p className="mt-1.5 px-1 text-xs font-medium text-red-500">
                    {fieldErrors.lastName}
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <TextField
                icon={User}
                value={username}
                onChange={handleUsernameChange}
                placeholder={t("auth.signup.username")}
                autoComplete="nickname"
                disabled={loading}
                hasError={Boolean(fieldErrors.username)}
                aria-describedby={errorId}
              />
              {fieldErrors.username ? (
                <p className="mt-1.5 px-1 text-xs font-medium text-red-500">
                  {fieldErrors.username}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={optionalOpen}
              className="flex items-center gap-2 text-sm font-semibold text-[#1f1711] underline-offset-4 hover:underline dark:text-[#f5ede0]"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${optionalOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
              {t("signupSteps.optional")}
            </button>

            {optionalOpen ? (
              <>
                <div>
                  <PhoneField
                    country={countryCode}
                    onCountryChange={setCountryCode}
                    phone={phoneNumber}
                    onPhoneChange={handlePhoneChange}
                    disabled={loading}
                    hasError={Boolean(fieldErrors.phone)}
                    aria-describedby={errorId}
                  />
                  {fieldErrors.phone ? (
                    <p className="mt-1.5 px-1 text-xs font-medium text-red-500">
                      {fieldErrors.phone}
                    </p>
                  ) : null}
                </div>

                <div>
                  <TextAreaField
                    icon={FileText}
                    value={description}
                    onChange={handleDescriptionChange}
                    placeholder={t("auth.signup.bioPlaceholder")}
                    disabled={loading}
                    maxLength={500}
                    hasError={Boolean(fieldErrors.description)}
                    aria-describedby={errorId}
                  />
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 px-1 text-xs">
                    {fieldErrors.description ? (
                      <p className="font-medium text-red-500">
                        {fieldErrors.description}
                      </p>
                    ) : (
                      <span />
                    )}
                    <span className="font-mono font-medium text-gray-500 dark:text-gray-400">
                      {bioLength} / 500
                    </span>
                  </div>
                </div>
              </>
            ) : null}

            {error ? (
              <p
                id="signup-error"
                role="alert"
                className="text-sm font-medium text-red-500"
              >
                {error}
              </p>
            ) : null}

            <div>
              <label
                htmlFor="signup-age"
                className="flex cursor-pointer items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id="signup-age"
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => handleAgeChange(e.target.checked)}
                  disabled={loading}
                  aria-invalid={Boolean(fieldErrors.age)}
                  aria-describedby={fieldErrors.age ? "signup-age-error" : undefined}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-neutral-900 dark:focus-visible:ring-offset-neutral-900"
                />
                <span>{t("auth.signup.ageConfirm")}</span>
              </label>
              {fieldErrors.age ? (
                <p
                  id="signup-age-error"
                  role="alert"
                  className="mt-1.5 px-1 text-xs font-medium text-red-500"
                >
                  {fieldErrors.age}
                </p>
              ) : null}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={goBackToAccount}
                disabled={loading}
                className="rounded-2xl border border-black/20 px-5 py-4 text-base font-semibold text-[#1f1711] transition hover:bg-black/5 disabled:opacity-60 dark:border-white/25 dark:text-[#f5ede0] dark:hover:bg-white/10"
              >
                {t("signupSteps.back")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="auth-btn-primary !w-auto flex-1"
              >
                {loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
              </button>
            </div>

            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
              {t("auth.signup.legalBefore")}
              <Link href="/cgu" className="font-medium underline hover:text-orange-500">
                {t("auth.signup.legalTerms")}
              </Link>
              {t("auth.signup.legalAnd")}
              <Link href="/confidentialite" className="font-medium underline hover:text-orange-500">
                {t("auth.signup.legalPrivacy")}
              </Link>
              .
            </p>
          </>
        )}
      </form>

      {step === 1 ? (
        <>
          <div className="my-5 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            <span>{t("auth.signin.or")}</span>
            <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          </div>

          <div className="space-y-3">
            <OAuthButton provider="google" disabled={loading} />
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
              {t("auth.signup.googleAgeNotice")}
            </p>
          </div>
        </>
      ) : null}
    </AuthCard>
  );
}
