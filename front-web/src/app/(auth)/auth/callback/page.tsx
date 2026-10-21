"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { SESSION_TOKEN } from "@/lib/session";

type MeResponse = {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { setAuth } = useAuth();
  const hasHandledCallback = useRef(false);

  // The API already stored the session in its httpOnly cookie: only a success flag comes back.
  const success = params.get("success");
  const error = params.get("error");

  useEffect(() => {
    // Saving the session updates this component's local auth state. Handle the
    // OAuth response only once so that update cannot start another callback
    // request before the route transition completes.
    if (hasHandledCallback.current) return;
    hasHandledCallback.current = true;

    async function run() {
      if (error) {
        router.replace(`/signin?error=${encodeURIComponent(error)}`);
        return;
      }

      if (!success) {
        router.replace("/signin?error=auth_callback_missing_token");
        return;
      }

      try {
        const user = await apiFetch<MeResponse>("/users/me", {
          method: "GET",
          token: SESSION_TOKEN,
        });

        if (!user?.id) {
          router.replace("/signin?error=auth_callback_invalid_user");
          return;
        }

        setAuth({ user });
        router.replace("/home");
      } catch {
        router.replace("/signin?error=auth_callback_failed");
      }
    }

    void run();
  }, [error, router, setAuth, success]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-12"
    >
      <div className="rounded-3xl border border-black/8 bg-white/80 px-8 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/72 dark:shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-gray-600 dark:text-gray-300"
        >
          Connexion en cours…
        </p>
      </div>
    </main>
  );
}
