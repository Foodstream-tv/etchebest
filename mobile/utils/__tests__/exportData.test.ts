import { Platform, Share } from 'react-native';

import { shareMyData } from '../exportData';

describe('shareMyData', () => {
    const originalOS = Platform.OS;
    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { value: originalOS });
        jest.restoreAllMocks();
    });

    it('opens the share sheet with the JSON on native', async () => {
        Object.defineProperty(Platform, 'OS', { value: 'ios' });
        const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);

        await shareMyData({ profile: { email: 'a@b.c' } }, 'My data');

        expect(share).toHaveBeenCalledTimes(1);
        const arg = share.mock.calls[0][0];
        expect(arg.title).toBe('My data');
        expect(JSON.parse(arg.message as string)).toEqual({ profile: { email: 'a@b.c' } });
    });

    it('downloads a .json file on web', async () => {
        Object.defineProperty(Platform, 'OS', { value: 'web' });
        const click = jest.fn();
        const link: Record<string, unknown> = { click, remove: jest.fn() };
        (globalThis as any).document = { createElement: jest.fn(() => link), body: { appendChild: jest.fn() } };
        (globalThis as any).URL.createObjectURL = jest.fn(() => 'blob:x');
        (globalThis as any).URL.revokeObjectURL = jest.fn();

        await shareMyData({ a: 1 }, 'My data');

        expect(link.download).toBe('foodstream-my-data.json');
        expect(link.href).toBe('blob:x');
        expect(click).toHaveBeenCalledTimes(1);
        expect((globalThis as any).URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
        delete (globalThis as any).document;
    });
});
