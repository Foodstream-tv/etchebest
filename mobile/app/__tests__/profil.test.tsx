import React from 'react';

import ProfileScreen from '../(tabs)/profil';
import apiService from '@/services/api';
import authService from '@/services/auth';
import { ApiError } from '@/services/http';
import { getMyActivities, getUserFollowers } from '@/services/social';
import toast from '@/utils/toast';
import { act, fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';

jest.mock('@/services/api', () => ({
    __esModule: true,
    default: { getProfile: jest.fn(), updateProfile: jest.fn() },
}));
jest.mock('@/services/auth', () => ({
    __esModule: true,
    default: { getToken: jest.fn(), getUser: jest.fn(), saveAuth: jest.fn(), logout: jest.fn() },
}));
jest.mock('@/services/social', () => ({
    __esModule: true,
    getMyActivities: jest.fn(),
    getUserFollowers: jest.fn(),
    getUserFollowing: jest.fn(),
    userImage: (u: any) => u?.profileImageUrl || u?.profile_image_url,
}));
jest.mock('@/services/storage', () => {
    const store = new Map<string, string>();
    const storage = {
        getItem: jest.fn(async (key: string) => store.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            store.delete(key);
        }),
    };
    return { __esModule: true, default: storage, storage };
});
jest.mock('@/utils/toast', () => ({
    __esModule: true,
    default: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

const { __mockRouter: router } = jest.requireMock('expo-router');
const storage = jest.requireMock('@/services/storage').default;

const mockedApi = apiService as unknown as { getProfile: jest.Mock; updateProfile: jest.Mock };
const mockedAuth = authService as unknown as { getToken: jest.Mock; getUser: jest.Mock; saveAuth: jest.Mock; logout: jest.Mock };
const mockedActivities = getMyActivities as jest.Mock;
const mockedFollowers = getUserFollowers as jest.Mock;

const profile = {
    id: 'me',
    email: 'camille@foodstream.com',
    firstName: 'Camille',
    lastName: 'Dupont',
    username: 'camille',
    profileImageUrl: '',
    description: 'Cuisine du monde',
    role: 'USER',
    followersIds: ['a', 'b', 'c'],
    followingIds: ['d'],
    isVerified: true,
    isFeaturedChef: false,
};

const activity = { id: 'act1', user_id: 'me', actor_id: 'a', type: 'follow', text: 'Alice vous suit', created_at: '2026-10-01T10:00:00Z' };

async function renderLoaded() {
    const utils = renderWithProviders(<ProfileScreen />);
    await utils.findByText('Camille Dupont');
    return utils;
}

describe('ProfileScreen (tab)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedApi.getProfile.mockResolvedValue(profile);
        mockedActivities.mockResolvedValue([activity]);
        mockedAuth.getToken.mockResolvedValue('tok');
        mockedAuth.getUser.mockResolvedValue({ id: 'me', email: profile.email, role: 'USER' });
        mockedAuth.saveAuth.mockResolvedValue(undefined);
        mockedAuth.logout.mockResolvedValue(undefined);
    });

    it('renders the real profile data (no mock stats or fake activity)', async () => {
        const { getByText, getByTestId, queryByText } = await renderLoaded();

        expect(getByText('@camille')).toBeTruthy();
        expect(getByText('camille@foodstream.com')).toBeTruthy();
        expect(getByText('Cuisine du monde')).toBeTruthy();
        expect(getByText('Vérifié')).toBeTruthy();
        expect(getByText('Alice vous suit')).toBeTruthy();
        expect(getByTestId('follow-stats-followers').props.accessibilityLabel).toBe('Afficher les 3 followers');
        expect(getByTestId('follow-stats-following').props.accessibilityLabel).toBe('Afficher les 1 profil suivi');

        expect(queryByText(/Ramen Tonkotsu/)).toBeNull();
        expect(queryByText(/Streak/i)).toBeNull();
        expect(queryByText(/Chef Débutant/)).toBeNull();
        expect(mockedActivities).toHaveBeenCalledWith(30);
    });

    it('shows an empty state when there is no activity', async () => {
        mockedActivities.mockResolvedValue([]);
        const { findByTestId } = await renderLoaded();
        expect(await findByTestId('profile-activity-empty')).toBeTruthy();
    });

    it('keeps the profile visible when only the activity request fails', async () => {
        mockedActivities.mockRejectedValue(new Error('boom'));
        const { getByText, findByText } = await renderLoaded();
        expect(await findByText("Impossible de charger l’activité.")).toBeTruthy();
        expect(getByText('Camille Dupont')).toBeTruthy();
    });

    it('shows an error state with a working retry when the profile cannot be loaded', async () => {
        mockedApi.getProfile.mockRejectedValueOnce(new Error('Erreur réseau'));
        const { findByTestId, getByText, findByText } = renderWithProviders(<ProfileScreen />);

        expect(await findByTestId('profile-error')).toBeTruthy();
        fireEvent.press(getByText('Réessayer'));

        expect(await findByText('Camille Dupont')).toBeTruthy();
        expect(mockedApi.getProfile).toHaveBeenCalledTimes(2);
    });

    it('signs out then goes to the login screen', async () => {
        const { getByTestId } = await renderLoaded();

        fireEvent.press(getByTestId('profile-signout'));

        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
        expect(mockedAuth.logout).toHaveBeenCalledTimes(1);
    });

    it('opens the settings from the gear and from the preferences card', async () => {
        const { getByTestId } = await renderLoaded();

        fireEvent.press(getByTestId('profile-settings'));
        fireEvent.press(getByTestId('profile-all-settings'));

        expect(router.push).toHaveBeenNthCalledWith(1, '/settings');
        expect(router.push).toHaveBeenNthCalledWith(2, '/settings');
    });

    it('switches and persists the theme', async () => {
        const { getByTestId } = await renderLoaded();

        fireEvent.press(getByTestId('theme-light'));

        await waitFor(() => expect(storage.setItem).toHaveBeenCalledWith('app_theme', 'light'));
        expect(getByTestId('theme-light').props.accessibilityState.selected).toBe(true);
    });

    it('opens the followers list and navigates to a follower profile', async () => {
        mockedFollowers.mockResolvedValue({ count: 3, followers: [{ id: 'u7', username: 'marc', firstName: 'Marc', lastName: 'Petit' }] });
        const { getByTestId, findByText } = await renderLoaded();

        fireEvent.press(getByTestId('follow-stats-followers'));

        expect(await findByText('Marc Petit')).toBeTruthy();
        expect(mockedFollowers).toHaveBeenCalledWith('me');

        fireEvent.press(await findByText('Marc Petit'));
        expect(router.push).toHaveBeenCalledWith({ pathname: '/profile/[id]', params: { id: 'u7' } });
    });

    describe('edit profile', () => {
        const open = async () => {
            const utils = await renderLoaded();
            fireEvent.press(utils.getByTestId('profile-edit'));
            return utils;
        };

        it('validates the form before calling the API', async () => {
            const { getByLabelText, getByTestId, findByText } = await open();

            fireEvent.changeText(getByLabelText('E-mail'), 'not-an-email');
            fireEvent.changeText(getByLabelText('Pseudo'), 'ab');
            fireEvent.press(getByTestId('edit-profile-save'));

            expect(await findByText('Adresse e-mail invalide.')).toBeTruthy();
            expect(await findByText('Le pseudo doit contenir au moins 3 caractères.')).toBeTruthy();
            expect(mockedApi.updateProfile).not.toHaveBeenCalled();
        });

        it('saves, refreshes the screen and keeps the stored session (role, avatar)', async () => {
            const updated = { ...profile, username: 'camille2', description: 'Nouvelle bio', profileImageUrl: 'https://img.test/a.png' };
            mockedApi.updateProfile.mockResolvedValue(updated);
            const { getByLabelText, getByTestId, findByText, queryByTestId } = await open();

            fireEvent.changeText(getByLabelText('Pseudo'), '  camille2  ');
            fireEvent.changeText(getByLabelText('Description'), 'Nouvelle bio');
            fireEvent.press(getByTestId('edit-profile-save'));

            expect(await findByText('@camille2')).toBeTruthy();
            expect(mockedApi.updateProfile).toHaveBeenCalledWith('tok', {
                firstName: 'Camille',
                lastName: 'Dupont',
                username: '  camille2  ',
                email: 'camille@foodstream.com',
                description: 'Nouvelle bio',
            });
            expect(mockedAuth.saveAuth).toHaveBeenCalledWith('tok', expect.objectContaining({ id: 'me', username: 'camille2', role: 'USER', profileImageUrl: 'https://img.test/a.png' }));
            expect(toast.success).toHaveBeenCalled();
            await waitFor(() => expect(queryByTestId('edit-profile-sheet')).toBeNull());
        });

        it('ignores a second tap on save while a request is in flight', async () => {
            let resolve!: (value: unknown) => void;
            mockedApi.updateProfile.mockReturnValue(new Promise((r) => (resolve = r)));
            const { getByTestId } = await open();

            fireEvent.press(getByTestId('edit-profile-save'));
            await waitFor(() => expect(mockedApi.updateProfile).toHaveBeenCalledTimes(1));
            fireEvent.press(getByTestId('edit-profile-save'));
            fireEvent.press(getByTestId('edit-profile-save'));

            expect(mockedApi.updateProfile).toHaveBeenCalledTimes(1);
            await act(async () => {
                resolve({ ...profile });
            });
        });

        it('shows a dedicated message on a 409 conflict and keeps the sheet open', async () => {
            mockedApi.updateProfile.mockRejectedValue(new ApiError('conflict', 409, {}));
            const { getByTestId, findByText } = await open();

            fireEvent.press(getByTestId('edit-profile-save'));

            expect(await findByText('Ce pseudo ou cet e-mail est déjà utilisé.')).toBeTruthy();
            expect(getByTestId('edit-profile-sheet')).toBeTruthy();
            expect(toast.success).not.toHaveBeenCalled();
        });

        it('shows the invalid-data message on a 400', async () => {
            mockedApi.updateProfile.mockRejectedValue(new ApiError('invalid JSON', 400, {}));
            const { getByTestId, findByText } = await open();

            fireEvent.press(getByTestId('edit-profile-save'));

            expect(await findByText('Certaines informations sont invalides.')).toBeTruthy();
        });
    });
});
