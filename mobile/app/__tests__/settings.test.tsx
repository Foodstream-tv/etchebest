import React from 'react';

import SettingsScreen from '../settings';
import apiService from '@/services/api';
import authService from '@/services/auth';
import { ApiError } from '@/services/http';
import preferencesService from '@/services/preferences';
import languageService from '@/services/language';
import toast from '@/utils/toast';
import { fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';

jest.mock('@/services/api', () => ({
    __esModule: true,
    default: { getProfile: jest.fn(), updatePassword: jest.fn(), deleteCurrentUser: jest.fn() },
}));
jest.mock('@/services/auth', () => ({
    __esModule: true,
    default: { getToken: jest.fn(), getUser: jest.fn(), logout: jest.fn() },
}));
jest.mock('@/services/preferences', () => ({
    __esModule: true,
    default: { getPreferences: jest.fn(), setPreferences: jest.fn() },
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
    return { __esModule: true, default: { ...storage, __store: store }, storage };
});
jest.mock('@/utils/toast', () => ({
    __esModule: true,
    default: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

const { __mockRouter: router } = jest.requireMock('expo-router');
const storage = jest.requireMock('@/services/storage').default;
const mockedApi = apiService as unknown as { getProfile: jest.Mock; updatePassword: jest.Mock; deleteCurrentUser: jest.Mock };
const mockedAuth = authService as unknown as { getToken: jest.Mock; getUser: jest.Mock; logout: jest.Mock };
const mockedPrefs = preferencesService as unknown as { getPreferences: jest.Mock; setPreferences: jest.Mock };

const profile = {
    id: 'me',
    email: 'camille@foodstream.com',
    firstName: 'Camille',
    lastName: 'Dupont',
    username: 'camille',
    passwordUpdatedAt: '2026-03-04T10:00:00Z',
};

const prefs = {
    region: 'France',
    timezone: '(GMT+1) Europe / Paris',
    notifications: { global: true, lives: true, reminders: true, promotions: false, channel: 'site' },
};

async function renderLoaded() {
    const utils = renderWithProviders(<SettingsScreen />);
    await utils.findByText('@camille');
    await waitFor(() => expect(utils.getByTestId('notif-lives').props.disabled).toBeFalsy());
    return utils;
}

describe('SettingsScreen', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        storage.__store.clear();
        await languageService.setLanguage('fr');
        jest.clearAllMocks();
        mockedApi.getProfile.mockResolvedValue(profile);
        mockedApi.updatePassword.mockResolvedValue({ message: 'ok', passwordUpdatedAt: '2026-10-14T08:00:00Z' });
        mockedApi.deleteCurrentUser.mockResolvedValue(undefined);
        mockedAuth.getToken.mockResolvedValue('tok');
        mockedAuth.getUser.mockResolvedValue({ id: 'me', email: profile.email, username: 'camille', firstName: 'Camille', lastName: 'Dupont' });
        mockedAuth.logout.mockResolvedValue(undefined);
        mockedPrefs.getPreferences.mockResolvedValue(prefs);
        mockedPrefs.setPreferences.mockResolvedValue(prefs);
    });

    it('shows the real account information and the password change date', async () => {
        const { getByText, queryByText } = await renderLoaded();

        expect(getByText('Camille Dupont')).toBeTruthy();
        expect(getByText('camille@foodstream.com')).toBeTruthy();
        expect(getByText(/Dernière modification le .*2026/)).toBeTruthy();
        // mocked blocks of the previous version are gone
        expect(queryByText(/iPhone 15 Pro/)).toBeNull();
        expect(queryByText(/Authentification/)).toBeNull();
    });

    it('goes back', async () => {
        const { getByTestId } = await renderLoaded();
        fireEvent.press(getByTestId('settings-back'));
        expect(router.back).toHaveBeenCalled();
    });

    describe('appearance', () => {
        it('switches the theme and persists it', async () => {
            const { getByTestId } = await renderLoaded();

            expect(getByTestId('settings-theme-system').props.accessibilityState.selected).toBe(true);
            fireEvent.press(getByTestId('settings-theme-dark'));

            await waitFor(() => expect(storage.setItem).toHaveBeenCalledWith('app_theme', 'dark'));
            expect(getByTestId('settings-theme-dark').props.accessibilityState.selected).toBe(true);

            fireEvent.press(getByTestId('settings-theme-light'));
            await waitFor(() => expect(storage.setItem).toHaveBeenCalledWith('app_theme', 'light'));
            expect(getByTestId('settings-theme-dark').props.accessibilityState.selected).toBe(false);
        });

        it('restores the stored theme preference', async () => {
            await storage.setItem('app_theme', 'light');
            const { findByTestId } = renderWithProviders(<SettingsScreen />);
            const chip = await findByTestId('settings-theme-light');
            await waitFor(() => expect(chip.props.accessibilityState.selected).toBe(true));
        });

        it('changes the language and persists it', async () => {
            const { getByTestId, findByText } = await renderLoaded();

            fireEvent.press(getByTestId('settings-locale-en'));

            expect(await findByText('Account')).toBeTruthy();
            await waitFor(() => expect(storage.setItem).toHaveBeenCalledWith('app_language', 'en'));
        });

        it('stores the region with its timezone', async () => {
            const { getByTestId, findByText } = await renderLoaded();

            fireEvent.press(getByTestId('settings-region-United Kingdom'));

            expect(await findByText(/Europe \/ London/)).toBeTruthy();
            expect(mockedPrefs.setPreferences).toHaveBeenCalledWith({ region: 'United Kingdom', timezone: '(GMT+0) Europe / London' });
        });
    });

    describe('notifications', () => {
        it('persists a toggle and a channel change', async () => {
            const { getByTestId } = await renderLoaded();

            fireEvent(getByTestId('notif-promotions'), 'valueChange', true);
            await waitFor(() => expect(mockedPrefs.setPreferences).toHaveBeenCalledWith({ notifications: { promotions: true } }));
            expect(getByTestId('notif-promotions').props.value).toBe(true);

            fireEvent.press(getByTestId('notif-channel-email'));
            await waitFor(() => expect(mockedPrefs.setPreferences).toHaveBeenCalledWith({ notifications: { channel: 'email' } }));
            expect(getByTestId('notif-channel-email').props.accessibilityState.selected).toBe(true);
            expect(getByTestId('notif-channel-site').props.accessibilityState.selected).toBe(false);
        });

        it('rolls the toggle back when saving fails', async () => {
            mockedPrefs.setPreferences.mockRejectedValue(new Error('disk full'));
            const { getByTestId } = await renderLoaded();

            fireEvent(getByTestId('notif-lives'), 'valueChange', false);

            await waitFor(() => expect(toast.error).toHaveBeenCalled());
            expect(getByTestId('notif-lives').props.value).toBe(true);
        });
    });

    describe('password change', () => {
        const open = async () => {
            const utils = await renderLoaded();
            fireEvent.press(utils.getByTestId('settings-change-password'));
            return utils;
        };
        const fill = (utils: Awaited<ReturnType<typeof open>>, current: string, next: string, confirm: string) => {
            fireEvent.changeText(utils.getByLabelText('Mot de passe actuel'), current);
            fireEvent.changeText(utils.getByLabelText('Nouveau mot de passe (8 caractères min.)'), next);
            fireEvent.changeText(utils.getByLabelText('Confirmer le nouveau mot de passe'), confirm);
            fireEvent.press(utils.getByTestId('password-save'));
        };

        it.each([
            ['empty current password', '', 'NewPassw0rd', 'NewPassw0rd', 'Le mot de passe actuel est requis.'],
            ['new password shorter than 8', 'OldPassw0rd', 'short', 'short', 'Le nouveau mot de passe doit contenir au moins 8 caractères.'],
            ['new equal to current', 'SamePassw0rd', 'SamePassw0rd', 'SamePassw0rd', 'Le nouveau mot de passe doit être différent de l’actuel.'],
            ['confirmation mismatch', 'OldPassw0rd', 'NewPassw0rd', 'NewPassw0rd2', 'La confirmation ne correspond pas.'],
            ['longer than 72 bytes', 'OldPassw0rd', 'é'.repeat(37), 'é'.repeat(37), 'Le mot de passe est trop long (72 caractères maximum).'],
        ])('rejects %s without calling the API', async (_name, current, next, confirm, message) => {
            const utils = await open();
            fill(utils, current, next, confirm);

            expect(await utils.findByText(message)).toBeTruthy();
            expect(mockedApi.updatePassword).not.toHaveBeenCalled();
        });

        it('updates the password, closes the sheet and shows the new date', async () => {
            const utils = await open();
            fill(utils, 'OldPassw0rd', 'NewPassw0rd', 'NewPassw0rd');

            await waitFor(() => expect(mockedApi.updatePassword).toHaveBeenCalledWith('tok', { currentPassword: 'OldPassw0rd', newPassword: 'NewPassw0rd' }));
            await waitFor(() => expect(utils.queryByTestId('password-sheet')).toBeNull());
            expect(toast.success).toHaveBeenCalledWith('Mot de passe mis à jour.');
            expect(utils.getByText(/Dernière modification le .*oct.*2026/i)).toBeTruthy();
        });

        it('shows "incorrect current password" on a 401 and keeps the sheet open', async () => {
            mockedApi.updatePassword.mockRejectedValue(new ApiError('invalid current password', 401, {}));
            const utils = await open();
            fill(utils, 'WrongPassw0rd', 'NewPassw0rd', 'NewPassw0rd');

            expect(await utils.findByText('Mot de passe actuel incorrect.')).toBeTruthy();
            expect(utils.getByTestId('password-sheet')).toBeTruthy();
        });

        it('maps a backend 400 "must be different" error', async () => {
            mockedApi.updatePassword.mockRejectedValue(new ApiError('new password must be different from current password', 400, {}));
            const utils = await open();
            fill(utils, 'OldPassw0rd', 'NewPassw0rd', 'NewPassw0rd');

            expect(await utils.findByText('Le nouveau mot de passe doit être différent de l’actuel.')).toBeTruthy();
        });

        it('submits only once when save is tapped repeatedly', async () => {
            let resolve!: (value: unknown) => void;
            mockedApi.updatePassword.mockReturnValue(new Promise((r) => (resolve = r)));
            const utils = await open();
            fill(utils, 'OldPassw0rd', 'NewPassw0rd', 'NewPassw0rd');
            await waitFor(() => expect(mockedApi.updatePassword).toHaveBeenCalledTimes(1));

            fireEvent.press(utils.getByTestId('password-save'));
            fireEvent.press(utils.getByTestId('password-save'));

            expect(mockedApi.updatePassword).toHaveBeenCalledTimes(1);
            resolve({ message: 'ok', passwordUpdatedAt: '2026-10-14T08:00:00Z' });
        });

        it('never logs passwords', async () => {
            const spies = [jest.spyOn(console, 'log'), jest.spyOn(console, 'info'), jest.spyOn(console, 'debug')];
            const utils = await open();
            fill(utils, 'OldPassw0rd', 'NewPassw0rd', 'NewPassw0rd');
            await waitFor(() => expect(mockedApi.updatePassword).toHaveBeenCalled());

            for (const spy of spies) {
                expect(JSON.stringify(spy.mock.calls)).not.toMatch(/Passw0rd/);
            }
            spies.forEach((spy) => spy.mockRestore());
        });
    });

    describe('account deletion', () => {
        it('requires an explicit confirmation: opening the sheet deletes nothing', async () => {
            const { getByTestId, getByText } = await renderLoaded();

            fireEvent.press(getByTestId('settings-delete-account'));

            expect(getByTestId('delete-account-sheet')).toBeTruthy();
            expect(getByText('Supprimer ton compte ?')).toBeTruthy();
            expect(mockedApi.deleteCurrentUser).not.toHaveBeenCalled();
            expect(mockedAuth.logout).not.toHaveBeenCalled();
        });

        it('does nothing when the user cancels', async () => {
            const { getByTestId, getByText, queryByTestId } = await renderLoaded();

            fireEvent.press(getByTestId('settings-delete-account'));
            fireEvent.press(getByText('Annuler'));

            await waitFor(() => expect(queryByTestId('delete-account-sheet')).toBeNull());
            expect(mockedApi.deleteCurrentUser).not.toHaveBeenCalled();
            expect(router.replace).not.toHaveBeenCalled();
        });

        it('deletes the account, signs out and goes to the login screen once confirmed', async () => {
            const { getByTestId } = await renderLoaded();

            fireEvent.press(getByTestId('settings-delete-account'));
            fireEvent.press(getByTestId('delete-account-confirm'));

            await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
            expect(mockedApi.deleteCurrentUser).toHaveBeenCalledTimes(1);
            expect(mockedAuth.logout).toHaveBeenCalledTimes(1);
        });

        it('stays signed in and shows an error when the deletion fails', async () => {
            mockedApi.deleteCurrentUser.mockRejectedValue(new ApiError('failed to delete user', 500, {}));
            const { getByTestId, findByText } = await renderLoaded();

            fireEvent.press(getByTestId('settings-delete-account'));
            fireEvent.press(getByTestId('delete-account-confirm'));

            expect(await findByText('Impossible de supprimer le compte.')).toBeTruthy();
            expect(mockedAuth.logout).not.toHaveBeenCalled();
            expect(router.replace).not.toHaveBeenCalled();
        });

        it('ignores repeated confirmations', async () => {
            let resolve!: (value?: unknown) => void;
            mockedApi.deleteCurrentUser.mockReturnValue(new Promise((r) => (resolve = r)));
            const { getByTestId } = await renderLoaded();

            fireEvent.press(getByTestId('settings-delete-account'));
            fireEvent.press(getByTestId('delete-account-confirm'));
            fireEvent.press(getByTestId('delete-account-confirm'));
            fireEvent.press(getByTestId('delete-account-confirm'));

            expect(mockedApi.deleteCurrentUser).toHaveBeenCalledTimes(1);
            resolve();
            await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
        });
    });

    it('signs out and goes to the login screen', async () => {
        const { getByTestId } = await renderLoaded();

        fireEvent.press(getByTestId('settings-signout'));

        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
        expect(mockedAuth.logout).toHaveBeenCalledTimes(1);
    });
});
