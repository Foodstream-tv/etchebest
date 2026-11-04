import { stableKeys } from '../ListEditors';

describe('stableKeys', () => {
    it('keeps the key of every row when another one is removed', () => {
        const before = stableKeys(['Farine', 'Sucre', 'Oeufs', 'Lait']);
        const after = stableKeys(['Sucre', 'Oeufs', 'Lait']); // "Farine" removed
        expect(after).toEqual(before.slice(1)); // the next rows are not remounted (no replayed animation, no lost draft)
    });

    it('tells identical texts apart, in order', () => {
        const keys = stableKeys(['Sel', 'Sel', 'Poivre', 'Sel']);
        expect(new Set(keys).size).toBe(4);
        // removing the first "Sel" shifts the later ones, as it must for two identical rows
        expect(stableKeys(['Sel', 'Poivre', 'Sel'])[1]).toBe(keys[2]);
    });
});
