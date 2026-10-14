import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { makeLive } from '@/test-utils/fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { getLives } from '@/services/lives';

import LivesScreen, { parseTagParams } from '../(tabs)/lives';
import ReplaysScreen from '../(tabs)/replays';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string | string[] | undefined> = {};

jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => {
        const React = require('react');
        React.useEffect(() => effect(), [effect]);
    },
}));

jest.mock('react-native-safe-area-context', () => ({
    ...jest.requireActual('react-native-safe-area-context'),
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/services/lives', () => ({
    ...jest.requireActual('@/services/lives'),
    getLives: jest.fn(),
}));

const mockedGetLives = getLives as jest.Mock;
const page = (lives: ReturnType<typeof makeLive>[], total = lives.length) => ({ lives, total, page: 1, limit: 12 });
const lastQuery = () => mockedGetLives.mock.calls[mockedGetLives.mock.calls.length - 1][0];

describe('LivesScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetLives.mockReset();
        mockParams = {};
    });

    it('lists lives with the web hero and filters', async () => {
        mockedGetLives.mockResolvedValue(page([makeLive({ title: 'Ramen' }), makeLive({ title: 'Tarte', status: 'scheduled' })]));
        const { getByText, getByTestId } = renderWithProviders(<LivesScreen />);

        expect(getByText('Trouve le live qui te donne faim')).toBeTruthy();
        await waitFor(() => expect(getByText('Ramen')).toBeTruthy());
        expect(getByText('Tarte')).toBeTruthy();
        expect(getByTestId('segment-live')).toBeTruthy();
        expect(lastQuery()).toMatchObject({ q: '', tag: [], status: 'all', page: 1 });
    });

    it('filters by status tab and by tag', async () => {
        mockedGetLives.mockResolvedValue(page([]));
        const { getByTestId } = renderWithProviders(<LivesScreen />);
        await waitFor(() => expect(mockedGetLives).toHaveBeenCalled());

        fireEvent.press(getByTestId('segment-live'));
        await waitFor(() => expect(lastQuery()).toMatchObject({ status: 'live' }));

        fireEvent.press(getByTestId('tag-BBQ'));
        await waitFor(() => expect(lastQuery()).toMatchObject({ status: 'live', tag: ['BBQ'] }));

        // tags are combined, and "Tout" clears them
        fireEvent.press(getByTestId('tag-Healthy'));
        await waitFor(() => expect(lastQuery()).toMatchObject({ tag: ['BBQ', 'Healthy'] }));
        fireEvent.press(getByTestId('tag-BBQ'));
        await waitFor(() => expect(lastQuery()).toMatchObject({ tag: ['Healthy'] }));
        fireEvent.press(getByTestId('tag-Tout'));
        await waitFor(() => expect(lastQuery()).toMatchObject({ tag: [] }));
    });

    it('debounces the search text', async () => {
        jest.useFakeTimers();
        try {
            mockedGetLives.mockResolvedValue(page([]));
            const { getByTestId } = renderWithProviders(<LivesScreen />);
            await act(async () => {
                await jest.advanceTimersByTimeAsync(400);
            });
            mockedGetLives.mockClear();

            fireEvent.changeText(getByTestId('lives-search'), 'r');
            fireEvent.changeText(getByTestId('lives-search'), 'ra');
            fireEvent.changeText(getByTestId('lives-search'), 'ramen');
            await act(async () => {
                await jest.advanceTimersByTimeAsync(100);
            });
            expect(mockedGetLives).not.toHaveBeenCalled();

            await act(async () => {
                await jest.advanceTimersByTimeAsync(400);
            });
            expect(lastQuery()).toMatchObject({ q: 'ramen' });
            expect(mockedGetLives).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });

    it('starts from the q/tag params sent by the Home screen', async () => {
        mockParams = { q: 'ramen', tag: 'Asiatique' };
        mockedGetLives.mockResolvedValue(page([]));
        renderWithProviders(<LivesScreen />);

        await waitFor(() => expect(lastQuery()).toMatchObject({ q: 'ramen', tag: ['Asiatique'] }));
    });

    it('accepts array params (router can return string[])', async () => {
        mockParams = { tag: ['Healthy', 'BBQ'] };
        mockedGetLives.mockResolvedValue(page([]));
        renderWithProviders(<LivesScreen />);

        await waitFor(() => expect(lastQuery()).toMatchObject({ tag: ['Healthy'] }));
    });

    it('keeps every tag sent by the Home filters (tags=A|B), without duplicates', async () => {
        mockParams = { tags: 'Asiatique|Vegan', tag: 'Asiatique' };
        mockedGetLives.mockResolvedValue(page([]));
        const { getByTestId } = renderWithProviders(<LivesScreen />);

        await waitFor(() => expect(lastQuery()).toMatchObject({ tag: ['Asiatique', 'Vegan'] }));
        // a filter that is not in the quick-tag list is still shown (and removable)
        fireEvent.press(getByTestId('tag-Vegan'));
        await waitFor(() => expect(lastQuery()).toMatchObject({ tag: ['Asiatique'] }));
    });

    it('shows the empty state, then an error state with retry', async () => {
        mockedGetLives.mockResolvedValueOnce(page([]));
        const first = renderWithProviders(<LivesScreen />);
        await waitFor(() => expect(first.getByTestId('feed-empty')).toBeTruthy());
        first.unmount();

        mockedGetLives.mockRejectedValueOnce(new Error('Erreur 500'));
        const second = renderWithProviders(<LivesScreen />);
        await waitFor(() => expect(second.getByTestId('feed-error')).toBeTruthy());

        mockedGetLives.mockResolvedValue(page([makeLive({ title: 'Revenu' })]));
        await act(async () => {
            fireEvent.press(second.getByText('Réessayer'));
        });
        await waitFor(() => expect(second.getByText('Revenu')).toBeTruthy());
    });

    it('loads the next page on demand and keeps cards unique', async () => {
        const first = Array.from({ length: 2 }, (_, i) => makeLive({ title: `A${i}` }));
        mockedGetLives.mockResolvedValueOnce(page(first, 3));
        const { getByTestId, getByText, queryByTestId } = renderWithProviders(<LivesScreen />);
        await waitFor(() => expect(getByText('A0')).toBeTruthy());

        mockedGetLives.mockResolvedValueOnce(page([makeLive({ title: 'B0' })], 3));
        await act(async () => {
            fireEvent.press(getByTestId('feed-load-more'));
        });

        await waitFor(() => expect(getByText('B0')).toBeTruthy());
        expect(mockedGetLives.mock.calls.some(([query]) => query.page === 2)).toBe(true);
        expect(queryByTestId('feed-load-more')).toBeNull();
    });

    it('opens the viewer for a tapped live', async () => {
        mockedGetLives.mockResolvedValue(page([makeLive({ title: 'Cassoulet', room_id: 'r-cass' })]));
        const { getByText } = renderWithProviders(<LivesScreen />);
        await waitFor(() => expect(getByText('Cassoulet')).toBeTruthy());

        fireEvent.press(getByText('Cassoulet'));
        expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/live-viewer', params: { roomId: 'r-cass', roomName: 'Cassoulet' } });
    });
});

describe('ReplaysScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetLives.mockReset();
        mockParams = {};
    });

    it('lists ended lives only and shows the count', async () => {
        mockedGetLives.mockResolvedValue(page([makeLive({ status: 'ended', title: 'Hier', has_replay: true })], 1));
        const { getByText } = renderWithProviders(<ReplaysScreen />);

        await waitFor(() => expect(getByText('Hier')).toBeTruthy());
        expect(lastQuery()).toMatchObject({ status: 'ended' });
        expect(getByText('1 rediffusion disponible')).toBeTruthy();
    });

    it('hides ended lives that have no recording', async () => {
        mockedGetLives.mockResolvedValue(
            page([makeLive({ status: 'ended', title: 'Avec replay', has_replay: true }), makeLive({ status: 'ended', title: 'Sans replay', has_replay: false })], 2)
        );
        const { getByText, queryByText } = renderWithProviders(<ReplaysScreen />);

        await waitFor(() => expect(getByText('Avec replay')).toBeTruthy());
        expect(queryByText('Sans replay')).toBeNull();
        expect(getByText('1 rediffusion disponible')).toBeTruthy();
    });

    it('shows the empty state wording of the web', async () => {
        mockedGetLives.mockResolvedValue(page([]));
        const { getByText } = renderWithProviders(<ReplaysScreen />);

        await waitFor(() => expect(getByText('Aucune rediffusion disponible')).toBeTruthy());
    });

    it('opens the replay in the viewer', async () => {
        mockedGetLives.mockResolvedValue(page([makeLive({ status: 'ended', title: 'Replay', room_id: 'r-end', replay_url: '/replays-storage/r-end/master.m3u8' })]));
        const { getByText } = renderWithProviders(<ReplaysScreen />);
        await waitFor(() => expect(getByText('Replay')).toBeTruthy());

        fireEvent.press(getByText('Replay'));
        expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/live-viewer', params: { roomId: 'r-end', roomName: 'Replay' } });
    });
});

describe('parseTagParams', () => {
    it('merges, trims, de-duplicates and drops the "all" tag', () => {
        expect(parseTagParams(undefined, undefined)).toEqual([]);
        expect(parseTagParams('Tout', undefined)).toEqual([]);
        expect(parseTagParams('BBQ', 'Healthy| BBQ |')).toEqual(['Healthy', 'BBQ']);
        expect(parseTagParams(['A', 'B'], ['C|D'])).toEqual(['C', 'D', 'A']);
    });
});
