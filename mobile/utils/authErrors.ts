import { ApiError } from '@/services/http';
import { BANNED_ERROR } from '@/services/session';

/** Backend `code` of the 403 answered by `/login` for an account that did not confirm its e-mail. */
export const ACCOUNT_NOT_VERIFIED = 'ACCOUNT_NOT_VERIFIED';

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** 403 `{ error: "your account is banned", banReason, bannedUntil }` */
export function isBannedError(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 403 && error.body?.error === BANNED_ERROR;
}

/** 403 `{ code: "ACCOUNT_NOT_VERIFIED", userId, email }` */
export function isUnverifiedError(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 403 && error.body?.code === ACCOUNT_NOT_VERIFIED;
}

/** String field of an API error body, `undefined` when absent or not a string. */
export function bodyString(error: unknown, key: string): string | undefined {
  if (!isApiError(error)) return undefined;
  const value = error.body?.[key];
  return typeof value === 'string' && value ? value : undefined;
}
