import en from '../messages/en';
import fr from '../messages/fr';

// `{plural}` is language specific (English often needs it where French doesn't, and vice versa)
const placeholders = (value: string) => (value.match(/\{[a-zA-Z]+\}/g) ?? []).filter((name) => name !== '{plural}').sort();

describe('i18n dictionaries', () => {
    const frKeys = Object.keys(fr).sort();
    const enKeys = Object.keys(en).sort();

    it('define exactly the same keys in French and English', () => {
        expect(enKeys).toEqual(frKeys);
    });

    it('have no empty translations', () => {
        const empty = frKeys.filter((key) => !(fr as Record<string, string>)[key]?.trim() || !(en as Record<string, string>)[key]?.trim());
        expect(empty).toEqual([]);
    });

    it('use the same interpolation placeholders in both languages', () => {
        const mismatches = frKeys.filter(
            (key) => JSON.stringify(placeholders((fr as Record<string, string>)[key])) !== JSON.stringify(placeholders((en as Record<string, string>)[key]))
        );
        expect(mismatches).toEqual([]);
    });

    it('contains the web wording the mobile screens rely on', () => {
        for (const key of ['nav.home', 'nav.lives', 'nav.studio', 'nav.replays', 'nav.profile', 'watch.room.chatSend', 'auth.verify.title']) {
            expect(frKeys).toContain(key);
        }
    });
});
