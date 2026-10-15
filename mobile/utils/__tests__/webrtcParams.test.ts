import {
    LIVE_TAGS_MAX,
    LIVE_TITLE_MAX,
    firstParam,
    parseDuration,
    parseLevel,
    parseTags,
    parseThumbnailUrl,
    sanitizeDescription,
    sanitizeLiveDescription,
    sanitizeTitle,
    validTitleOrNull,
    validateTitle,
} from '../webrtcParams';
import { preferH264 } from '../webrtcSdp';

describe('webrtcParams', () => {
    it('sanitizes titles (whitespace, control characters)', () => {
        expect(sanitizeTitle('  Pasta \n\t maison\u0000 ')).toBe('Pasta maison');
        expect(sanitizeTitle(undefined)).toBe('');
    });

    it('validates the 3-80 range on the trimmed title', () => {
        expect(validateTitle('')).toBe('required');
        expect(validateTitle('   ')).toBe('required');
        expect(validateTitle(' ab ')).toBe('tooShort');
        expect(validateTitle('abc')).toBeNull();
        expect(validateTitle('a'.repeat(LIVE_TITLE_MAX))).toBeNull();
        expect(validateTitle('a'.repeat(LIVE_TITLE_MAX + 1))).toBe('tooLong');
        expect(validTitleOrNull(' Mon live ')).toBe('Mon live');
        expect(validTitleOrNull('x')).toBeNull();
    });

    it('takes the first value of array params', () => {
        expect(firstParam(['a', 'b'])).toBe('a');
        expect(firstParam('a')).toBe('a');
        expect(firstParam(undefined)).toBeUndefined();
    });

    it('parses tags: trimmed, unique (case-insensitive), bounded', () => {
        expect(parseTags(' Italien, Vegan ,italien,,BBQ')).toEqual(['Italien', 'Vegan', 'BBQ']);
        expect(parseTags('a,b,c,d,e,f,g')).toHaveLength(LIVE_TAGS_MAX);
        expect(parseTags(undefined)).toEqual([]);
    });

    it('bounds the description', () => {
        expect(sanitizeDescription('  hi  ')).toBe('hi');
        expect(sanitizeDescription('x'.repeat(900))).toHaveLength(500);
    });
});

describe('preferH264', () => {
    const sdp = [
        'v=0',
        'm=video 9 UDP/TLS/RTP/SAVPF 96 97 102',
        'a=rtpmap:96 VP8/90000',
        'a=rtpmap:97 VP9/90000',
        'a=rtpmap:102 H264/90000',
        'a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f',
    ].join('\n');

    it('keeps only the H264 payload type on the video line', () => {
        const out = preferH264(sdp);
        expect(out).toContain('m=video 9 UDP/TLS/RTP/SAVPF 102');
        expect(out).not.toContain('VP8');
        expect(out).not.toContain('VP9');
        expect(out).toContain('a=rtpmap:102 H264/90000');
    });

    it('returns the SDP untouched without H264 and tolerates empty input', () => {
        const noH264 = 'v=0\nm=video 9 RTP/AVP 96\na=rtpmap:96 VP8/90000';
        expect(preferH264(noH264)).toBe(noH264);
        expect(preferH264('')).toBe('');
    });

    describe('Studio route params', () => {
        const MARKER = '---FOODSTREAM_RECIPE---';

        it('keeps a recipe after the marker but bounds the free text', () => {
            const recipe = JSON.stringify({ ingredients: [{ name: 'farine', qty: '200 g' }] });
            const out = sanitizeLiveDescription(`${'a'.repeat(700)}\n\n${MARKER}\n${recipe}`);
            const [text, json] = out.split(`\n\n${MARKER}\n`);
            expect(text).toHaveLength(500);
            expect(json).toBe(recipe);
        });

        it('drops a recipe that is not a JSON object or is too large', () => {
            expect(sanitizeLiveDescription(`Hello\n\n${MARKER}\nnot json`)).toBe('Hello');
            expect(sanitizeLiveDescription(`Hello\n\n${MARKER}\n[1,2]`)).toBe('Hello');
            expect(sanitizeLiveDescription(`Hello\n\n${MARKER}\nnull`)).toBe('Hello');
            const huge = JSON.stringify({ x: 'y'.repeat(25_000) });
            expect(sanitizeLiveDescription(`Hello\n\n${MARKER}\n${huge}`)).toBe('Hello');
        });

        it('is the plain bounded description without a recipe, and idempotent', () => {
            expect(sanitizeLiveDescription('  Pasta  ')).toBe('Pasta');
            const once = sanitizeLiveDescription(`Hi\n\n${MARKER}\n{"a":1}`);
            expect(sanitizeLiveDescription(once)).toBe(once);
        });

        it('accepts only the known levels', () => {
            expect(parseLevel('Avancé')).toBe('Avancé');
            expect(parseLevel('Expert')).toBeUndefined();
            expect(parseLevel(undefined)).toBeUndefined();
        });

        it('keeps a planned duration in 10-180 minutes only', () => {
            expect(parseDuration('45')).toBe(45);
            expect(parseDuration('9')).toBeUndefined();
            expect(parseDuration('181')).toBeUndefined();
            expect(parseDuration('abc')).toBeUndefined();
            expect(parseDuration(undefined)).toBeUndefined();
        });

        it('keeps http(s) urls and our uploads path, drops everything else', () => {
            expect(parseThumbnailUrl(' https://img.example/a.jpg ')).toBe('https://img.example/a.jpg');
            expect(parseThumbnailUrl('/api/uploads/a.jpg')).toBe('/api/uploads/a.jpg');
            expect(parseThumbnailUrl('javascript:alert(1)')).toBeUndefined();
            expect(parseThumbnailUrl('//evil.test/a.jpg')).toBeUndefined();
            expect(parseThumbnailUrl('/etc/passwd')).toBeUndefined();
            expect(parseThumbnailUrl(`https://x.test/${'a'.repeat(600)}`)).toBeUndefined();
            expect(parseThumbnailUrl('')).toBeUndefined();
        });
    });
});
