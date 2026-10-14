import { getLiveByRoomId, getLives, liveHostImage, normalizeTags, parseLiveDescription, RECIPE_MARKER } from '../lives';
import { request } from '../http';

jest.mock('../http', () => ({
    ...jest.requireActual('../http'),
    request: jest.fn(),
}));

const mockedRequest = request as jest.Mock;

describe('services/lives', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('normalizeTags', () => {
        it('drops the "all" tags (fr/en), blanks and trims', () => {
            expect(normalizeTags('Tout')).toEqual([]);
            expect(normalizeTags('All')).toEqual([]);
            expect(normalizeTags(undefined)).toEqual([]);
            expect(normalizeTags(['Tout', ' BBQ ', '', 'Healthy'])).toEqual(['BBQ', 'Healthy']);
            expect(normalizeTags('Pâtisserie')).toEqual(['Pâtisserie']);
        });
    });

    describe('getLives', () => {
        it('queries the public endpoint with optional auth and web-compatible params', async () => {
            mockedRequest.mockResolvedValue({ lives: [{ id: 1 }], total: 1, page: 2, limit: 12 });

            const page = await getLives({ q: '  ramen ', tag: ['Asiatique', 'Tout'], status: 'live', page: 2, limit: 12 });

            expect(mockedRequest).toHaveBeenCalledWith('/lives', {
                auth: 'optional',
                query: { q: 'ramen', tag: ['Asiatique'], status: 'live', page: 2, limit: 12 },
            });
            expect(page).toEqual({ lives: [{ id: 1 }], total: 1, page: 2, limit: 12 });
        });

        it('omits status when it is "all" (backend default = scheduled + live)', async () => {
            mockedRequest.mockResolvedValue({ lives: [], total: 0 });
            await getLives({ status: 'all' });
            expect(mockedRequest.mock.calls[0][1].query.status).toBeUndefined();
        });

        it('is resilient to null / malformed payloads', async () => {
            mockedRequest.mockResolvedValueOnce(null);
            await expect(getLives({ page: 3, limit: 5 })).resolves.toEqual({ lives: [], total: 0, page: 3, limit: 5 });

            mockedRequest.mockResolvedValueOnce({ lives: 'nope' });
            await expect(getLives()).resolves.toMatchObject({ lives: [], total: 0 });
        });
    });

    it('encodes the room id when loading a live', async () => {
        mockedRequest.mockResolvedValue({});
        await getLiveByRoomId('a/b');
        expect(mockedRequest).toHaveBeenCalledWith('/lives/a%2Fb', { auth: 'optional' });
    });

    describe('parseLiveDescription', () => {
        it('returns the raw description when there is no recipe', () => {
            expect(parseLiveDescription('Hello')).toEqual({ description: 'Hello', recipe: null });
            expect(parseLiveDescription(undefined)).toEqual({ description: '', recipe: null });
        });

        it('splits description and recipe JSON', () => {
            const raw = `Intro\n${RECIPE_MARKER}\n{"ingredients":["a"]}`;
            expect(parseLiveDescription(raw)).toEqual({ description: 'Intro', recipe: { ingredients: ['a'] } });
        });

        it('keeps the description when the recipe JSON is corrupted', () => {
            expect(parseLiveDescription(`Intro${RECIPE_MARKER}{oops`)).toEqual({ description: 'Intro', recipe: null });
        });
    });

    it('reads the host image from either casing', () => {
        expect(liveHostImage({ user: { id: '1', profileImageUrl: 'a' } })).toBe('a');
        expect(liveHostImage({ user: { id: '1', profile_image_url: 'b' } })).toBe('b');
        expect(liveHostImage({})).toBeUndefined();
    });
});
