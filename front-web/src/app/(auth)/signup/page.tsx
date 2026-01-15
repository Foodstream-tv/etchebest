"use client";

import { useMemo, useState } from "react";
import { Mail, User } from "lucide-react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import PasswordField from "@/components/auth/PasswordField";
import PhoneField, { COUNTRY_CODES, type CountryCode } from "@/components/auth/PhoneField";
import { useAuth } from "@/lib/useAuth";
import { useAuthSubmit } from "@/lib/useAuthSubmit";

type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
};

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function minLen(v: string, n: number) {
  return v.trim().length >= n;
}

function inRange(v: string, min: number, max: number) {
  const len = v.trim().length;
  return len >= min && len <= max;
}

function isValidPhone(v: string) {
  const digits = v.replace(/[^\d]/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

export default function SignUpPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const { submit, loading, error, setError } = useAuthSubmit<AuthResponse>();
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidEmail(email)) return setError("Email invalide");
    if (!minLen(firstName, 2)) return setError("Le prénom doit faire au moins 2 caractères");
    if (!minLen(lastName, 2)) return setError("Le nom doit faire au moins 2 caractères");
    if (!minLen(username, 3)) return setError("L'identifiant doit faire au moins 3 caractères");
    if (password.length < 6) return setError("Le mot de passe doit faire au moins 6 caractères");
    if (!inRange(description, 10, 500)) return setError("La description doit faire entre 10 et 500 caractères");
    if (!isValidPhone(phoneNumber)) return setError("Numéro de téléphone invalide");

    const payload = {
      email: email.trim().toLowerCase(),
      password,
      username: username.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      description: description.trim(),
      countryNumberPhone: countryCode.value,
      numberPhone: phoneNumber.trim(),
      profileImage: "",
    };

    const data = await submit("/register", payload);
    router.replace("/signin");
  }

  return (
    <AuthCard
      label="Inscription"
      title="Bienvenue"
      bottomText="Vous avez déjà un compte ?"
      bottomLinkHref="/signin"
      bottomLinkLabel="CONNECTEZ-VOUS"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Email */}
        <div className="field focus-within:ring-2 focus-within:ring-amber-400">
          <Mail className="h-5 w-5 text-gray-600" />
          <input
            className="input"
            type="email"
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        {/* Prénom */}
        <div className="field focus-within:ring-2 focus-within:ring-amber-400">
          <User className="h-5 w-5 text-gray-600" />
          <input
            className="input"
            placeholder="Prénom"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
          />
        </div>

        {/* Nom */}
        <div className="field focus-within:ring-2 focus-within:ring-amber-400">
          <User className="h-5 w-5 text-gray-600" />
          <input
            className="input"
            placeholder="Nom"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
          />
        </div>

        {/* Username */}
        <div className="field focus-within:ring-2 focus-within:ring-amber-400">
          <User className="h-5 w-5 text-gray-600" />
          <input
            className="input"
            placeholder="Identifiant"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="nickname"
            required
          />
        </div>

        {/* Password */}
        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Mot de passe"
          autoComplete="new-password"
        />

        {/* Phone with country code */}
        <PhoneField
          country={countryCode}
          onCountryChange={setCountryCode}
          phone={phoneNumber}
          onPhoneChange={setPhoneNumber}
        />

        {/* Description */}
        <div className="field focus-within:ring-2 focus-within:ring-amber-400">
          <User className="h-5 w-5 text-gray-600" />
          <textarea
            className="input min-h-[96px] resize-y py-2"
            placeholder="Parlez-nous de vous… (10 à 500 caractères)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading || !canSubmit} className="btn-primary">
          {loading ? "Création…" : "Inscription"}
        </button>
      </form>
    </AuthCard>
  );
}
