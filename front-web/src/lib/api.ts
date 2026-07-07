import { BANNED_ERROR, dispatchSessionTerminated } from "@/lib/session";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

// Error thrown by apiFetch on a non-OK response. Carries the HTTP status and
// the parsed JSON body so callers can react to structured errors (e.g. a ban)
// instead of only a message string.
export class ApiError extends Error {
  status: number;
  body: any;

  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

type ApiFetchOptions = RequestInit & {
  token?: string | null;
  silent?: boolean;
};

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const url = joinUrl(API_BASE_URL, path);

  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const hasBody = options.body !== undefined && options.body !== null;
  const bodyIsFormData = isFormDataBody(options.body);

  if (hasBody && !bodyIsFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    if (!options.silent) {
      console.error("API ERROR", { url, status: res.status, raw: text, json });
    }

    // Only authenticated requests can invalidate a session. This keeps
    // unauthenticated failures (e.g. wrong credentials on login) from
    // triggering a global logout.
    if (headers.has("Authorization")) {
      if (res.status === 403 && json?.error === BANNED_ERROR) {
        dispatchSessionTerminated({
          reason: "banned",
          banReason: json?.banReason || undefined,
          bannedUntil: json?.bannedUntil ?? null,
        });
      } else if (res.status === 401) {
        // Token no longer valid: user deleted, token expired, etc.
        dispatchSessionTerminated({ reason: "revoked" });
      }
    }

    throw new ApiError(
      json?.message || json?.error || text || `Erreur ${res.status}`,
      res.status,
      json
    );
  }

  if (
    json &&
    typeof json === "object" &&
    "data" in json &&
    json.data !== undefined
  ) {
    return json.data as T;
  }

  return json as T;
}