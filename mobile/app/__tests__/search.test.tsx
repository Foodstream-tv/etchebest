import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { globalSearch } from '@/services/social';

import SearchScreen from '../search';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
}));

jest.mock('react-native-safe-area-context', () => ({
    ...jest.requireActual('react-native-safe-area-context'),
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/services/social', () => ({
    ...jest.requireActual('@/services/social'),
    globalSearch: jest.fn(),
}));

const mockedSearch = globalSearch as jest.Mock;

describe('SearchScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedSearch.mockReset();
        jest.useFakeTimers();
    });
    afterEach(() => jest.useRealTimers());

    const type = async (utils: ReturnType<typeof renderWithProviders>, text: string) => {
        fireEvent.changeText(utils.getByTestId('search-input'), text);
        await act(async () => {
            await jest.advanceTimersByTimeAsync(300);
        });
    };

    it('shows a hint and does not call the API for an empty query', async () => {
        const utils = renderWithProviders(<SearchScreen />);
        expect(utils.getByTestId('search-idle')).toBeTruthy();

        await type(utils, '   ');
        expect(mockedSearch).not.toHaveBeenCalled();
    });

    it('debounces and shows chefs and lives', async () => {
        mockedSearch.mockResolvedValue({
            users: [{ id: 'u1', username: 'chefmo', email: 'secret@x.fr' }],
            lives: [{ id: 3, room_id: 'room-3', title: 'Ramen night', dish_name: 'Ramen' }],
        });
        const utils = renderWithProviders(<SearchScreen />);

        fireEvent.changeText(utils.getByTestId('search-input'), 'r');
        fireEvent.changeText(utils.getByTestId('search-input'), 'ra');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(100);
        });
        expect(mockedSearch).not.toHaveBeenCalled();
        fireEvent.changeText(utils.getByTestId('search-input'), 'ramen');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(300);
        });

        expect(mockedSearch).toHaveBeenCalledTimes(1);
        expect(mockedSearch).toHaveBeenCalledWith('ramen');
        expect(utils.getByText('chefmo')).toBeTruthy();
        expect(utils.getByText('Ramen night')).toBeTruthy();
        // never expose other users' e-mails
        expect(utils.queryByText('secret@x.fr')).toBeNull();
    });

    it('never falls back to a user e-mail when the username is missing', async () => {
        mockedSearch.mockResolvedValue({ users: [{ id: 'u2', email: 'private@x.fr' }], lives: [] });
        const utils = renderWithProviders(<SearchScreen />);
        await type(utils, 'x');

        expect(utils.queryByText('private@x.fr')).toBeNull();
        expect(utils.getAllByText('Chef FoodStream').length).toBeGreaterThan(0);
    });

    it('navigates to the profile and the viewer', async () => {
        mockedSearch.mockResolvedValue({
            users: [{ id: 'u1', username: 'chefmo' }],
            lives: [{ id: 3, room_id: 'room-3', title: 'Ramen night' }],
        });
        const utils = renderWithProviders(<SearchScreen />);
        await type(utils, 'ra');

        fireEvent.press(utils.getByTestId('result-user-u1'));
        expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/profile/[id]', params: { id: 'u1' } });

        fireEvent.press(utils.getByTestId('result-live-3'));
        expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/live-viewer', params: { roomId: 'room-3', roomName: 'Ramen night' } });
    });

    it('does not navigate for a live result without a room id', async () => {
        mockedSearch.mockResolvedValue({ users: [], lives: [{ id: 9, title: 'No room' }] });
        const utils = renderWithProviders(<SearchScreen />);
        await type(utils, 'no');

        fireEvent.press(utils.getByTestId('result-live-9'));
        expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('shows the "no results" state', async () => {
        mockedSearch.mockResolvedValue({ users: [], lives: [] });
        const utils = renderWithProviders(<SearchScreen />);
        await type(utils, 'zzz');

        expect(utils.getByTestId('search-empty')).toBeTruthy();
    });

    it('shows an error state when the request fails', async () => {
        mockedSearch.mockRejectedValue(new Error('Erreur 500'));
        const utils = renderWithProviders(<SearchScreen />);
        await type(utils, 'ramen');

        expect(utils.getByTestId('search-error')).toBeTruthy();
    });

    it('ignores a slow response for an outdated query', async () => {
        let resolveSlow: (value: unknown) => void = () => {};
        mockedSearch.mockReturnValueOnce(new Promise((resolve) => (resolveSlow = resolve)));
        const utils = renderWithProviders(<SearchScreen />);
        await type(utils, 'old');

        mockedSearch.mockResolvedValueOnce({ users: [{ id: 'new', username: 'fresh' }], lives: [] });
        await type(utils, 'new');
        await act(async () => {
            resolveSlow({ users: [{ id: 'old', username: 'stale' }], lives: [] });
        });

        expect(utils.getByText('fresh')).toBeTruthy();
        expect(utils.queryByText('stale')).toBeNull();
    });

    it('goes back', () => {
        const utils = renderWithProviders(<SearchScreen />);
        fireEvent.press(utils.getByLabelText('Retour'));
        expect(mockRouter.back).toHaveBeenCalled();
    });
});
