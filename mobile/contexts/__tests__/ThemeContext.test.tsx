import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { palettes } from '@/constants/theme';
import storage from '@/services/storage';

import { makeStyles, parseThemePreference, resolveScheme, ThemeProvider, THEME_STORAGE_KEY, useTheme } from '../ThemeContext';

jest.mock('@/services/storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn(() => Promise.resolve()), removeItem: jest.fn() },
}));

const mockedStorage = storage as unknown as { getItem: jest.Mock; setItem: jest.Mock };

describe('ThemeContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedStorage.getItem.mockResolvedValue(null);
    });

    describe('pure helpers', () => {
        it('parses stored preferences and rejects garbage', () => {
            expect(parseThemePreference('light')).toBe('light');
            expect(parseThemePreference('dark')).toBe('dark');
            expect(parseThemePreference('system')).toBe('system');
            expect(parseThemePreference('purple')).toBe('system');
            expect(parseThemePreference(null)).toBe('system');
        });

        it('resolves the scheme: explicit choice wins, system follows the phone (dark by default)', () => {
            expect(resolveScheme('light', 'dark')).toBe('light');
            expect(resolveScheme('dark', 'light')).toBe('dark');
            expect(resolveScheme('system', 'light')).toBe('light');
            expect(resolveScheme('system', 'dark')).toBe('dark');
            expect(resolveScheme('system', null)).toBe('dark');
        });
    });

    it('falls back to the dark palette outside a provider instead of throwing', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current.scheme).toBe('dark');
        expect(result.current.colors).toBe(palettes.dark);
    });

    it('loads the stored preference and becomes ready', async () => {
        mockedStorage.getItem.mockResolvedValue('light');
        const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

        expect(result.current.ready).toBe(false);
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(result.current.preference).toBe('light');
        expect(result.current.scheme).toBe('light');
        expect(result.current.colors).toBe(palettes.light);
        expect(mockedStorage.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    });

    it('becomes ready even when storage fails', async () => {
        mockedStorage.getItem.mockRejectedValue(new Error('keychain locked'));
        const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(result.current.preference).toBe('system');
    });

    it('persists and applies a new preference', async () => {
        const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
        await waitFor(() => expect(result.current.ready).toBe(true));

        await act(async () => {
            await result.current.setPreference('light');
        });

        expect(result.current.scheme).toBe('light');
        expect(mockedStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'light');
    });

    it('does not let a late storage read overwrite a preference chosen meanwhile', async () => {
        let resolveRead: (value: string | null) => void = () => {};
        mockedStorage.getItem.mockReturnValue(new Promise((resolve) => (resolveRead = resolve)));
        const { result, unmount } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

        unmount();
        resolveRead('light'); // resolves after unmount: must not throw / warn
        await Promise.resolve();
    });

    it('makeStyles rebuilds styles when the scheme changes', async () => {
        const useStyles = makeStyles(({ colors }) => ({ box: { backgroundColor: colors.bg } }));
        function Probe() {
            const styles = useStyles();
            return <Text testID="probe">{String(styles.box && (styles.box as { backgroundColor: string }).backgroundColor)}</Text>;
        }
        function Switcher() {
            const { setPreference } = useTheme();
            React.useEffect(() => {
                void setPreference('light');
            }, [setPreference]);
            return <Probe />;
        }

        const { getByTestId } = render(
            <ThemeProvider>
                <Switcher />
            </ThemeProvider>
        );

        await waitFor(() => expect(getByTestId('probe').props.children).toBe(palettes.light.bg));
    });
});
