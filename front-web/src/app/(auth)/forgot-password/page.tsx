"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import TextField from "@/components/auth/TextField";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }
      );

      if (!res.ok) {
        throw new Error("Envoi impossible.");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      label="Réinitialisation"
      title={sent ? "Email envoyé" : "Mot de passe oublié"}
      subtitle={
        sent
          ? "Vérifiez votre boîte mail pour réinitialiser votre mot de passe."
          : "Entrez votre adresse e-mail pour recevoir un lien de réinitialisation."
      }
      bottomText="Vous vous souvenez de votre mot de passe ?"
      bottomLinkHref="/signin"
      bottomLinkLabel="Connexion"
    >
      {!sent ? (
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

          {error ? <p className="text-sm font-medium text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="auth-btn-primary"
          >
            {loading ? "Envoi…" : "Envoyer le lien"}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          Un email de réinitialisation a été envoyé.
        </div>
      )}

      {!sent ? (
        <div className="mt-5 text-center">
          <Link
            href="/signin"
            className="text-sm font-medium text-orange-500 transition hover:text-orange-400 hover:underline"
          >
            Retour à la connexion
          </Link>
        </div>
      ) : null}
    </AuthCard>
  );
}