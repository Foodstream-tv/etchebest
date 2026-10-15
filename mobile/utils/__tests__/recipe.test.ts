import { formatTimer, parseRecipe } from '../recipe';

describe('parseRecipe', () => {
    it('reads the recipe the Studio embeds in a live description', () => {
        const recipe = parseRecipe({
            ingredients: [{ name: ' Farine ', qty: '200 g' }, { name: 'Sel', qty: '' }],
            prepSteps: ['Tamiser : passer la farine au tamis', 'Pétrir'],
            cookingTimer: 600,
            platingSteps: ['Dresser en nid'],
            utensils: ['Fouet'],
            prepTimeMins: 15,
            restTimeMins: 30,
            sourceUrl: 'https://www.marmiton.org/recettes/x.aspx',
            sourceName: 'Marmiton',
        });

        expect(recipe).toEqual({
            ingredients: [{ name: 'Farine', qty: '200 g' }, { name: 'Sel', qty: '' }],
            techniques: [{ name: 'Tamiser', desc: 'passer la farine au tamis' }, { name: '', desc: 'Pétrir' }],
            timerSeconds: 600,
            plating: ['Dresser en nid'],
            utensils: ['Fouet'],
            prepTimeMins: 15,
            restTimeMins: 30,
            sourceUrl: 'https://www.marmiton.org/recettes/x.aspx',
            sourceName: 'Marmiton',
        });
    });

    it('splits a step at the first colon only', () => {
        expect(parseRecipe({ prepSteps: ['Sauce : mélanger : doucement'] })?.techniques).toEqual([{ name: 'Sauce', desc: 'mélanger : doucement' }]);
    });

    it('returns null when there is nothing to follow', () => {
        expect(parseRecipe(null)).toBeNull();
        expect(parseRecipe('text')).toBeNull();
        expect(parseRecipe([])).toBeNull();
        expect(parseRecipe({})).toBeNull();
        expect(parseRecipe({ ingredients: [], cookingTimer: 0, prepTimeMins: 20 })).toBeNull();
    });

    it('is usable with a timer alone, or with utensils alone', () => {
        expect(parseRecipe({ cookingTimer: 90 })?.timerSeconds).toBe(90);
        expect(parseRecipe({ utensils: ['Fouet'] })?.utensils).toEqual(['Fouet']);
    });

    it('never trusts the data: wrong types, blanks, huge values and unsafe links are dropped', () => {
        const recipe = parseRecipe({
            ingredients: [{ name: 42, qty: 'x' }, { name: '   ', qty: '1' }, 'oops', null, { name: 'Beurre', qty: { a: 1 } }],
            prepSteps: [1, '', '  ', 'ok'],
            cookingTimer: Number.POSITIVE_INFINITY,
            platingSteps: 'not an array',
            prepTimeMins: -5,
            restTimeMins: 'abc',
            sourceUrl: 'javascript:alert(1)',
            sourceName: 'x'.repeat(500),
        });

        expect(recipe).toMatchObject({
            ingredients: [{ name: 'Beurre', qty: '' }],
            techniques: [{ name: '', desc: 'ok' }],
            timerSeconds: 0,
            plating: [],
            prepTimeMins: 0,
            restTimeMins: 0,
            sourceUrl: undefined,
        });
        expect(recipe?.sourceName).toHaveLength(80);
    });

    it('bounds the number of items and the text length', () => {
        const recipe = parseRecipe({
            ingredients: Array.from({ length: 200 }, (_, i) => ({ name: `i${i}`, qty: '1' })),
            platingSteps: ['y'.repeat(1000)],
            cookingTimer: 10 ** 9,
        });
        expect(recipe?.ingredients).toHaveLength(60);
        expect(recipe?.plating[0]).toHaveLength(400);
        expect(recipe?.timerSeconds).toBe(24 * 3600);
    });
});

describe('formatTimer', () => {
    it.each([
        [0, '0:00'],
        [5, '0:05'],
        [65, '1:05'],
        [600, '10:00'],
        [3725, '62:05'],
        [-3, '0:00'],
        [59.9, '0:59'],
    ])('%d s -> %s', (seconds, expected) => {
        expect(formatTimer(seconds)).toBe(expected);
    });
});
