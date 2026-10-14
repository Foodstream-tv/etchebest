import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { makeLive } from '@/test-utils/fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { getLives } from '@/services/lives';

import HomeScreen, { creatorsFromLives } from '../(tabs)/index';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    useFocusEffect: (effect: () => void | (() => void)) => {
        const React = require('react');
        React.useEffect(() => effect(), [effect]);
    },
}));

jest.mock('react-native-safe-area-context', () => ({
    ...jest.requireActual('react-native-safe-area-context'),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/services/lives', () => ({
    ...jest.requireActual('@/services/lives'),
    getLives: jest.fn(),
}));

jest.mock('@/services/auth', () => ({
    __esModule: true,
    default: { getUser: jest.fn(() => Promise.resolve({ id: 'me', email: 'me@x.fr', username: 'moi' })) },
}));

const mockedGetLives = getLives as jest.Mock;
const page = (lives: ReturnType<typeof makeLive>[]) => ({ lives, total: lives.length, page: 1, limit: 24 });

describe('HomeScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the hero, lives and category cards from the web home', async () => {
        const live = makeLive({ title: 'Pad Thai', status: 'live' });
        mockedGetLives.mockResolvedValue(page([live, makeLive({ status: 'scheduled', title: 'Plus tard' })]));

        const { getByText, queryByText, getByTestId } = renderWithProviders(<HomeScreen />);

        expect(getByText('Regarde, cuisine, partage.')).toBeTruthy();
        await waitFor(() => expect(getByText('Pad Thai')).toBeTruthy());
        // featured section only lists live ones
        expect(queryByText('Plus tard')).toBeNull();
        expect(getByText('Explorer par cuisine')).toBeTruthy();
        expect(getByTestId('category-Asiatique')).toBeTruthy();
        // creators come from the hosts of the loaded lives
        expect(getByTestId(`creator-${live.user!.id}`)).toBeTruthy();
    });

    it('limits the featured section to four lives', async () => {
        mockedGetLives.mockResolvedValue(page(Array.from({ length: 6 }, (_, i) => makeLive({ title: `L${i}`, status: 'live' }))));
        const { getByText, queryByText } = renderWithProviders(<HomeScreen />);

        await waitFor(() => expect(getByText('L0')).toBeTruthy());
        expect(getByText('L3')).toBeTruthy();
        expect(queryByText('L4')).toBeNull();
    });

    it('shows the empty state pointing to the studio when nothing is live', async () => {
        mockedGetLives.mockResolvedValue(page([]));
        const { getByTestId, getByText } = renderWithProviders(<HomeScreen />);

        await waitFor(() => expect(getByTestId('home-empty')).toBeTruthy());
        fireEvent.press(getByText('Accéder au studio'));
        expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/studio');
    });

    it('shows an error with retry when the first load fails', async () => {
        mockedGetLives.mockRejectedValueOnce(new Error('offline'));
        const { getByTestId, getByText } = renderWithProviders(<HomeScreen />);

        await waitFor(() => expect(getByTestId('home-error')).toBeTruthy());

        mockedGetLives.mockResolvedValue(page([makeLive({ title: 'Back', status: 'live' })]));
        await act(async () => {
            fireEvent.press(getByText('Réessayer'));
        });
        await waitFor(() => expect(getByText('Back')).toBeTruthy());
    });

    it('opens a live in the viewer', async () => {
        const live = makeLive({ title: 'Tarte', status: 'live', room_id: 'room-tarte' });
        mockedGetLives.mockResolvedValue(page([live]));
        const { getByText } = renderWithProviders(<HomeScreen />);

        await waitFor(() => expect(getByText('Tarte')).toBeTruthy());
        fireEvent.press(getByText('Tarte'));

        expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/live-viewer', params: { roomId: 'room-tarte', roomName: 'Tarte' } });
    });

    it('sends the search text to the Lives tab', async () => {
        mockedGetLives.mockResolvedValue(page([]));
        const { getByTestId } = renderWithProviders(<HomeScreen />);

        fireEvent.changeText(getByTestId('home-search'), '  ramen ');
        fireEvent.press(getByTestId('home-discover'));

        expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(tabs)/lives', params: { q: 'ramen', tag: undefined } });
    });

    it('sends every selected filter to the Lives tab (not just the first one)', async () => {
        mockedGetLives.mockResolvedValue(page([]));
        const { getByTestId, getByText } = renderWithProviders(<HomeScreen />);

        fireEvent.press(getByTestId('home-filters'));
        fireEvent.press(getByTestId('filter-Asiatique'));
        fireEvent.press(getByTestId('filter-Vegan'));
        fireEvent.press(getByText('Afficher les résultats'));
        fireEvent.press(getByTestId('home-discover'));

        expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(tabs)/lives', params: { q: undefined, tags: 'Asiatique|Vegan' } });
    });

    it('category cards deep-link to the Lives tab with the tag', async () => {
        mockedGetLives.mockResolvedValue(page([]));
        const { getByTestId } = renderWithProviders(<HomeScreen />);

        fireEvent.press(getByTestId('category-BBQ'));

        expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(tabs)/lives', params: { tag: 'BBQ' } });
    });

    it('opens the search screen and the profile from the header', async () => {
        mockedGetLives.mockResolvedValue(page([]));
        const { getByTestId } = renderWithProviders(<HomeScreen />);

        fireEvent.press(getByTestId('header-search'));
        expect(mockRouter.push).toHaveBeenCalledWith('/search');
        fireEvent.press(getByTestId('header-profile'));
        expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/profil');
    });

    describe('creatorsFromLives', () => {
        it('deduplicates hosts and skips lives without a host id', () => {
            const a = makeLive({ user: { id: 'a', username: 'anna', profileImageUrl: 'img' } });
            const dup = makeLive({ user: { id: 'a', username: 'anna' } });
            const none = makeLive({ user: undefined });
            expect(creatorsFromLives([a, dup, none])).toEqual([{ id: 'a', name: 'anna', image: 'img' }]);
        });
    });
});
