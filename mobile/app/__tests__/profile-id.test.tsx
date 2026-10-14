import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import PublicProfileScreen from '../profile/[id]';
import authService from '@/services/auth';
import { ApiError } from '@/services/http';
import { followUser, getUserById, getUserFollowers, getUserFollowing, isFollowingUser, unfollowUser } from '@/services/social';
import toast from '@/utils/toast';
import { fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';

jest.mock('@/services/auth', () => ({
    __esModule: true,
    default: { getUser: jest.fn(), getToken: jest.fn(), logout: jest.fn() },
}));
jest.mock('@/services/social', () => ({
    __esModule: true,
    getUserById: jest.fn(),
    getUserFollowers: jest.fn(),
    getUserFollowing: jest.fn(),
    isFollowingUser: jest.fn(),
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    userImage: (u: any) => u?.profileImageUrl || u?.profile_image_url,
}));
jest.mock('@/services/storage', () => {
    const storage = { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) };
    return { __esModule: true, default: storage, storage };
});
jest.mock('@/utils/toast', () => ({
    __esModule: true,
    default: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

const { __mockRouter: router } = jest.requireMock('expo-router');
const mockedParams = useLocalSearchParams as jest.Mock;
const mockedAuth = authService as unknown as { getUser: jest.Mock };
const m = {
    getUserById: getUserById as jest.Mock,
    followers: getUserFollowers as jest.Mock,
    following: getUserFollowing as jest.Mock,
    isFollowing: isFollowingUser as jest.Mock,
    follow: followUser as jest.Mock,
    unfollow: unfollowUser as jest.Mock,
};

const chef = {
    id: 'chef1',
    email: 'chef@foodstream.com',
    username: 'gordon',
    firstName: 'Gordon',
    lastName: 'Ramsay',
    description: 'Chef étoilé',
    profileImageUrl: '',
    followersIds: ['x'],
    followingIds: [],
};

function deferred<T = unknown>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const followersLabel = (n: number) => `Afficher les ${n} follower${n > 1 ? 's' : ''}`;

describe('PublicProfileScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedParams.mockReturnValue({ id: 'chef1' });
        mockedAuth.getUser.mockResolvedValue({ id: 'me', email: 'me@foodstream.com' });
        m.getUserById.mockResolvedValue(chef);
        m.followers.mockResolvedValue({ count: 12, followers: [] });
        m.following.mockResolvedValue({ count: 3, following: [] });
        m.isFollowing.mockResolvedValue({ is_following: false });
        m.follow.mockResolvedValue({ message: 'ok' });
        m.unfollow.mockResolvedValue({ message: 'ok' });
    });

    it('renders the user with the counts of the follower / following lists', async () => {
        const { findByText, getByText, getByTestId, queryByText } = renderWithProviders(<PublicProfileScreen />);

        expect(await findByText('Gordon Ramsay')).toBeTruthy();
        expect(getByText('@gordon')).toBeTruthy();
        expect(getByText('Chef étoilé')).toBeTruthy();
        expect(getByTestId('follow-stats-followers').props.accessibilityLabel).toBe(followersLabel(12));
        expect(m.getUserById).toHaveBeenCalledWith('chef1');
        expect(getByTestId('public-profile-no-lives')).toBeTruthy();
        // the e-mail of someone else is never displayed
        expect(queryByText('chef@foodstream.com')).toBeNull();
    });

    it('falls back to the ids of the user when the lists cannot be loaded', async () => {
        m.followers.mockRejectedValue(new Error('x'));
        m.following.mockRejectedValue(new Error('x'));
        const { findByText, getByTestId } = renderWithProviders(<PublicProfileScreen />);

        await findByText('Gordon Ramsay');
        expect(getByTestId('follow-stats-followers').props.accessibilityLabel).toBe(followersLabel(1));
    });

    describe('invalid / own / missing profile', () => {
        it.each([[undefined], [''], ['   '], [['']]])('does not call the API for an invalid id (%p)', async (id) => {
            mockedParams.mockReturnValue({ id });
            const { findByTestId } = renderWithProviders(<PublicProfileScreen />);

            expect(await findByTestId('public-profile-not-found')).toBeTruthy();
            expect(m.getUserById).not.toHaveBeenCalled();
        });

        it('accepts an array param (first value)', async () => {
            mockedParams.mockReturnValue({ id: ['chef1', 'other'] });
            const { findByText } = renderWithProviders(<PublicProfileScreen />);
            await findByText('Gordon Ramsay');
            expect(m.getUserById).toHaveBeenCalledWith('chef1');
        });

        it('redirects to the own profile tab when the id is mine, without loading anything', async () => {
            mockedParams.mockReturnValue({ id: 'me' });
            renderWithProviders(<PublicProfileScreen />);

            await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/profil'));
            expect(m.getUserById).not.toHaveBeenCalled();
            expect(m.follow).not.toHaveBeenCalled();
        });

        it('shows "not found" on a 404', async () => {
            m.getUserById.mockRejectedValue(new ApiError('user not found', 404, {}));
            const { findByTestId } = renderWithProviders(<PublicProfileScreen />);
            expect(await findByTestId('public-profile-not-found')).toBeTruthy();
        });

        it('shows an error with retry on a network failure', async () => {
            m.getUserById.mockRejectedValueOnce(new Error('Erreur réseau'));
            const { findByTestId, getByText, findByText } = renderWithProviders(<PublicProfileScreen />);

            expect(await findByTestId('public-profile-error')).toBeTruthy();
            fireEvent.press(getByText('Réessayer'));

            expect(await findByText('Gordon Ramsay')).toBeTruthy();
            expect(m.getUserById).toHaveBeenCalledTimes(2);
        });
    });

    describe('follow button', () => {
        const renderReady = async () => {
            const utils = renderWithProviders(<PublicProfileScreen />);
            await utils.findByText('Gordon Ramsay');
            await waitFor(() => expect(utils.getByTestId('follow-button').props.accessibilityState.busy).toBe(false));
            return utils;
        };

        it('follows optimistically and increments the follower counter', async () => {
            const pending = deferred();
            m.follow.mockReturnValue(pending.promise);
            const { getByTestId, getByText } = await renderReady();

            fireEvent.press(getByTestId('follow-button'));

            // optimistic: already "Abonné" and 13 followers while the request is pending
            expect(getByText('Abonné')).toBeTruthy();
            expect(getByTestId('follow-stats-followers').props.accessibilityLabel).toBe(followersLabel(13));

            pending.resolve({ message: 'ok' });
            await waitFor(() => expect(m.follow).toHaveBeenCalledWith('chef1'));
            expect(getByText('Abonné')).toBeTruthy();
            expect(toast.error).not.toHaveBeenCalled();
        });

        it('rolls back the label and the counter when following fails', async () => {
            m.follow.mockRejectedValue(new ApiError('failed to save', 500, {}));
            const { getByTestId, getByText, findByText } = await renderReady();

            fireEvent.press(getByTestId('follow-button'));

            expect(await findByText('Suivre')).toBeTruthy();
            expect(getByText('Suivre')).toBeTruthy();
            expect(getByTestId('follow-stats-followers').props.accessibilityLabel).toBe(followersLabel(12));
            expect(toast.error).toHaveBeenCalledWith(expect.any(String), { force: true });
        });

        it('unfollows an already followed user and decrements the counter', async () => {
            m.isFollowing.mockResolvedValue({ is_following: true });
            const { getByTestId, findByText } = renderWithProviders(<PublicProfileScreen />);
            await findByText('Gordon Ramsay');
            await waitFor(() => expect(getByTestId('follow-button').props.accessibilityLabel).toBe('Ne plus suivre Gordon Ramsay'));

            fireEvent.press(getByTestId('follow-button'));

            await waitFor(() => expect(m.unfollow).toHaveBeenCalledWith('chef1'));
            expect(getByTestId('follow-stats-followers').props.accessibilityLabel).toBe(followersLabel(11));
            expect(m.follow).not.toHaveBeenCalled();
        });

        it('prevents double taps while a request is in flight', async () => {
            const pending = deferred();
            m.follow.mockReturnValue(pending.promise);
            const { getByTestId } = await renderReady();

            fireEvent.press(getByTestId('follow-button'));
            fireEvent.press(getByTestId('follow-button'));
            fireEvent.press(getByTestId('follow-button'));

            expect(m.follow).toHaveBeenCalledTimes(1);
            expect(m.unfollow).not.toHaveBeenCalled();
            expect(getByTestId('follow-stats-followers').props.accessibilityLabel).toBe(followersLabel(13));
            pending.resolve({});
        });

        it('treats "already following" (403) as success and keeps the true counter', async () => {
            m.follow.mockRejectedValue(new ApiError('you are already following this user', 403, {}));
            const { getByTestId, getByText } = await renderReady();

            fireEvent.press(getByTestId('follow-button'));

            await waitFor(() => expect(m.follow).toHaveBeenCalled());
            await waitFor(() => expect(getByTestId('follow-stats-followers').props.accessibilityLabel).toBe(followersLabel(12)));
            expect(getByText('Abonné')).toBeTruthy();
            expect(toast.error).not.toHaveBeenCalled();
        });
    });

    describe('follower list', () => {
        it('opens the list and navigates to another profile (never to itself)', async () => {
            m.followers.mockResolvedValue({
                count: 2,
                followers: [
                    { id: 'u9', username: 'julie', firstName: 'Julie', lastName: 'Martin' },
                    { id: 'me', username: 'moi' },
                ],
            });
            const { findByText, getByTestId } = renderWithProviders(<PublicProfileScreen />);
            await findByText('Gordon Ramsay');

            fireEvent.press(getByTestId('follow-stats-followers'));
            fireEvent.press(await findByText('Julie Martin'));

            expect(router.push).toHaveBeenCalledWith({ pathname: '/profile/[id]', params: { id: 'u9' } });

            fireEvent.press(getByTestId('follow-stats-followers'));
            fireEvent.press(await findByText('moi'));
            expect(router.push).toHaveBeenLastCalledWith('/(tabs)/profil');
        });

        it('shows an error with retry when the list cannot be loaded', async () => {
            const { findByText, getByTestId, findByTestId, getByText } = renderWithProviders(<PublicProfileScreen />);
            await findByText('Gordon Ramsay');
            m.followers.mockRejectedValueOnce(new Error('nope'));

            fireEvent.press(getByTestId('follow-stats-followers'));
            expect(await findByTestId('follow-list-error')).toBeTruthy();

            m.followers.mockResolvedValueOnce({ count: 1, followers: [{ id: 'u1', username: 'zoe' }] });
            fireEvent.press(getByText('Réessayer'));
            expect(await findByText('zoe')).toBeTruthy();
        });

        it('shows the empty state for an empty list', async () => {
            const { findByText, getByTestId, findByTestId } = renderWithProviders(<PublicProfileScreen />);
            await findByText('Gordon Ramsay');

            fireEvent.press(getByTestId('follow-stats-following'));
            expect(await findByTestId('follow-list-empty')).toBeTruthy();
        });
    });

    it('goes back with the back button', async () => {
        const { getByTestId } = renderWithProviders(<PublicProfileScreen />);
        fireEvent.press(getByTestId('public-profile-back'));
        expect(router.back).toHaveBeenCalled();
    });
});
