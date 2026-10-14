import { act, fireEvent, renderWithProviders, waitFor } from '@/test-utils/render';
import { useRouter } from 'expo-router';
import React from 'react';

import StudioScreen from '../(tabs)/studio';
import { getMyScheduledLive } from '@/services/social';

jest.mock('@/services/social', () => ({
    getMyScheduledLive: jest.fn(),
}));

const mockedScheduled = getMyScheduledLive as jest.Mock;
const router = (useRouter as unknown as () => { push: jest.Mock })();

async function renderStudio() {
    const view = renderWithProviders(<StudioScreen />);
    await act(async () => {
        await Promise.resolve();
    });
    return view;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockedScheduled.mockResolvedValue(null);
});

describe('StudioScreen - go live form', () => {
    it('renders the real form (no mock pills) and no scheduled card by default', async () => {
        const { getByText, getByTestId, queryByTestId, queryByText } = await renderStudio();
        expect(getByText('Prêt à cuisiner en direct ?')).toBeTruthy();
        expect(getByTestId('studio-title')).toBeTruthy();
        expect(getByTestId('go-live')).toBeTruthy();
        expect(queryByTestId('scheduled-live')).toBeNull();
        // the old fake wizard pills are gone
        expect(queryByText('Slow mode')).toBeNull();
    });

    it('requires a title', async () => {
        const { getByTestId, getByText } = await renderStudio();
        fireEvent.press(getByTestId('go-live'));
        expect(getByText('Le titre du live est obligatoire.')).toBeTruthy();
        expect(router.push).not.toHaveBeenCalled();
    });

    it('requires at least 3 characters after trimming', async () => {
        const { getByTestId, getByText } = await renderStudio();
        fireEvent.changeText(getByTestId('studio-title'), '  ab  ');
        fireEvent.press(getByTestId('go-live'));
        expect(getByText('Le titre doit contenir au moins 3 caractères.')).toBeTruthy();
        expect(router.push).not.toHaveBeenCalled();
    });

    it('a whitespace-only title is "required", not "too short"', async () => {
        const { getByTestId, getByText } = await renderStudio();
        fireEvent.changeText(getByTestId('studio-title'), '      ');
        fireEvent.press(getByTestId('go-live'));
        expect(getByText('Le titre du live est obligatoire.')).toBeTruthy();
    });

    it('caps the title at 80 characters', async () => {
        const { getByTestId } = await renderStudio();
        expect(getByTestId('studio-title').props.maxLength).toBe(80);
    });

    it('navigates to the broadcast screen with the trimmed title as host', async () => {
        const { getByTestId } = await renderStudio();
        fireEvent.changeText(getByTestId('studio-title'), '  Pasta   maison  ');
        fireEvent.press(getByTestId('go-live'));

        expect(router.push).toHaveBeenCalledTimes(1);
        expect(router.push).toHaveBeenCalledWith({
            pathname: '/live-streaming',
            params: { mode: 'host', title: 'Pasta maison' },
        });
    });

    it('passes the selected tags and the description', async () => {
        const { getByTestId } = await renderStudio();
        fireEvent.changeText(getByTestId('studio-title'), 'Pasta maison');
        fireEvent.changeText(getByTestId('studio-description'), '  Tagliatelles fraîches  ');
        fireEvent.press(getByTestId('tag-Italien'));
        fireEvent.press(getByTestId('tag-Pâtisserie'));
        fireEvent.press(getByTestId('go-live'));

        expect(router.push).toHaveBeenCalledWith({
            pathname: '/live-streaming',
            params: { mode: 'host', title: 'Pasta maison', description: 'Tagliatelles fraîches', tags: 'Italien,Pâtisserie' },
        });
    });

    it('toggles tags and limits the selection to 5', async () => {
        const { getByTestId, getByText, queryByText } = await renderStudio();
        const tags = ['Italien', 'Français', 'Vegan', 'BBQ', 'Snack'];
        tags.forEach((tag) => fireEvent.press(getByTestId(`tag-${tag}`)));
        expect(getByTestId('tags-count').props.children).toBe('5/5 tags');

        fireEvent.press(getByTestId('tag-Boisson'));
        expect(getByText('Tu peux choisir 5 tags au maximum.')).toBeTruthy();
        expect(getByTestId('tags-count').props.children).toBe('5/5 tags');

        fireEvent.press(getByTestId('tag-Snack'));
        expect(queryByText('Tu peux choisir 5 tags au maximum.')).toBeNull();
        expect(getByTestId('tags-count').props.children).toBe('4/5 tags');
    });

    it('ignores a double tap on the go-live button', async () => {
        const { getByTestId } = await renderStudio();
        fireEvent.changeText(getByTestId('studio-title'), 'Pasta maison');
        fireEvent.press(getByTestId('go-live'));
        fireEvent.press(getByTestId('go-live'));
        expect(router.push).toHaveBeenCalledTimes(1);
    });
});

describe('StudioScreen - scheduled live', () => {
    const scheduled = { room_id: 'room-sched', title: 'Brunch du dimanche', scheduled_at: '2030-05-12T09:30:00Z' };

    it('shows the scheduled live, blocks a second live and starts the existing room', async () => {
        mockedScheduled.mockResolvedValue(scheduled);
        const { getByTestId, getByText } = await renderStudio();

        await waitFor(() => expect(getByTestId('scheduled-live')).toBeTruthy());
        expect(getByText('Brunch du dimanche')).toBeTruthy();
        expect(getByText(/Planifié pour le/)).toBeTruthy();
        expect(getByText('Vous avez déjà un live actif')).toBeTruthy();

        // creating another live would be rejected by the backend (409): the button is inert
        fireEvent.changeText(getByTestId('studio-title'), 'Autre live');
        fireEvent.press(getByTestId('go-live'));
        expect(router.push).not.toHaveBeenCalled();

        fireEvent.press(getByTestId('start-scheduled'));
        expect(router.push).toHaveBeenCalledWith({
            pathname: '/live-streaming',
            params: { mode: 'host', roomId: 'room-sched' },
        });
    });

    it('copes with a scheduled live that has no date', async () => {
        mockedScheduled.mockResolvedValue({ room_id: 'r', title: 'Sans date', scheduled_at: null });
        const { getByText } = await renderStudio();
        await waitFor(() => expect(getByText('Date non précisée')).toBeTruthy());
    });

    it('keeps the form usable when the scheduled live cannot be loaded', async () => {
        mockedScheduled.mockRejectedValue(new Error('network'));
        const { getByTestId, queryByTestId } = await renderStudio();
        expect(queryByTestId('scheduled-live')).toBeNull();

        fireEvent.changeText(getByTestId('studio-title'), 'Pasta maison');
        fireEvent.press(getByTestId('go-live'));
        expect(router.push).toHaveBeenCalledTimes(1);
    });
});
