import {
    LIVE_TAGS_MAX,
    LIVE_TITLE_MAX,
    firstParam,
    parseTags,
    sanitizeDescription,
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
});
