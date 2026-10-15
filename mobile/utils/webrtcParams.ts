/**
 * Validation + (de)serialization of the Studio -> /live-streaming route params.
 * Shared by the Studio tab and the broadcast screen so both enforce the same rules.
 */

import { RECIPE_MARKER } from '@/services/lives';

export const LIVE_TITLE_MIN = 3;
export const LIVE_TITLE_MAX = 80;
export const LIVE_DESCRIPTION_MAX = 500;
export const LIVE_TAGS_MAX = 5;
const TAG_MAX_LENGTH = 40;

/** expo-router params can be string | string[] | undefined. */
export function firstParam(value: string | string[] | undefined | null): string | undefined {
    if (Array.isArray(value)) return value[0];
    return typeof value === 'string' ? value : undefined;
}

/** Strips control characters, collapses whitespace and trims. */
export function sanitizeTitle(raw: string | undefined | null): string {
    // eslint-disable-next-line no-control-regex
    return (raw ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export type TitleError = 'required' | 'tooShort' | 'tooLong' | null;

export function validateTitle(raw: string | undefined | null): TitleError {
    const title = sanitizeTitle(raw);
    if (title.length === 0) return 'required';
    if (title.length < LIVE_TITLE_MIN) return 'tooShort';
    if (title.length > LIVE_TITLE_MAX) return 'tooLong';
    return null;
}

/** Trimmed title when valid, otherwise null (a route param may have been tampered with). */
export function validTitleOrNull(raw: string | undefined | null): string | null {
    return validateTitle(raw) === null ? sanitizeTitle(raw) : null;
}

export function sanitizeDescription(raw: string | undefined | null): string {
    return (raw ?? '').trim().slice(0, LIVE_DESCRIPTION_MAX);
}

/** Largest recipe JSON accepted in the description (the backend column is text, a route param is not unbounded). */
const RECIPE_JSON_MAX = 20_000;
const THUMBNAIL_URL_MAX = 500;
export const LIVE_DURATION_MIN = 10;
export const LIVE_DURATION_MAX = 180;
const LEVELS = ['Débutant', 'Intermédiaire', 'Avancé'] as const;

/**
 * Description route param: the free text is bounded to LIVE_DESCRIPTION_MAX, and the recipe the Studio
 * appends after the marker is kept only when it is a JSON object of reasonable size.
 */
export function sanitizeLiveDescription(raw: string | undefined | null): string {
    const value = raw ?? '';
    const at = value.indexOf(RECIPE_MARKER);
    if (at < 0) return sanitizeDescription(value);

    const text = sanitizeDescription(value.slice(0, at));
    const json = value.slice(at + RECIPE_MARKER.length).trim();
    try {
        const parsed: unknown = JSON.parse(json);
        if (json.length > RECIPE_JSON_MAX || parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return text;
    } catch {
        return text;
    }
    return `${text}\n\n${RECIPE_MARKER}\n${json}`;
}

export function parseLevel(raw: string | undefined | null): string | undefined {
    return LEVELS.find((level) => level === raw);
}

/** Planned duration route param (minutes), or undefined when missing / out of range. */
export function parseDuration(raw: string | undefined | null): number | undefined {
    const minutes = Number.parseInt(raw ?? '', 10);
    return Number.isFinite(minutes) && minutes >= LIVE_DURATION_MIN && minutes <= LIVE_DURATION_MAX ? minutes : undefined;
}

/** Thumbnail route param: an http(s) url or an uploads path of our API; anything else is dropped. */
export function parseThumbnailUrl(raw: string | undefined | null): string | undefined {
    const value = (raw ?? '').trim();
    if (!value || value.length > THUMBNAIL_URL_MAX) return undefined;
    if (/^https?:\/\//i.test(value)) return value;
    return value.startsWith('/api/uploads/') ? value : undefined;
}

export function serializeTags(tags: readonly string[]): string {
    return tags.join(',');
}

/** Parses the `tags` route param: trimmed, unique, bounded. */
export function parseTags(raw: string | undefined | null): string[] {
    if (!raw) return [];
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const part of raw.split(',')) {
        const tag = sanitizeTitle(part).slice(0, TAG_MAX_LENGTH);
        if (!tag || seen.has(tag.toLowerCase())) continue;
        seen.add(tag.toLowerCase());
        tags.push(tag);
        if (tags.length >= LIVE_TAGS_MAX) break;
    }
    return tags;
}
