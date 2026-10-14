import { ApiError, NetworkError, UnauthorizedError } from '@/services/http';

export type ErrorKind = 'offline' | 'timeout' | 'unauthorized' | 'forbidden' | 'notFound' | 'rateLimited' | 'server' | 'unknown';

export const ERROR_MESSAGE_KEYS = {
    offline: 'error.offline',
    timeout: 'error.timeout',
    unauthorized: 'error.unauthorized',
    forbidden: 'error.forbidden',
    notFound: 'error.notFound',
    rateLimited: 'error.rateLimited',
    server: 'error.server',
    unknown: 'error.unknown',
} as const satisfies Record<ErrorKind, string>;

/** What went wrong, from the user's point of view (not every failure is "your connection"). */
export function classifyError(error: unknown): ErrorKind {
    if (error instanceof NetworkError) return error.kind;
    if (error instanceof UnauthorizedError) return 'unauthorized';
    if (error instanceof ApiError) {
        if (error.status === 401) return 'unauthorized';
        if (error.status === 403) return 'forbidden';
        if (error.status === 404) return 'notFound';
        if (error.status === 429) return 'rateLimited';
        if (error.status >= 500) return 'server';
    }
    return 'unknown';
}

/** Localised, actionable sentence for an error, to show under an error title. */
export function describeError(error: unknown, t: (key: (typeof ERROR_MESSAGE_KEYS)[ErrorKind]) => string): string {
    return t(ERROR_MESSAGE_KEYS[classifyError(error)]);
}
