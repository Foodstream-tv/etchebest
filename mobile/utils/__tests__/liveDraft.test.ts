import { clearLiveDrafts, getLiveDraft, setLiveDraft } from '../liveDraft';

describe('liveDraft', () => {
    beforeEach(() => clearLiveDrafts());

    it('returns what was stored, by id', () => {
        const id = setLiveDraft({ description: 'a', thumbnailUrl: '/api/uploads/x.jpg' });
        expect(getLiveDraft(id)).toEqual({ description: 'a', thumbnailUrl: '/api/uploads/x.jpg' });
    });

    it('gives each draft its own id and keeps them apart', () => {
        const a = setLiveDraft({ description: 'a' });
        const b = setLiveDraft({ description: 'b' });
        expect(a).not.toBe(b);
        expect(getLiveDraft(a)?.description).toBe('a');
        expect(getLiveDraft(b)?.description).toBe('b');
    });

    it('is null for an unknown, empty or missing id', () => {
        expect(getLiveDraft('nope')).toBeNull();
        expect(getLiveDraft('')).toBeNull();
        expect(getLiveDraft(undefined)).toBeNull();
    });

    it('forgets the oldest drafts past the limit', () => {
        const first = setLiveDraft({ description: '0' });
        const last = Array.from({ length: 6 }, (_, i) => setLiveDraft({ description: String(i + 1) })).pop() as string;
        expect(getLiveDraft(first)).toBeNull();
        expect(getLiveDraft(last)?.description).toBe('6');
    });
});
