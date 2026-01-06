"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import Input from "@/components/Form/Input";
import AuthBackground from "@/components/AuthBackground";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      if (!res.ok) throw new Error("Envoi impossible");
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <AuthBackground>
      <section className="mx-auto flex w-full max-w-md flex-col px-5 py-6">
        <h1 className="text-center text-xl font-medium text-white/90">
          Mot de passe oublié
        </h1>

        <div className="mt-6 rounded-3xl bg-white/85 p-5 shadow-xl backdrop-blur-md">
          <h2 className="mb-4 text-center text-2xl font-semibold">
            Réinitialisation
          </h2>

          {sent ? (
            <p className="text-center text-sm">
              Si un compte existe pour <strong>{email}</strong>, un e-mail de
              réinitialisation a été envoyé.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                type="email"
                required
                placeholder="Adresse e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="h-5 w-5 text-gray-600" />}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="btn-primary">
                Envoyer le lien
              </button>
            </form>
          )}

          <div className="mt-5 text-center text-sm">
            <Link href="/signin" className="text-gray-700 underline">
              Retour à la connexion
            </Link>
          </div>
        </div>
      </section>
    </AuthBackground>
  );
}
