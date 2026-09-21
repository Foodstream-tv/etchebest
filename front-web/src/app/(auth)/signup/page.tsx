"use client";

import { type FormEvent, useState } from "react";
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const errors: Record<string, string> = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = t("auth.signup.errorEmailRequired");
    } else if (!isValidEmail(trimmedEmail)) {
      errors.email = t("auth.signup.errorEmailInvalid");
    }

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

    if (!password) {
      errors.password = t("auth.signup.errorPasswordRequired");
    } else if (password.length < 8) {
      errors.password = t("auth.signup.errorPassword");
    }

    const trimmedPhone = phoneNumber.trim();
    if (!trimmedPhone) {
      errors.phone = t("auth.signup.errorPhoneRequired");
    } else if (!isValidPhone(trimmedPhone)) {
      errors.phone = t("auth.signup.errorPhone");
    }

    const trimmedBio = description.trim();
    if (!trimmedBio) {
      errors.description = t("auth.signup.errorBioRequired");
    } else if (trimmedBio.length < 10) {
      errors.description = t("auth.signup.errorBioMin", { count: trimmedBio.length });
    } else if (trimmedBio.length > 500) {
      errors.description = t("auth.signup.errorBioMax");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      setError(firstError || t("auth.signup.errorFixFields"));
      return;
    }

    setFieldErrors({});

    try {
      const res = await submit("/register", {
        email: trimmedEmail.toLowerCase(),
        password,
        username: trimmedUsername,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        description: trimmedBio,
        countryNumberPhone: countryCode.value,
        numberPhone: trimmedPhone,
        profileImage: "",
      });

      const params = new URLSearchParams();
      if (res?.userId) params.set("userId", res.userId);
      params.set("email", trimmedEmail.toLowerCase());
      if (res?.devCode) params.set("devCode", res.devCode);

      router.replace(`/verify?${params.toString()}`);
    } catch (err: any) {
      if (
        err?.body?.code === "EMAIL_ALREADY_EXISTS" ||
        err?.message?.toLowerCase().includes("email is already being used")
      ) {
        const errorMsg = t("auth.signup.errorEmailExists");
        setFieldErrors((prev) => ({ ...prev, email: errorMsg }));
        setError(errorMsg);
      } else if (
        err?.body?.code === "USERNAME_ALREADY_EXISTS" ||
        err?.message?.toLowerCase().includes("username is already taken")
      ) {
        const errorMsg = t("auth.signup.errorUsernameExists");
        setFieldErrors((prev) => ({ ...prev, username: errorMsg }));
        setError(errorMsg);
      }
    }
  }

  const bioLength = description.trim().length;

  return (
    <AuthCard
      label={t("auth.signup.label")}
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      bottomText={t("auth.signup.hasAccount")}
      bottomLinkHref="/signin"
      bottomLinkLabel={t("auth.signup.signinLink")}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
              <p className="text-gray-500 dark:text-gray-400">
                {bioLength < 10
                  ? t("auth.signup.bioMinHelper", {
                      count: 10 - bioLength,
                      plural: 10 - bioLength > 1 ? "s" : "",
                    })
                  : t("auth.signup.bioValidHelper")}
              </p>
            )}
            <span
              className={`font-mono font-medium ${
                bioLength < 10
                  ? "text-amber-500 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {bioLength} / 10 min (max 500)
            </span>
          </div>
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

        <button
          type="submit"
          disabled={loading}
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
