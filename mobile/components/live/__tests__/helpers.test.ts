import { formatIsoForGCal, getGoogleCalendarUrl, getLiveWebUrl } from '@/lib/calendar';

import { formatScheduledDate, pluralSuffix } from '../format';
import { getPublicMediaUrl, isHlsUrl } from '../media';
import { maxRetriesFor, MAX_LIVE_RETRIES, MAX_REPLAY_RETRIES, retryDelay } from '../playerRetry';
import { parseRoomId } from '../useLiveRoom';

jest.mock('@/services/auth', () => ({ __esModule: true, default: { getToken: jest.fn(), getUser: jest.fn() } }));
jest.mock('@/services/lives', () => ({ getLiveByRoomId: jest.fn() }));
jest.mock('@/services/streaming', () => ({ getRoom: jest.fn() }));

describe('calendar helpers', () => {
    it('formats dates for Google Calendar', () => {
        expect(formatIsoForGCal(new Date('2030-05-01T18:00:00.123Z'))).toBe('20300501T180000Z');
    });

    it('builds the Google Calendar template url', () => {
        const url = new URL(
            getGoogleCalendarUrl({
                title: 'FoodStream : Tarte',
                description: 'Une tarte',
                scheduledAt: '2030-05-01T18:00:00Z',
                durationMinutes: 90,
                liveUrl: 'https://foodstream.tv/watch/r1',
                joinText: 'Rejoindre : https://foodstream.tv/watch/r1',
            })!
        );
        expect(url.searchParams.get('action')).toBe('TEMPLATE');
        expect(url.searchParams.get('text')).toBe('FoodStream : Tarte');
        expect(url.searchParams.get('dates')).toBe('20300501T180000Z/20300501T193000Z');
        expect(url.searchParams.get('details')).toBe('Une tarte\n\nRejoindre : https://foodstream.tv/watch/r1');
        expect(url.searchParams.get('location')).toBe('https://foodstream.tv/watch/r1');
    });

    it('falls back to the live url as details and returns null for invalid dates', () => {
        const url = new URL(getGoogleCalendarUrl({ title: 't', scheduledAt: '2030-05-01T18:00:00Z', liveUrl: 'https://x.test/l' })!);
        expect(url.searchParams.get('details')).toBe('https://x.test/l');
        expect(getGoogleCalendarUrl({ title: 't', scheduledAt: 'nope', liveUrl: 'u' })).toBeNull();
        expect(getGoogleCalendarUrl({ title: 't', scheduledAt: '', liveUrl: 'u' })).toBeNull();
    });

    it('encodes the room id in the public live url', () => {
        expect(getLiveWebUrl('a b/c')).toBe('https://foodstream.tv/watch/a%20b%2Fc');
    });
});

describe('media helpers', () => {
    it('keeps absolute http(s) urls', () => {
        expect(getPublicMediaUrl('https://cdn.test/a.m3u8')).toBe('https://cdn.test/a.m3u8');
        expect(getPublicMediaUrl('HTTP://cdn.test/a.mp4')).toBe('HTTP://cdn.test/a.mp4');
    });

    it('resolves relative paths against the API host without /api', () => {
        expect(getPublicMediaUrl('/replays/a.mp4')).toBe('http://localhost:8081/replays/a.mp4');
    });

    it.each([['javascript:alert(1)'], ['file:///etc/passwd'], ['//evil.test/a.mp4'], ['replays/a.mp4'], ['  '], [null], [undefined]])(
        'rejects %s',
        (value) => {
            expect(getPublicMediaUrl(value as string | null | undefined)).toBe('');
        }
    );

    it('detects HLS playlists ignoring query strings', () => {
        expect(isHlsUrl('https://x.test/a/master.m3u8')).toBe(true);
        expect(isHlsUrl('https://x.test/a/master.M3U8?token=1')).toBe(true);
        expect(isHlsUrl('https://x.test/a/video.mp4?x=.m3u8')).toBe(false);
    });
});

describe('player retry policy', () => {
    it('has a bounded back-off', () => {
        expect(retryDelay(0)).toBe(500);
        expect(retryDelay(1)).toBe(500);
        expect(retryDelay(4)).toBe(2000);
        expect(retryDelay(50)).toBe(5000);
    });

    it('retries replays less than lives', () => {
        expect(maxRetriesFor('live')).toBe(MAX_LIVE_RETRIES);
        expect(maxRetriesFor('replay')).toBe(MAX_REPLAY_RETRIES);
        expect(MAX_REPLAY_RETRIES).toBeLessThan(MAX_LIVE_RETRIES);
    });
});

describe('parseRoomId / format', () => {
    it('accepts a non-empty string, trimmed, or the first array item', () => {
        expect(parseRoomId(' abc ')).toBe('abc');
        expect(parseRoomId(['x', 'y'])).toBe('x');
    });

    it('rejects missing, blank and oversized ids', () => {
        expect(parseRoomId(undefined)).toBeNull();
        expect(parseRoomId('')).toBeNull();
        expect(parseRoomId('   ')).toBeNull();
        expect(parseRoomId([])).toBeNull();
        expect(parseRoomId('a'.repeat(201))).toBeNull();
    });

    it('formats scheduled dates with a fallback', () => {
        expect(formatScheduledDate(null, 'fr', 'Date à venir')).toBe('Date à venir');
        expect(formatScheduledDate('garbage', 'en', 'TBD')).toBe('TBD');
        expect(formatScheduledDate('2030-05-01T18:00:00Z', 'en', 'TBD')).toMatch(/2030/);
    });

    it('pluralises like the web', () => {
        expect(pluralSuffix(0)).toBe('');
        expect(pluralSuffix(1)).toBe('');
        expect(pluralSuffix(2)).toBe('s');
    });
});
