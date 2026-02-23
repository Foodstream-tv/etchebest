export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8081";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = joinUrl(API_BASE_URL, path);

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    console.error("API ERROR", { url, status: res.status, raw: text, json });

    throw new Error(json?.message || json?.error || text || `Erreur ${res.status}`);
  }

  if (json && typeof json === "object" && "data" in json && json.data !== undefined) {
    return json.data as T;
  }

  return json as T;
}
