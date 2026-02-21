"use client";

import Link from "next/link";
import AuthBackground from "@/components/AuthBackground";

export default function AuthCard({
  label,
  title,
  children,
  bottomText,
  bottomLinkHref,
  bottomLinkLabel,
  showForgotPassword,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  bottomText: string;
  bottomLinkHref: string;
  bottomLinkLabel: string;
  showForgotPassword?: boolean;
}) {
  return (
    <AuthBackground>
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[440px] flex-col items-center justify-center px-4">
        <div className="w-full rounded-2xl bg-white/90 p-6 shadow-2xl ring-1 ring-black/5 backdrop-blur-md">
          <h1 className="mb-1 text-center text-sm font-medium text-gray-600">{label}</h1>
          <h2 className="mb-5 text-center text-2xl font-semibold text-gray-900">{title}</h2>

          {children}

          <div className="my-5 flex items-center gap-3 text-xs text-gray-500">
            <span className="h-px w-full bg-gray-200" />
            <span>Ou</span>
            <span className="h-px w-full bg-gray-200" />
          </div>

          <div className="space-y-3">
            <a href="#" className="btn-google">Connexion avec Google</a>
            <a href="#" className="btn-facebook">Connexion avec Facebook</a>
          </div>

          {showForgotPassword && (
            <div className="mt-4 text-center text-sm">
              <Link href="/forgot-password" className="text-gray-700 underline">
                Mot de passe oublié ?
              </Link>
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-sm text-gray-800">
          {bottomText}{" "}
          <Link
            href={bottomLinkHref}
            className="font-semibold text-amber-600 underline underline-offset-2 hover:text-amber-500"
          >
            {bottomLinkLabel}
          </Link>
        </p>
      </section>
    </AuthBackground>
  );
}
