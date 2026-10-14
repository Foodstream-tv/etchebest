import envConfig from '@/config/env';

const ABSOLUTE_HTTP = /^https?:\/\//i;

/**
 * Same rule as the web replay page (`getPublicMediaUrl`): absolute URLs are kept,
 * relative ones are served by the API host (without its `/api` suffix).
 * Anything that is not http(s) (javascript:, file:, protocol-relative…) is rejected
 * and yields an empty string so it can never reach the player.
 */
export function getPublicMediaUrl(path: string | null | undefined): string {
    const value = (path ?? '').trim();
    if (!value) return '';
    if (ABSOLUTE_HTTP.test(value)) return value;
    if (!value.startsWith('/') || value.startsWith('//')) return '';

    const base = envConfig.apiBaseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
    return `${base}${value}`;
}

/** True when the url points to an HLS playlist (query string / fragment ignored). */
export function isHlsUrl(uri: string): boolean {
    return /\.m3u8$/i.test(uri.split(/[?#]/)[0]);
}
