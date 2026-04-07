"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import AuthCard from "@/components/auth/AuthCard";
import PasswordField from "@/components/auth/PasswordField";
import { useAuthSubmit } from "@/lib/useAuthSubmit";
import { apiFetch } from "@/lib/api";

type LoginResponse = {
  token: string;
};

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();
  const { setAuth } = useAuth();
  const { submit, loading, error, setError } = useAuthSubmit<LoginResponse>();

  const canSubmit = email.trim() && password.length > 0;

  return (
    <AuthCard
      label="Connexion"
      title="Bienvenue"
      bottomText="Vous n'avez pas de compte ?"
      bottomLinkHref="/signup"
      bottomLinkLabel="INSCRIVEZ-VOUS"
      showForgotPassword
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const login = await submit("/login", {
              email: email.trim().toLowerCase(),
              password,
            });

            if (!login?.token) {
              console.error("LOGIN bad response:", login);
              setError("Réponse invalide du serveur (token manquant).");
              return;
            }
            const user = await apiFetch<any>("/users/me", {
              method: "GET",
              headers: {
                Authorization: `Bearer ${login.token}`,
              },
            });

            if (!user?.id) {
              console.error("ME bad response:", user);
              setError("Impossible de récupérer votre profil.");
              return;
            }
            setAuth({ token: login.token, user });

            router.replace("/home");
          } catch {

          }
        }}
        className="space-y-4"
      >
        <div className="field focus-within:ring-2 focus-within:ring-amber-400">
          <Mail className="h-5 w-5 text-gray-600" />
          <input
            className="input"
            type="email"
            required
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <PasswordField value={password} onChange={setPassword} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading || !canSubmit} className="btn-primary">
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </AuthCard>
  );
}
