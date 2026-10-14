import type { UserSummary } from '@/services/social';
import { getPublicMediaUrl } from '@/utils/media';

/**
 * The backend serializes the follow lists as `followersIds` / `followingIds`
 * (camelCase) while `UserSummary` (and the web client) type them `followersIDS`.
 * We accept both shapes so counts are never silently 0.
 */
export type ProfileUser = UserSummary & {
    followersIds?: string[] | null;
    followingIds?: string[] | null;
    followerCount?: number;
    isVerified?: boolean;
    isFeaturedChef?: boolean;
};

type MaybeIds = readonly string[] | null | undefined;

export function countFromIds(...candidates: MaybeIds[]): number | undefined {
    for (const ids of candidates) {
        if (Array.isArray(ids)) return ids.length;
    }
    return undefined;
}

export function followersCountOf(user: ProfileUser | null | undefined): number {
    if (!user) return 0;
    return countFromIds(user.followersIds, user.followersIDS) ?? (typeof user.followerCount === 'number' ? user.followerCount : 0);
}

export function followingCountOf(user: ProfileUser | null | undefined): number {
    if (!user) return 0;
    return countFromIds(user.followingIds, user.followingIDS) ?? 0;
}

export function fullNameOf(user: Pick<UserSummary, 'firstName' | 'lastName'> | null | undefined): string {
    return [user?.firstName, user?.lastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ');
}

/** Display name: "First Last", else the username, else the e-mail, else `fallback`. */
export function displayNameOf(user: Partial<UserSummary> | null | undefined, fallback = ''): string {
    return fullNameOf(user) || user?.username?.trim() || user?.email?.trim() || fallback;
}

/**
 * Only http(s) image URLs are rendered (no `file:`, `javascript:` or `data:` sources).
 * Server-relative paths (`/api/uploads/...`) are resolved against the API host.
 */
export function safeImageUrl(url: string | null | undefined): string | undefined {
    const resolved = getPublicMediaUrl(url);
    return resolved && !/\s/.test(resolved) ? resolved : undefined;
}

export function formatActivityDate(iso: string | undefined, locale: 'fr' | 'en'): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    try {
        return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    } catch {
        return date.toISOString().slice(0, 10);
    }
}

/** Normalizes an expo-router param (`string | string[] | undefined`) to a clean id, or null when unusable. */
export function parseRouteId(raw: string | string[] | undefined): string | null {
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (!value || value.length > 128) return null;
    return value;
}
