import React from 'react';

import FollowButton from '../FollowButton';
import { ApiError } from '@/services/http';
import { followUser, isFollowingUser, unfollowUser } from '@/services/social';
import toast from '@/utils/toast';
import { fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';

jest.mock('@/services/social', () => ({
    __esModule: true,
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    isFollowingUser: jest.fn(),
}));
jest.mock('@/services/storage', () => {
    const storage = { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) };
    return { __esModule: true, default: storage, storage };
});
jest.mock('@/utils/toast', () => ({
    __esModule: true,
    default: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

const mockedFollow = followUser as jest.Mock;
const mockedUnfollow = unfollowUser as jest.Mock;
const mockedIsFollowing = isFollowingUser as jest.Mock;

const ready = async (props: Partial<React.ComponentProps<typeof FollowButton>> = {}) => {
    const onChange = jest.fn();
    const utils = renderWithProviders(<FollowButton userId="u1" currentUserId="me" name="Julie" onChange={onChange} {...props} />);
    await waitFor(() => expect(utils.getByTestId('follow-button').props.accessibilityState.busy).toBe(false));
    return { ...utils, onChange };
};

describe('FollowButton', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedIsFollowing.mockResolvedValue({ is_following: false });
        mockedFollow.mockResolvedValue({ message: 'ok' });
        mockedUnfollow.mockResolvedValue({ message: 'ok' });
    });

    it('renders nothing on one\'s own profile and never calls the API', async () => {
        const { queryByTestId } = renderWithProviders(<FollowButton userId="me" currentUserId="me" />);
        expect(queryByTestId('follow-button')).toBeNull();
        expect(mockedIsFollowing).not.toHaveBeenCalled();
        expect(mockedFollow).not.toHaveBeenCalled();
    });

    it('loads the initial state and exposes a descriptive label', async () => {
        mockedIsFollowing.mockResolvedValue({ is_following: true });
        const { getByTestId, getByText } = renderWithProviders(<FollowButton userId="u1" currentUserId="me" name="Julie" />);

        await waitFor(() => expect(getByTestId('follow-button').props.accessibilityLabel).toBe('Ne plus suivre Julie'));
        expect(getByText('Abonné')).toBeTruthy();
        expect(mockedIsFollowing).toHaveBeenCalledWith('u1');
    });

    it('is disabled while the initial state is loading', async () => {
        mockedIsFollowing.mockReturnValue(new Promise(() => {}));
        const { getByTestId } = renderWithProviders(<FollowButton userId="u1" currentUserId="me" />);

        fireEvent.press(getByTestId('follow-button'));

        expect(getByTestId('follow-button').props.accessibilityState.busy).toBe(true);
        expect(mockedFollow).not.toHaveBeenCalled();
    });

    it('calls onChange optimistically, then again with the previous value on failure', async () => {
        mockedFollow.mockRejectedValue(new ApiError('failed to save', 500, {}));
        const { getByTestId, getByText, onChange } = await ready();

        fireEvent.press(getByTestId('follow-button'));

        expect(onChange).toHaveBeenNthCalledWith(1, true);
        await waitFor(() => expect(onChange).toHaveBeenNthCalledWith(2, false));
        expect(getByText('Suivre')).toBeTruthy();
        expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it('unfollows, and rolls back to "following" when that fails', async () => {
        mockedIsFollowing.mockResolvedValue({ is_following: true });
        mockedUnfollow.mockRejectedValue(new Error('network'));
        const onChange = jest.fn();
        const { getByTestId, getByText } = renderWithProviders(<FollowButton userId="u1" currentUserId="me" onChange={onChange} />);
        await waitFor(() => expect(getByText('Abonné')).toBeTruthy());

        fireEvent.press(getByTestId('follow-button'));

        expect(onChange).toHaveBeenNthCalledWith(1, false);
        await waitFor(() => expect(onChange).toHaveBeenNthCalledWith(2, true));
        expect(getByText('Abonné')).toBeTruthy();
    });

    it('locks against double taps until the request settles, then allows the next toggle', async () => {
        let resolve!: (value: unknown) => void;
        mockedFollow.mockReturnValue(new Promise((r) => (resolve = r)));
        const { getByTestId } = await ready();

        fireEvent.press(getByTestId('follow-button'));
        fireEvent.press(getByTestId('follow-button'));
        expect(mockedFollow).toHaveBeenCalledTimes(1);
        expect(mockedUnfollow).not.toHaveBeenCalled();

        resolve({ message: 'ok' });
        await waitFor(() => expect(getByTestId('follow-button').props.accessibilityLabel).toMatch(/Ne plus suivre/));
        fireEvent.press(getByTestId('follow-button'));
        await waitFor(() => expect(mockedUnfollow).toHaveBeenCalledTimes(1));
    });

    it('does not update state after unmount', async () => {
        let resolve!: (value: unknown) => void;
        mockedFollow.mockReturnValue(new Promise((r) => (resolve = r)));
        const { getByTestId, unmount } = await ready();
        fireEvent.press(getByTestId('follow-button'));
        unmount();

        resolve({ message: 'ok' });
        await Promise.resolve();

        expect(toast.error).not.toHaveBeenCalled();
    });
});
