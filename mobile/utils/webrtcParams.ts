/**
 * Validation + (de)serialization of the Studio -> /live-streaming route params.
 * Shared by the Studio tab and the broadcast screen so both enforce the same rules.
 */

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
