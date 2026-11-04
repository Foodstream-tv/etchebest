import sharedEn from '@/i18n/messages/shared.en';
import sharedFr from '@/i18n/messages/shared.fr';
import { findUtensilsInText, getUtensilEmoji, normalizeText, presetIdOf, UTENSIL_PRESETS } from '../utensils';

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

describe('quick-add presets, whatever the language they were added in', () => {
    it('recognizes a preset by its French or English label', () => {
        expect(presetIdOf('Poêle')).toBe('pan');
        expect(presetIdOf('Pan')).toBe('pan');
        expect(presetIdOf('  économe ')).toBe('peeler');
        expect(presetIdOf('Peeler')).toBe('peeler');
        expect(presetIdOf('poêle en fonte')).toBeUndefined(); // free text is not a preset
        expect(presetIdOf('')).toBeUndefined();
    });

    it('gives a chip the pictogram of the button that added it, in both languages', () => {
        for (const preset of UTENSIL_PRESETS) {
            for (const catalog of [sharedFr, sharedEn] as Record<string, string>[]) {
                const label = catalog[preset.labelKey];
                expect(getUtensilEmoji(label)).toBe(preset.emoji);
            }
        }
        // the two cases found in review: the keyword rules alone would have said 🍽️ and 🔪
        expect(getUtensilEmoji('Pan')).toBe('🍳');
        expect(getUtensilEmoji('Économe')).toBe('🥕');
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
