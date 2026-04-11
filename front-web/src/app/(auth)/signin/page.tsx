"use client";

import { useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useAuthSubmit } from "@/lib/useAuthSubmit";
import { apiFetch } from "@/lib/api";
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
  profileImage?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackError = params.get("error");
  const { setAuth } = useAuth();
  const { submit, loading, error, setError } = useAuthSubmit<LoginResponse>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = useMemo(() => {
    return isValidEmail(email) && password.length >= 1;
  }, [email, password]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Adresse e-mail invalide.");
      return;
    }

    if (!password.trim()) {
      setError("Veuillez entrer votre mot de passe.");
      return;
    }

    try {
      const login = await submit("/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      if (!login?.token) {
        setError("Réponse invalide du serveur.");
        return;
      }

      const user = await apiFetch<MeResponse>("/users/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${login.token}`,
        },
      });

      if (!user?.id) {
        setError("Impossible de récupérer votre profil.");
        return;
      }

      setAuth({
        token: login.token,
        user,
      });

      router.replace("/home");
    } catch {
    }
  }

  return (
    <AuthCard
      label="Connexion"
      title="Bienvenue"
      subtitle="Connectez-vous pour accéder à votre univers FoodStream."
      bottomText="Vous n'avez pas de compte ?"
      bottomLinkHref="/signup"
      bottomLinkLabel="Inscrivez-vous"
      showForgotPassword
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

        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Mot de passe"
          autoComplete="current-password"
          disabled={loading}
        />

        {error || callbackError ? (
          <p className="text-sm font-medium text-red-500">
            {error || "Connexion externe impossible."}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="auth-btn-primary"
        >
          {loading ? "Connexion…" : "Se connecter"}
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