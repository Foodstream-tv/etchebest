"use client";

import { useCallback, useSyncExternalStore } from "react";

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

// Fired in this tab when the stored profile changes ("storage" only reaches the other tabs).
const AUTH_CHANGE_EVENT = "fs_auth_change";

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let cachedRaw: string | null = null;
let cachedAuth: AuthState | null = null;

// Snapshot for useSyncExternalStore: the same object as long as the stored value does not change.
function getAuthSnapshot(): AuthState | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedAuth = parseStored(raw);
    } catch {
      cachedAuth = null;
    }
  }
  return cachedAuth;
}

function getServerAuthSnapshot(): AuthState | null {
  return null;
}

// Left over from before the cookie: drop the token that was stored in clear.
function dropLegacyToken() {
  try {
    const store = localStorage.getItem(STORAGE_KEY) ? localStorage : sessionStorage;
    const raw = store.getItem(STORAGE_KEY);
    const auth = parseStored(raw);
    if (raw && auth && raw.includes('"token"')) {
      store.setItem(STORAGE_KEY, JSON.stringify(auth));
    }
  } catch {
    // unreadable storage: nothing to clean
  }
}

function subscribeAuth(onChange: () => void) {
  dropLegacyToken();
  window.addEventListener("storage", onChange);
  window.addEventListener(AUTH_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange);
  };
}

function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function saveAuth(auth: AuthState, rememberMe: boolean) {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);

  (rememberMe ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify({ user: auth.user }));
  notifyAuthChange();
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  notifyAuthChange();
  // The httpOnly cookie can only be removed by the server.
  if (typeof window !== "undefined") {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  }
}

const subscribeNothing = () => () => {};

export function useAuth() {
  const auth = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerAuthSnapshot);
  // False during the server render and hydration (storage not read yet), true afterwards.
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const setAuth = useCallback((nextAuth: AuthState | null, rememberMe = true) => {
    if (!nextAuth) {
      clearAuth();
      return;
    }

    saveAuth(nextAuth, rememberMe);
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
