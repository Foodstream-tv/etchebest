import { findUtensilsInText, getUtensilEmoji, normalizeText, UTENSIL_PRESETS } from '../utensils';

describe('getUtensilEmoji', () => {
    it('picks a pictogram from free text, ignoring case and accents', () => {
        expect(getUtensilEmoji('Couteau de chef')).toBe('🔪');
        expect(getUtensilEmoji('POÊLE en fonte')).toBe('🍳');
        expect(getUtensilEmoji('petite casserole')).toBe('🍲');
        expect(getUtensilEmoji('Saladier')).toBe('🥣');
    });

    it('falls back to a plate for anything unknown or empty', () => {
        expect(getUtensilEmoji('')).toBe('🍽️');
        expect(getUtensilEmoji('   ')).toBe('🍽️');
        expect(getUtensilEmoji('truc bizarre')).toBe('🍽️');
    });
});

describe('findUtensilsInText', () => {
    it('finds the utensils a step mentions', () => {
        expect(findUtensilsInText('Émincer au couteau', ['Couteau de chef', 'Fouet'])).toEqual(['Couteau de chef']);
        expect(findUtensilsInText('', ['Fouet'])).toEqual([]);
    });
});

describe('UTENSIL_PRESETS', () => {
    it('has unique ids and a pictogram each', () => {
        const ids = UTENSIL_PRESETS.map((preset) => preset.id);
        expect(new Set(ids).size).toBe(ids.length);
        UTENSIL_PRESETS.forEach((preset) => expect(preset.emoji.length).toBeGreaterThan(0));
    });
});

describe('normalizeText', () => {
    it('lowercases and strips accents', () => {
        expect(normalizeText('  Écumoire ')).toBe('ecumoire');
    });
});
