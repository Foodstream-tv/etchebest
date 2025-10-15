"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Input from "@/components/Form/Input";
import AuthBackground from "@/components/AuthBackground";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Identifiants invalides");
      // TODO: rediriger vers /dashboard après login
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[440px] flex-col items-center justify-center px-4">
        {/* Bloc blanc */}
        <div className="w-full rounded-2xl bg-white/90 p-6 shadow-2xl ring-1 ring-black/5 backdrop-blur-md">
          <h1 className="mb-1 text-center text-sm font-medium text-gray-600">Connexion</h1>
          <h2 className="mb-5 text-center text-2xl font-semibold text-gray-900">Bienvenue</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="field focus-within:ring-2 focus-within:ring-amber-400">
              <Mail className="h-5 w-5 text-gray-600" />
              <input
                className="input"
                type="email"
                required
                placeholder="Adresse e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field focus-within:ring-2 focus-within:ring-amber-400">
              <Lock className="h-5 w-5 text-gray-600" />
              <input
                className="input"
                type={showPassword ? "text" : "password"}
                required
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="rounded p-1 text-gray-600 hover:bg-gray-100"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3 text-xs text-gray-500">
            <span className="h-px w-full bg-gray-200" />
            <span>Ou</span>
            <span className="h-px w-full bg-gray-200" />
          </div>

          {/* Social */}
          <div className="space-y-3">
            <a href="#" className="btn-google">
              Connexion avec Google
            </a>
            <a href="#" className="btn-facebook">
              Connexion avec Facebook
            </a>
          </div>

          <div className="mt-4 text-center text-sm">
            <Link href="/forgot-password" className="text-gray-700 underline">
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        {/* Phrase directement sous le bloc */}
        <p className="mt-3 text-center text-sm text-gray-800">
          Vous n'avez pas de compte ?{" "}
          <Link
            href="/signup"
            className="font-semibold text-amber-600 underline underline-offset-2 hover:text-amber-500"
          >
            INSCRIVEZ-VOUS
          </Link>
        </p>
      </section>
    </AuthBackground>
  );
}
