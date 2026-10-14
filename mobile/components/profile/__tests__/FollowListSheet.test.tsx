import React from 'react';

import FollowListSheet from '../FollowListSheet';
import FollowStats from '../FollowStats';
import { fireEvent, renderWithProviders } from '@/test-utils/render';

jest.mock('@/services/storage', () => {
    const storage = { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) };
    return { __esModule: true, default: storage, storage };
});

const users = [
    { id: 'u1', username: 'julie', firstName: 'Julie', lastName: 'Martin', profileImageUrl: 'https://img.test/j.png' },
    { id: 'u2', username: 'marc' },
];

describe('FollowListSheet', () => {
    const base = { visible: true, title: 'Followers', users, onClose: jest.fn() };

    beforeEach(() => jest.clearAllMocks());

    it('lists the users and reports the selected one', () => {
        const onSelectUser = jest.fn();
        const { getByText, getByLabelText } = renderWithProviders(<FollowListSheet {...base} onSelectUser={onSelectUser} />);

        expect(getByText('Followers')).toBeTruthy();
        expect(getByText('Julie Martin')).toBeTruthy();
        expect(getByText('marc')).toBeTruthy();

        fireEvent.press(getByLabelText('Ouvrir le profil de Julie Martin'));
        expect(onSelectUser).toHaveBeenCalledWith(users[0]);
    });

    it('shows a loading state, hiding the previous rows', () => {
        const { getByText, queryByText } = renderWithProviders(<FollowListSheet {...base} loading />);
        expect(getByText('Chargement…')).toBeTruthy();
        expect(queryByText('Julie Martin')).toBeNull();
    });

    it('shows an error state with a retry action', () => {
        const onRetry = jest.fn();
        const { getByTestId, getByText } = renderWithProviders(<FollowListSheet {...base} users={[]} error onRetry={onRetry} />);

        expect(getByTestId('follow-list-error')).toBeTruthy();
        fireEvent.press(getByText('Réessayer'));
        expect(onRetry).toHaveBeenCalled();
    });

    it('shows an empty state', () => {
        const { getByText } = renderWithProviders(<FollowListSheet {...base} users={[]} />);
        expect(getByText('Aucun utilisateur pour le moment.')).toBeTruthy();
    });

    it('closes from the close button and renders nothing when hidden', () => {
        const { getByLabelText, rerender, queryByText } = renderWithProviders(<FollowListSheet {...base} />);
        fireEvent.press(getByLabelText('Fermer la fenêtre'));
        expect(base.onClose).toHaveBeenCalled();

        rerender(<FollowListSheet {...base} visible={false} />);
        expect(queryByText('Followers')).toBeNull();
    });
});

describe('FollowStats', () => {
    it('shows both counters with plural-aware accessibility labels and opens the right list', () => {
        const onOpenFollowers = jest.fn();
        const onOpenFollowing = jest.fn();
        const { getByTestId, getByText } = renderWithProviders(
            <FollowStats followersCount={5} followingCount={1} onOpenFollowers={onOpenFollowers} onOpenFollowing={onOpenFollowing} />
        );

        expect(getByText('5')).toBeTruthy();
        expect(getByTestId('follow-stats-followers').props.accessibilityLabel).toBe('Afficher les 5 followers');
        expect(getByTestId('follow-stats-following').props.accessibilityLabel).toBe('Afficher les 1 profil suivi');

        fireEvent.press(getByTestId('follow-stats-followers'));
        fireEvent.press(getByTestId('follow-stats-following'));
        expect(onOpenFollowers).toHaveBeenCalledTimes(1);
        expect(onOpenFollowing).toHaveBeenCalledTimes(1);
    });
});
