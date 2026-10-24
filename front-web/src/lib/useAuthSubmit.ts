"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export function useAuthSubmit<TResponse = unknown>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(path: string, payload: unknown): Promise<TResponse> {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<TResponse | { data: TResponse }>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return (res && typeof res === "object" && "data" in res ? res.data : res) as TResponse;
    } catch (err) {
      setError((err instanceof Error && err.message) || "Une erreur est survenue");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return { submit, loading, error, setError };
}
