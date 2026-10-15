import {
    appendHint,
    buildDescription,
    canAppendHint,
    DESCRIPTION_MAX,
    EMPTY_RECIPE,
    hasRecipeContent,
    parseIngredient,
    parseMinutes,
    recipeFromMarmiton,
    sourceNameFor,
} from '../studioRecipe';
import { parseLiveDescription } from '@/services/lives';

describe('parseMinutes', () => {
    it.each([
        ['', 0],
        ['abc', 0],
        ['12', 12],
        ['1a2', 12],
        ['-5', 5],
        ['5000', 999],
    ])('%j -> %d', (raw, expected) => {
        expect(parseMinutes(raw)).toBe(expected);
    });

    it('can be capped (cooking timer: 180 min)', () => {
        expect(parseMinutes('240', 180)).toBe(180);
    });
});

describe('parseIngredient', () => {
    it('splits quantity and name like the web import', () => {
        expect(parseIngredient('200 g de farine')).toEqual({ qty: '200 g', name: 'farine' });
        expect(parseIngredient('2 gousses d\'ail')).toEqual({ qty: '2 gousses', name: 'ail' });
        expect(parseIngredient('1/2 l de lait')).toEqual({ qty: '1/2 l', name: 'lait' });
        expect(parseIngredient('1 kg de pommes')).toEqual({ qty: '1 kg', name: 'pommes' });
        expect(parseIngredient('2 cuillères à soupe de miel')).toEqual({ qty: '2 cuillères à soupe', name: 'miel' });
        expect(parseIngredient('1 cuillère à café de sel')).toEqual({ qty: '1 cuillère à café', name: 'sel' });
        expect(parseIngredient('2 c.à.s. d\'huile d\'olive')).toEqual({ qty: '2 c.à.s.', name: 'huile d\'olive' });
        expect(parseIngredient('1 c. à café de poivre')).toEqual({ qty: '1 c. à café', name: 'poivre' });
        expect(parseIngredient('2 càs de sucre')).toEqual({ qty: '2 càs', name: 'sucre' });
        expect(parseIngredient('1 poignée de basilic')).toEqual({ qty: '1 poignée', name: 'basilic' });
        expect(parseIngredient('50 cl de crème')).toEqual({ qty: '50 cl', name: 'crème' });
        expect(parseIngredient('1/2 litre de lait')).toEqual({ qty: '1/2 litre', name: 'lait' });
        expect(parseIngredient('3 desserts')).toEqual({ qty: '3', name: 'desserts' });
        expect(parseIngredient('2 oeufs')).toEqual({ qty: '2', name: 'oeufs' });
        expect(parseIngredient('2 gros oeufs')).toEqual({ qty: '2', name: 'gros oeufs' });
    });

    it('falls back to "Au goût" when there is no quantity', () => {
        expect(parseIngredient('  sel  ')).toEqual({ qty: 'Au goût', name: 'sel' });
    });
});

describe('sourceNameFor', () => {
    it('recognises Marmiton and its subdomains only', () => {
        expect(sourceNameFor('https://www.marmiton.org/recettes/x.aspx')).toBe('Marmiton');
        expect(sourceNameFor('https://marmiton.org/x')).toBe('Marmiton');
        expect(sourceNameFor('https://evilmarmiton.org/x')).toBe('');
        expect(sourceNameFor('not a url')).toBe('');
    });
});

describe('buildDescription', () => {
    it('is the plain trimmed text when the recipe is empty', () => {
        expect(hasRecipeContent(EMPTY_RECIPE)).toBe(false);
        expect(buildDescription('  Pasta  ', EMPTY_RECIPE)).toBe('Pasta');
    });

    it('embeds the recipe after the marker, readable by the watch screens (cook timer in seconds)', () => {
        const recipe = {
            ...EMPTY_RECIPE,
            ingredients: [{ name: 'farine', qty: '200 g' }],
            prepSteps: ['Mélanger'],
            cookTimeMins: 15,
            sourceUrl: 'https://www.marmiton.org/x',
            sourceName: 'Marmiton',
        };
        const text = buildDescription('Pasta', recipe);
        const parsed = parseLiveDescription(text);

        expect(parsed.description).toBe('Pasta');
        expect(parsed.recipe).toMatchObject({
            ingredients: [{ name: 'farine', qty: '200 g' }],
            prepSteps: ['Mélanger'],
            cookingTimer: 900,
            sourceUrl: 'https://www.marmiton.org/x',
            sourceName: 'Marmiton',
        });
    });

    it('names an unknown source "Source originale"', () => {
        const text = buildDescription('x', { ...EMPTY_RECIPE, utensils: ['fouet'], sourceUrl: 'https://blog.example/r' });
        expect(parseLiveDescription(text).recipe).toMatchObject({ sourceName: 'Source originale' });
    });
});

describe('description quick suggestions', () => {
    it('adds a bullet line and refuses duplicates', () => {
        expect(appendHint('', 'Pas à pas')).toBe('• Pas à pas');
        expect(appendHint('Bonjour', 'Pas à pas')).toBe('Bonjour\n• Pas à pas');
        expect(canAppendHint('Bonjour\n• Pas à pas', 'Pas à pas')).toBe(false);
    });

    it('never exceeds the 500 character limit', () => {
        const nearlyFull = 'a'.repeat(DESCRIPTION_MAX - 5);
        expect(canAppendHint(nearlyFull, 'Recette maison')).toBe(false);
        expect(appendHint(nearlyFull, 'Recette maison')).toBe(nearlyFull);
    });
});

describe('recipeFromMarmiton', () => {
    it('maps the scrape response and keeps the citation', () => {
        const patch = recipeFromMarmiton(
            {
                ingredients: ['200 g de farine', 'sel'],
                steps: ['Étape 1'],
                cook_time_mins: 400,
                prep_time_mins: 10,
                rest_time_mins: 5,
                utensils: ['fouet'],
            },
            'https://www.marmiton.org/r'
        );
        expect(patch).toEqual({
            sourceUrl: 'https://www.marmiton.org/r',
            sourceName: 'Marmiton',
            ingredients: [
                { name: 'farine', qty: '200 g' },
                { name: 'sel', qty: 'Au goût' },
            ],
            prepSteps: ['Étape 1'],
            cookTimeMins: 180, // capped at the timer maximum
            prepTimeMins: 10,
            restTimeMins: 5,
            utensils: ['fouet'],
        });
    });
});
