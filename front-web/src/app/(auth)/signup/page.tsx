"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Mail, User, FileText } from "lucide-react";
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
import { useAuthSubmit } from "@/lib/useAuthSubmit";
import { useI18n } from "@/i18n";

type RegisterResponse = {
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

function inRange(value: string, min: number, max: number) {
  const len = value.trim().length;
  return len >= min && len <= max;
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

  const errorId = error ? "signup-error" : undefined;

  const canSubmit = useMemo(() => {
    return (
      isValidEmail(email) &&
      minLen(firstName, 2) &&
      minLen(lastName, 2) &&
      minLen(username, 3) &&
      password.length >= 8 &&
      inRange(description, 10, 500) &&
      isValidPhone(phoneNumber)
    );
  }, [email, firstName, lastName, username, password, description, phoneNumber]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError(t("auth.signin.invalidEmail"));
      return;
    }

    if (!minLen(firstName, 2)) {
      setError(t("auth.signup.errorFirstName"));
      return;
    }

    if (!minLen(lastName, 2)) {
      setError(t("auth.signup.errorLastName"));
      return;
    }

    if (!minLen(username, 3)) {
      setError(t("auth.signup.errorUsername"));
      return;
    }

    if (password.length < 8) {
      setError(t("auth.signup.errorPassword"));
      return;
    }

    if (!inRange(description, 10, 500)) {
      setError(t("auth.signup.errorBioLen"));
      return;
    }

    if (!isValidPhone(phoneNumber)) {
      setError(t("auth.signup.errorPhone"));
      return;
    }

    await submit("/register", {
      email: email.trim().toLowerCase(),
      password,
      username: username.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      description: description.trim(),
      countryNumberPhone: countryCode.value,
      numberPhone: phoneNumber.trim(),
      profileImage: "",
    });

    router.replace("/signin");
  }

  return (
    <AuthCard
      label={t("auth.signup.label")}
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      bottomText={t("auth.signup.hasAccount")}
      bottomLinkHref="/signin"
      bottomLinkLabel={t("auth.signup.signinLink")}
    >
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
          aria-describedby={errorId}
        />

        <TextField
          icon={User}
          value={firstName}
          onChange={setFirstName}
          placeholder={t("auth.signup.firstName")}
          autoComplete="given-name"
          required
          disabled={loading}
          aria-describedby={errorId}
        />

        <TextField
          icon={User}
          value={lastName}
          onChange={setLastName}
          placeholder={t("auth.signup.lastName")}
          autoComplete="family-name"
          required
          disabled={loading}
          aria-describedby={errorId}
        />

        <TextField
          icon={User}
          value={username}
          onChange={setUsername}
          placeholder={t("auth.signup.username")}
          autoComplete="nickname"
          required
          disabled={loading}
          aria-describedby={errorId}
        />

        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder={t("auth.signin.passwordPlaceholder")}
          autoComplete="new-password"
          disabled={loading}
          aria-describedby={errorId}
        />

        <PhoneField
          country={countryCode}
          onCountryChange={setCountryCode}
          phone={phoneNumber}
          onPhoneChange={setPhoneNumber}
          disabled={loading}
          aria-describedby={errorId}
        />

        <TextAreaField
          icon={FileText}
          value={description}
          onChange={setDescription}
          placeholder={t("auth.signup.bioPlaceholder")}
          required
          disabled={loading}
          maxLength={500}
          aria-describedby={errorId}
        />

        {error ? (
          <p
            id="signup-error"
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
          {loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
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
