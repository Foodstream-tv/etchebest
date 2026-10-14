import { getPublicMediaUrl, isHlsUrl } from '../media';

describe('utils/media', () => {
    it('keeps absolute http(s) urls', () => {
        expect(getPublicMediaUrl('https://cdn.test/a.png')).toBe('https://cdn.test/a.png');
        expect(getPublicMediaUrl(' http://cdn.test/a.png ')).toBe('http://cdn.test/a.png');
    });

    it('resolves root-relative upload paths against the API host (without /api)', () => {
        const url = getPublicMediaUrl('/api/uploads/thumb.jpg');
        expect(url).toMatch(/^https?:\/\/[^/]+(:\d+)?\/api\/uploads\/thumb\.jpg$/);
        expect(url).not.toContain('/api/api/');
    });

    it.each(['javascript:alert(1)', 'file:///etc/passwd', 'data:image/png;base64,AA', '//evil.test/x.png', 'relative/path.png', '', '   ', null, undefined])(
        'rejects %p',
        (value) => {
            expect(getPublicMediaUrl(value as string | null | undefined)).toBe('');
        }
    );

    it('detects HLS playlists ignoring the query string', () => {
        expect(isHlsUrl('https://x/a/master.m3u8')).toBe(true);
        expect(isHlsUrl('https://x/a/master.m3u8?token=1')).toBe(true);
        expect(isHlsUrl('https://x/a/video.mp4?x=.m3u8')).toBe(false);
    });
});
