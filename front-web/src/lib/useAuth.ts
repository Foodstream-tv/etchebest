"use client";

import { useCallback, useEffect, useState } from "react";

import { SESSION_TOKEN } from "@/lib/session";

export type User = {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  description?: string;
  role?: string;
  countryNumberPhone?: number;
  numberPhone?: string;
  createdAt?: string;
  updatedAt?: string;
};

// Only the profile is kept in the browser. The session token is an httpOnly cookie set by the
// API: scripts (and any injected script) never read it.
export type AuthState = {
  user: User;
};

const STORAGE_KEY = "fs_auth";

function parseStored(raw: string | null): AuthState | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { user?: User; token?: string };
  if (!parsed?.user) return null;
  return { user: parsed.user };
}

function readAuth(): AuthState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    const auth = parseStored(raw);
    if (raw && auth && raw.includes('"token"')) {
      // Left over from before the cookie: drop the token that was stored in clear.
      const store = localStorage.getItem(STORAGE_KEY) ? localStorage : sessionStorage;
      store.setItem(STORAGE_KEY, JSON.stringify(auth));
    }
    return auth;
  } catch {
    return null;
  }
}

function saveAuth(auth: AuthState, rememberMe: boolean) {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);

  (rememberMe ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify({ user: auth.user }));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  // The httpOnly cookie can only be removed by the server.
  if (typeof window !== "undefined") {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  }
}

export function useAuth() {
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthState(readAuth());
    setReady(true);

    const onStorage = () => {
      setAuthState(readAuth());
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setAuth = useCallback((nextAuth: AuthState | null, rememberMe = true) => {
    if (!nextAuth) {
      clearAuth();
      setAuthState(null);
      return;
    }

    saveAuth(nextAuth, rememberMe);
    setAuthState(nextAuth);
  }, []);

  const signOut = useCallback(async () => {
    setAuth(null);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
  }, [setAuth]);

  return {
    auth,
    token: auth ? SESSION_TOKEN : null,
    user: auth?.user ?? null,
    ready,
    setAuth,
    signOut,
  };
}
