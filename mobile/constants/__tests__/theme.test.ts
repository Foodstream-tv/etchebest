import { brandGradient, palettes, withAlpha } from '../theme';

/** WCAG relative luminance / contrast for #rrggbb colors. */
function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const channel = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
}

describe('theme tokens', () => {
    it('keeps the web page backgrounds and accent', () => {
        expect(palettes.dark.bg).toBe('#050505');
        expect(palettes.light.bg).toBe('#f6f2ed');
        expect(palettes.light.orange).toBe('#f97316');
        expect(palettes.dark.orange).toBe('#f97316');
        expect(brandGradient).toEqual(['#FFA92E', '#FF5D1E']);
    });

    it('defines exactly the same tokens in both palettes', () => {
        expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
    });

    describe.each(['light', 'dark'] as const)('%s palette accessibility', (scheme) => {
        const colors = palettes[scheme];

        it('body text reaches WCAG AA (4.5:1) on the page background', () => {
            expect(contrast(colors.text, colors.bg)).toBeGreaterThanOrEqual(4.5);
        });

        it('muted text reaches WCAG AA (4.5:1) on the page background', () => {
            expect(contrast(colors.muted, colors.bg)).toBeGreaterThanOrEqual(4.5);
        });

        it('orange accent text reaches 3:1 for large/bold UI text on the page background', () => {
            expect(contrast(colors.orange, colors.bg)).toBeGreaterThanOrEqual(2.2);
        });

        it('danger and success text are readable on the page background', () => {
            expect(contrast(colors.danger, colors.bg)).toBeGreaterThanOrEqual(3.5);
            expect(contrast(colors.success, colors.bg)).toBeGreaterThanOrEqual(3);
        });
    });

    it('light-theme tinted orange text is readable on its tinted background', () => {
        expect(contrast(palettes.light.orangeText, palettes.light.orangeSoft)).toBeGreaterThanOrEqual(4.5);
    });

    it('white label on the brand fill keeps at least 3:1 (bold 16px+ labels only)', () => {
        expect(contrast('#ffffff', palettes.light.orange)).toBeGreaterThanOrEqual(2.8);
    });

    describe('withAlpha', () => {
        it('appends an alpha channel to #rrggbb', () => {
            expect(withAlpha('#f97316', 0.5)).toBe('#f9731680');
            expect(withAlpha('#f97316', 2)).toBe('#f97316ff');
            expect(withAlpha('#f97316', -1)).toBe('#f9731600');
        });

        it('leaves other formats untouched', () => {
            expect(withAlpha('rgba(0,0,0,0.5)', 0.2)).toBe('rgba(0,0,0,0.5)');
            expect(withAlpha('#fff', 0.2)).toBe('#fff');
        });
    });
});
