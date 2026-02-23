"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export function useAuthSubmit<TResponse = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(path: string, payload: any): Promise<TResponse> {
    setLoading(true);
    setError(null);
    try {
      const res: any = await apiFetch<any>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return (res?.data ?? res) as TResponse;
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return { submit, loading, error, setError };
}
