"use client";

import { useEffect, useState } from "react";

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

export type AuthState = {
  token: string;
  user: User;
};

const STORAGE_KEY = "fs_auth";

function readStoredAuth(): AuthState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      sessionStorage.getItem(STORAGE_KEY);

    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  document.cookie = "token=; path=/; max-age=0; samesite=lax";
}

function saveStoredAuth(auth: AuthState, rememberMe: boolean) {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(STORAGE_KEY, JSON.stringify(auth));

  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : undefined;

  document.cookie = [
    `token=${auth.token}`,
    "path=/",
    "samesite=lax",
    ...(maxAge ? [`max-age=${maxAge}`] : []),
  ].join("; ");
}

export function useAuth() {
  const [auth, setAuthState] = useState<AuthState | null>(() => readStoredAuth());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthState(readStoredAuth());
    setReady(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;

      try {
        setAuthState(e.newValue ? (JSON.parse(e.newValue) as AuthState) : null);
      } catch {
        setAuthState(null);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setAuth = (nextAuth: AuthState | null, rememberMe = true) => {
    if (nextAuth) {
      saveStoredAuth(nextAuth, rememberMe);
      setAuthState(nextAuth);
    } else {
      clearStoredAuth();
      setAuthState(null);
    }
  };

  const signOut = () => setAuth(null);

  return {
    auth,
    token: auth?.token ?? null,
    user: auth?.user ?? null,
    setAuth,
    signOut,
    ready,
  };
}
