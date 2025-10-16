"use client";

import { useEffect, useState } from "react";

export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string; // URL absolue ou /images/...
};

export function useAuth() {
  const [user, setUserState] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("fs_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "fs_user") {
        try {
          setUserState(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setUserState(null);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setUser = (u: User | null) => {
    if (u) localStorage.setItem("fs_user", JSON.stringify(u));
    else localStorage.removeItem("fs_user");
    setUserState(u);
  };

  return { user, setUser, ready };
}
