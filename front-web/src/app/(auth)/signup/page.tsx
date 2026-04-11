"use client";

import { useMemo, useState } from "react";
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

type RegisterResponse = {
  token?: string;
  user?: {
    id: string;
    email: string;
    username: string;
  };
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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
  const { submit, loading, error, setError } = useAuthSubmit<RegisterResponse>();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [description, setDescription] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>(COUNTRY_CODES[0]);

  const canSubmit = useMemo(() => {
    return (
      isValidEmail(email) &&
      minLen(firstName, 2) &&
      minLen(lastName, 2) &&
      minLen(username, 3) &&
      password.length >= 6 &&
      inRange(description, 10, 500) &&
      isValidPhone(phoneNumber)
    );
  }, [email, firstName, lastName, username, password, description, phoneNumber]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Email invalide.");
      return;
    }

    if (!minLen(firstName, 2)) {
      setError("Le prénom doit faire au moins 2 caractères.");
      return;
    }

    if (!minLen(lastName, 2)) {
      setError("Le nom doit faire au moins 2 caractères.");
      return;
    }

    if (!minLen(username, 3)) {
      setError("L'identifiant doit faire au moins 3 caractères.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }

    if (!inRange(description, 10, 500)) {
      setError("La description doit faire entre 10 et 500 caractères.");
      return;
    }

    if (!isValidPhone(phoneNumber)) {
      setError("Numéro de téléphone invalide.");
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
      label="Inscription"
      title="Créer un compte"
      subtitle="Rejoignez FoodStream et personnalisez votre profil."
      bottomText="Vous avez déjà un compte ?"
      bottomLinkHref="/signin"
      bottomLinkLabel="Connectez-vous"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          icon={Mail}
          value={email}
          onChange={setEmail}
          placeholder="Adresse e-mail"
          type="email"
          autoComplete="email"
          required
          disabled={loading}
        />

        <TextField
          icon={User}
          value={firstName}
          onChange={setFirstName}
          placeholder="Prénom"
          autoComplete="given-name"
          required
          disabled={loading}
        />

        <TextField
          icon={User}
          value={lastName}
          onChange={setLastName}
          placeholder="Nom"
          autoComplete="family-name"
          required
          disabled={loading}
        />

        <TextField
          icon={User}
          value={username}
          onChange={setUsername}
          placeholder="Identifiant"
          autoComplete="nickname"
          required
          disabled={loading}
        />

        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Mot de passe"
          autoComplete="new-password"
          disabled={loading}
        />

        <PhoneField
          country={countryCode}
          onCountryChange={setCountryCode}
          phone={phoneNumber}
          onPhoneChange={setPhoneNumber}
          disabled={loading}
        />

        <TextAreaField
          icon={FileText}
          value={description}
          onChange={setDescription}
          placeholder="Parlez-nous de vous… (10 à 500 caractères)"
          required
          disabled={loading}
          maxLength={500}
        />

        {error ? <p className="text-sm font-medium text-red-500">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="auth-btn-primary"
        >
          {loading ? "Création…" : "S'inscrire"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        <span>ou</span>
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      <div className="space-y-3">
        <OAuthButton provider="google" disabled={loading} />
        <OAuthButton provider="apple" disabled={loading} />
      </div>
    </AuthCard>
  );
}