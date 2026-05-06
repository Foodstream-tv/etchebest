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
const COOKIE_MAX_AGE_30_DAYS = 60 * 60 * 24 * 30;

function readAuth(): AuthState | null {
  if (typeof window === "undefined") return null;

  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) return JSON.parse(local) as AuthState;

    const session = sessionStorage.getItem(STORAGE_KEY);
    if (session) return JSON.parse(session) as AuthState;

    return null;
  } catch {
    return null;
  }
}

function saveAuth(auth: AuthState, rememberMe: boolean) {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);

  if (rememberMe) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));

    document.cookie = `token=${auth.token}; path=/; max-age=${COOKIE_MAX_AGE_30_DAYS}; samesite=lax`;
  } else {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));

    document.cookie = `token=${auth.token}; path=/; samesite=lax`;
  }
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  document.cookie = "token=; path=/; max-age=0; samesite=lax";
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

  const setAuth = (nextAuth: AuthState | null, rememberMe = true) => {
    if (!nextAuth) {
      clearAuth();
      setAuthState(null);
      return;
    }

    saveAuth(nextAuth, rememberMe);
    setAuthState(nextAuth);
  };

  const signOut = () => {
    setAuth(null);
  };

  return {
    auth,
    token: auth?.token ?? null,
    user: auth?.user ?? null,
    ready,
    setAuth,
    signOut,
  };
}