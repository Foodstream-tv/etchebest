import envConfig from '../config/env';
import authService from './auth';
import { BANNED_ERROR, emitSessionTerminated } from './session';

/**
 * Error thrown on every non-2xx response. Carries the HTTP status and the
 * parsed JSON body so callers can react to structured errors (banned account,
 * unverified account…) instead of parsing a message string.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: any;

  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** The request never got an answer: no connectivity, DNS/connection failure or timeout. */
export class NetworkError extends Error {
  readonly kind: 'offline' | 'timeout';

  constructor(message: string, kind: 'offline' | 'timeout') {
    super(message);
    this.name = 'NetworkError';
    this.kind = kind;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Session expirée. Reconnectez-vous pour continuer.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export type AuthMode = 'required' | 'optional' | 'none';

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON body (serialized by the client), or FormData sent as multipart */
  body?: unknown;
  /**
   * required: throws UnauthorizedError when there is no stored token (default)
   * optional: sends the token when there is one
   * none: never sends the token
   */
  auth?: AuthMode;
  /** Explicit bearer token (e.g. right after login, before it is persisted). Overrides the stored one. */
  token?: string;
  /** Query-string parameters; undefined/null/'' are dropped, arrays are repeated */
  query?: Record<string, string | number | boolean | undefined | null | readonly (string | number)[]>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

/** Safely encodes one path segment (room ids, user ids…) so it can't alter the route. */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}

export function buildQuery(query: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== '' && item !== undefined && item !== null) params.append(key, String(item));
      }
    } else {
      params.append(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function describeNetworkError(error: unknown): Error {
  if (error instanceof Error && error.name === 'AbortError') {
    return new NetworkError('La requête a expiré. Vérifiez votre connexion.', 'timeout');
  }
  if (error instanceof TypeError) {
    return new NetworkError('Erreur réseau. Vérifiez votre connexion ou réessayez plus tard.', 'offline');
  }
  return new NetworkError('Erreur réseau inattendue.', 'offline');
}

function parseJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The backend sometimes wraps payloads in `{ data }`; the web client unwraps it, so do we. */
function unwrap<T>(json: any): T {
  if (json && typeof json === 'object' && !Array.isArray(json) && 'data' in json && json.data !== undefined) {
    return json.data as T;
  }
  return json as T;
}

/** `PATCH /users/me/password` answers 401 "invalid current password" for a typo: the session is still valid. */
function isWrongCurrentPassword(status: number, body: any): boolean {
  return status === 401 && body?.error === 'invalid current password';
}

function isBanned(status: number, body: any): boolean {
  return status === 403 && body?.error === BANNED_ERROR;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = 'required', query, timeoutMs = envConfig.apiTimeout, signal } = options;

  if (!envConfig.apiBaseUrl) {
    throw new Error("L'URL de l'API n'est pas configurée (EXPO_PUBLIC_API_BASE_URL).");
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  let token: string | null = options.token ?? null;

  if (!token && auth !== 'none') {
    token = await authService.getToken();
    if (!token && auth === 'required') {
      throw new UnauthorizedError('Vous devez vous connecter pour continuer.');
    }
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  let serializedBody: string | FormData | undefined;
  if (body !== undefined && body !== null) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      // Multipart: fetch must set the Content-Type itself (it carries the boundary).
      serializedBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      serializedBody = JSON.stringify(body);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  let response: Response;
  try {
    response = await fetch(joinUrl(envConfig.apiBaseUrl, path) + buildQuery(query), {
      method,
      headers,
      body: serializedBody,
      signal: controller.signal,
    });
  } catch (error) {
    throw describeNetworkError(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  const text = await response.text().catch(() => '');
  const json = parseJson(text);

  if (!response.ok) {
    // Only authenticated requests can invalidate a session: a wrong password
    // on /login must not trigger a global sign-out.
    if (token) {
      if (isBanned(response.status, json)) {
        await authService.logout();
        emitSessionTerminated({
          reason: 'banned',
          banReason: json?.banReason || undefined,
          bannedUntil: json?.bannedUntil ?? null,
        });
      } else if (response.status === 401 && !isWrongCurrentPassword(response.status, json)) {
        await authService.logout();
        emitSessionTerminated({ reason: 'revoked' });
      }
    }

    const message =
      (typeof json?.message === 'string' && json.message) ||
      (typeof json?.error === 'string' && json.error) ||
      `Erreur ${response.status}`;
    throw new ApiError(message, response.status, json);
  }

  return unwrap<T>(json);
}
