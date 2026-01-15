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

export function useAuth() {
  const [auth, setAuthState] = useState<AuthState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthState) : null;
    } catch {
      return null;
    }
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          setAuthState(e.newValue ? (JSON.parse(e.newValue) as AuthState) : null);
        } catch {
          setAuthState(null);
        }
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setAuth = (a: AuthState | null) => {
    if (a) localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    else localStorage.removeItem(STORAGE_KEY);
    setAuthState(a);
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
