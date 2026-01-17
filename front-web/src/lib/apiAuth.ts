"use client";

import { apiFetch } from "@/lib/api";

export async function apiFetchAuth<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
