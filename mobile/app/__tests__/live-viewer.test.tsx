import { Linking, Share } from 'react-native';
import React from 'react';

import LiveViewerScreen from '../live-viewer';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '@/test-utils/render';
import authService from '@/services/auth';
import { ApiError } from '@/services/http';
import { getLiveByRoomId, LiveDTO } from '@/services/lives';
import {
    cancelReserveRoom,
    getChatMessages,
    getRoom,
    postChatMessage,
    reserveRoom,
    RoomInfo,
} from '@/services/streaming';
import { showToast } from '@/utils/toast';

const mockRouter = (jest.requireMock('expo-router') as any).__mockRouter;
const mockUseLocalSearchParams = (jest.requireMock('expo-router') as any).useLocalSearchParams as jest.Mock;

jest.mock('@/services/auth', () => ({
    __esModule: true,
    default: { getToken: jest.fn(), getUser: jest.fn() },
}));

jest.mock('@/services/lives', () => ({
    ...jest.requireActual('@/services/lives'),
    getLiveByRoomId: jest.fn(),
}));

jest.mock('@/services/streaming', () => ({
    MAX_CHAT_MESSAGE_LENGTH: 500,
    getHLSUrl: jest.fn((roomId: string) => `https://api.test/hls/${encodeURIComponent(roomId)}/master.m3u8`),
    getRoom: jest.fn(),
    reserveRoom: jest.fn(),
    cancelReserveRoom: jest.fn(),
    getChatMessages: jest.fn(),
    postChatMessage: jest.fn(),
}));

jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }));

jest.mock('@/components/HLSPlayer', () => {
    const { Text } = require('react-native');
    const ReactLib = require('react');
    return {
        __esModule: true,
        default: ({ uri, mode }: { uri: string; mode?: string }) =>
            ReactLib.createElement(Text, { testID: 'hls-player' }, `${mode}|${uri}`),
    };
});

const mockedAuth = authService as jest.Mocked<typeof authService>;
const mockedGetLive = getLiveByRoomId as jest.Mock;
const mockedGetRoom = getRoom as jest.Mock;
const mockedReserve = reserveRoom as jest.Mock;
const mockedCancel = cancelReserveRoom as jest.Mock;
const mockedGetChat = getChatMessages as jest.Mock;
const mockedPostChat = postChatMessage as jest.Mock;

const SCHEDULED_AT = '2030-05-01T18:00:00.000Z';

const makeLive = (overrides: Partial<LiveDTO> = {}): LiveDTO => ({
    id: 1,
    room_id: 'room-1',
    title: 'Tarte aux pommes',
    description: 'Une tarte maison',
    status: 'live',
    created_at: '2030-04-01T10:00:00.000Z',
    current_viewers: 3,
    view_count: 10,
    tags: [{ id: 1, name: 'Dessert', slug: 'dessert' }],
    user: { id: 'host-1', username: 'Chef Paul' },
    ...overrides,
});

const makeRoom = (overrides: Partial<RoomInfo> = {}): RoomInfo => ({
    id: 'room-1',
    name: 'Salle Tarte',
    host: 'host-1',
    participants: ['host-1'],
    viewers: 7,
    maxParticipants: 6,
    ...overrides,
});

const viewerUser = { id: 'user-1', email: 'u@test.fr', username: 'alice' };

function signIn(user: typeof viewerUser | { id: string; email: string; username: string } | null) {
    mockedAuth.getToken.mockResolvedValue(user ? 'token' : null);
    mockedAuth.getUser.mockResolvedValue(user);
}

async function renderViewer(params: Record<string, unknown> = { roomId: 'room-1' }) {
    mockUseLocalSearchParams.mockReturnValue(params);
    const utils = renderWithProviders(<LiveViewerScreen />);
    await act(async () => {});
    return utils;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockedGetLive.mockResolvedValue(makeLive());
    mockedGetRoom.mockResolvedValue(makeRoom());
    mockedGetChat.mockResolvedValue([]);
    mockedPostChat.mockResolvedValue(undefined);
    mockedReserve.mockResolvedValue({ message: 'ok', reserved: true, registeredCount: 1, maxParticipants: 5 });
    mockedCancel.mockResolvedValue({ message: 'ok', reserved: false, registeredCount: 0, maxParticipants: 5 });
    mockRouter.canGoBack.mockReturnValue(true);
    signIn(viewerUser);
});

const RECIPE_MARKER = '---FOODSTREAM_RECIPE---';
const recipeDescription = (extra: object = {}) =>
    `Une tarte maison\n\n${RECIPE_MARKER}\n${JSON.stringify({
        ingredients: [{ name: 'Pommes', qty: '4' }, { name: 'Pâte brisée', qty: '1' }],
        cookingTimer: 1500,
        ...extra,
    })}`;

describe('LiveViewerScreen - params', () => {
    it.each([
        ['missing', {}],
        ['empty', { roomId: '' }],
        ['blank', { roomId: '   ' }],
        ['not a string', { roomId: undefined }],
        ['empty array', { roomId: [] }],
    ])('shows an error and loads nothing when roomId is %s', async (_label, params) => {
        await renderViewer(params);
        expect(screen.getByText('Aucune salle spécifiée')).toBeTruthy();
        expect(mockedGetLive).not.toHaveBeenCalled();
        expect(mockedGetRoom).not.toHaveBeenCalled();
        expect(screen.queryByTestId('hls-player')).toBeNull();
    });

    it('goes back from the invalid state', async () => {
        await renderViewer({});
        fireEvent.press(screen.getByTestId('live-back'));
        expect(mockRouter.back).toHaveBeenCalled();
    });

    it('uses the first value when expo-router gives an array', async () => {
        await renderViewer({ roomId: ['room-9', 'other'] });
        expect(mockedGetLive).toHaveBeenCalledWith('room-9');
    });

    it('goes home when there is no history', async () => {
        mockRouter.canGoBack.mockReturnValue(false);
        await renderViewer();
        fireEvent.press(screen.getByTestId('live-back'));
        expect(mockRouter.back).not.toHaveBeenCalled();
        expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });
});

describe('LiveViewerScreen - loading and errors', () => {
    it('shows the loading state until the first answer', async () => {
        let resolve!: (live: LiveDTO) => void;
        mockedGetLive.mockReturnValue(new Promise<LiveDTO>((r) => (resolve = r)));
        await renderViewer({ roomId: 'room-1', roomName: 'Ma salle' });
        expect(screen.getByLabelText('Chargement…')).toBeTruthy();
        expect(screen.getByText('Ma salle')).toBeTruthy();
        await act(async () => resolve(makeLive()));
        expect(screen.queryByLabelText('Chargement…')).toBeNull();
        expect(screen.getByTestId('hls-player')).toBeTruthy();
    });

    it('shows "not found" without a retry button on 404', async () => {
        mockedGetLive.mockRejectedValue(new ApiError('nope', 404, null));
        mockedGetRoom.mockRejectedValue(new ApiError('nope', 404, null));
        await renderViewer();
        expect(screen.getByText('Live introuvable')).toBeTruthy();
        expect(screen.queryByText('Réessayer')).toBeNull();
    });

    it('offers a retry on network errors and recovers', async () => {
        mockedGetLive.mockRejectedValueOnce(new Error('network'));
        mockedGetRoom.mockResolvedValue(null);
        await renderViewer();
        expect(screen.getByText('Impossible de charger ce live')).toBeTruthy();

        mockedGetLive.mockResolvedValue(makeLive());
        await act(async () => {
            fireEvent.press(screen.getByText('Réessayer'));
        });
        expect(screen.queryByText('Impossible de charger ce live')).toBeNull();
        expect(screen.getByTestId('hls-player')).toBeTruthy();
    });

    it('falls back to the active room when the live record is missing', async () => {
        mockedGetLive.mockRejectedValue(new ApiError('nope', 404, null));
        await renderViewer();
        expect(screen.getByTestId('hls-player')).toBeTruthy();
        expect(screen.getByText('Salle Tarte')).toBeTruthy();
    });

    it('keeps the displayed data when a refresh fails', async () => {
        jest.useFakeTimers();
        try {
            await renderViewer();
            mockedGetLive.mockRejectedValue(new Error('network'));
            await act(async () => {
                jest.advanceTimersByTime(10_000);
            });
            expect(screen.getByTestId('hls-player')).toBeTruthy();
            expect(screen.queryByText('Impossible de charger ce live')).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('LiveViewerScreen - scheduled', () => {
    beforeEach(() => {
        mockedGetLive.mockResolvedValue(makeLive({ status: 'scheduled', scheduled_at: SCHEDULED_AT }));
    });

    it('shows the reservation card and the registered count for a viewer', async () => {
        mockedGetRoom.mockResolvedValue(makeRoom({ participants: ['host-1', 'u2', 'u3'] }));
        await renderViewer();
        expect(screen.getByText('Live planifié')).toBeTruthy();
        expect(screen.getByText('2 / 5 inscrits')).toBeTruthy();
        expect(screen.getByText("S'inscrire à ce live")).toBeTruthy();
        expect(screen.queryByTestId('hls-player')).toBeNull();
        expect(screen.queryByTestId('host-scheduled-card')).toBeNull();
    });

    it('shows the host card with the Studio shortcut for the host', async () => {
        signIn({ id: 'host-1', email: 'h@test.fr', username: 'Chef Paul' });
        await renderViewer();
        expect(screen.getByText('Vous êtes le créateur de ce live !')).toBeTruthy();
        expect(screen.queryByTestId('reservation-card')).toBeNull();
        fireEvent.press(screen.getByTestId('host-open-studio'));
        expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/studio');
    });

    it('reserves a spot then shows the reserved state with a cancel action', async () => {
        await renderViewer();
        mockedGetRoom.mockResolvedValue(makeRoom({ participants: ['host-1', 'user-1'] }));
        await act(async () => {
            fireEvent.press(screen.getByTestId('reservation-reserve'));
        });
        expect(mockedReserve).toHaveBeenCalledWith('room-1');
        expect(screen.getByText('Votre place est réservée ! Un email de confirmation vous a été envoyé.')).toBeTruthy();
        expect(screen.getByText('Inscrit ✓')).toBeTruthy();
        expect(screen.getByTestId('reservation-cancel')).toBeTruthy();
        expect(screen.getByText('1 / 5 inscrits')).toBeTruthy();
    });

    it('shows the API error when the reservation fails and lets the user retry', async () => {
        mockedReserve.mockRejectedValueOnce(new ApiError('Live complet', 409, null));
        await renderViewer();
        await act(async () => {
            fireEvent.press(screen.getByTestId('reservation-reserve'));
        });
        const message = screen.getByTestId('reservation-message');
        expect(message.props.children).toBe('Live complet');
        expect(screen.queryByText('Inscrit ✓')).toBeNull();

        // not stuck in a busy state
        await act(async () => {
            fireEvent.press(screen.getByTestId('reservation-reserve'));
        });
        expect(mockedReserve).toHaveBeenCalledTimes(2);
    });

    it('falls back to a generic message for errors without a message', async () => {
        mockedReserve.mockRejectedValueOnce({});
        await renderViewer();
        await act(async () => {
            fireEvent.press(screen.getByTestId('reservation-reserve'));
        });
        expect(screen.getByText('Erreur de réservation')).toBeTruthy();
    });

    it('ignores a second press while a reservation is in flight', async () => {
        let resolve!: () => void;
        mockedReserve.mockReturnValue(new Promise<void>((r) => (resolve = r)));
        await renderViewer();
        await act(async () => {
            fireEvent.press(screen.getByTestId('reservation-reserve'));
        });
        await act(async () => {
            fireEvent.press(screen.getByTestId('reservation-reserve'));
        });
        expect(mockedReserve).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Inscription en cours…')).toBeTruthy();
        await act(async () => resolve());
    });

    it('cancels a reservation, and reports a cancellation error', async () => {
        mockedGetRoom.mockResolvedValue(makeRoom({ participants: ['host-1', 'user-1'] }));
        await renderViewer();
        expect(screen.getByText('Inscrit ✓')).toBeTruthy();

        mockedCancel.mockRejectedValueOnce(new Error('Impossible'));
        await act(async () => {
            fireEvent.press(screen.getByTestId('reservation-cancel'));
        });
        expect(screen.getByText('Impossible')).toBeTruthy();
        expect(screen.getByText('Inscrit ✓')).toBeTruthy();

        mockedGetRoom.mockResolvedValue(makeRoom({ participants: ['host-1'] }));
        await act(async () => {
            fireEvent.press(screen.getByTestId('reservation-cancel'));
        });
        expect(mockedCancel).toHaveBeenCalledWith('room-1');
        expect(screen.getByText('Votre inscription a bien été annulée.')).toBeTruthy();
        expect(screen.getByTestId('reservation-reserve')).toBeTruthy();
    });

    it('shows "full" and hides the reserve button when 5 spots are taken', async () => {
        mockedGetRoom.mockResolvedValue(makeRoom({ participants: ['host-1', 'a', 'b', 'c', 'd', 'e'] }));
        await renderViewer();
        expect(screen.getAllByText('Complet (5/5)').length).toBeGreaterThan(0);
        expect(screen.queryByTestId('reservation-reserve')).toBeNull();
    });

    it('asks signed-out viewers to sign in and does not call the room endpoint', async () => {
        signIn(null);
        await renderViewer();
        expect(mockedGetRoom).not.toHaveBeenCalled();
        fireEvent.press(screen.getByText('Connectez-vous pour vous inscrire'));
        expect(mockRouter.push).toHaveBeenCalledWith('/login');
        expect(mockedReserve).not.toHaveBeenCalled();
    });

    it('opens the Google Calendar template with the live data', async () => {
        const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        await renderViewer();
        fireEvent.press(screen.getByTestId('reservation-calendar'));
        expect(open).toHaveBeenCalledTimes(1);
        const url = new URL(open.mock.calls[0][0]);
        expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
        expect(url.searchParams.get('text')).toBe('FoodStream : Salle Tarte');
        expect(url.searchParams.get('dates')).toBe('20300501T180000Z/20300501T190000Z');
        expect(url.searchParams.get('location')).toBe('https://foodstream.tv/watch/room-1');
        open.mockRestore();
    });

    it('toasts an error when the calendar cannot be opened', async () => {
        const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
        await renderViewer();
        await act(async () => {
            fireEvent.press(screen.getByTestId('reservation-calendar'));
        });
        expect(showToast).toHaveBeenCalledWith('Impossible d’ouvrir l’agenda.', 'error');
        open.mockRestore();
    });

    it('does not open the calendar when the scheduled date is invalid', async () => {
        mockedGetLive.mockResolvedValue(makeLive({ status: 'scheduled', scheduled_at: 'not-a-date' }));
        const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        await renderViewer();
        fireEvent.press(screen.getByTestId('reservation-calendar'));
        expect(open).not.toHaveBeenCalled();
        expect(showToast).toHaveBeenCalledWith('Impossible d’ouvrir l’agenda.', 'error');
        open.mockRestore();
    });
});

describe('LiveViewerScreen - live', () => {
    it('renders the player with the encoded HLS url, the LIVE badge and the chat', async () => {
        await renderViewer({ roomId: 'room 1/../x' });
        expect(screen.getByTestId('hls-player').props.children).toBe(
            'live|https://api.test/hls/room%201%2F..%2Fx/master.m3u8'
        );
        expect(screen.getByText('EN DIRECT')).toBeTruthy();
        expect(screen.getByTestId('chat-panel')).toBeTruthy();
        expect(screen.getByText('Salle Tarte')).toBeTruthy();
    });

    it('shows info (host, tags, viewers) in the info tab and opens the host profile', async () => {
        await renderViewer();
        fireEvent.press(screen.getByTestId('tab-info'));
        expect(screen.getByText('Dessert')).toBeTruthy();
        expect(screen.getByText('Une tarte maison')).toBeTruthy();
        expect(screen.getByText('7 spectateurs')).toBeTruthy();
        fireEvent.press(screen.getByTestId('live-host'));
        expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/profile/[id]', params: { id: 'host-1' } });
    });

    it('lets a signed-in viewer join as co-streamer', async () => {
        await renderViewer();
        fireEvent.press(screen.getByTestId('live-join'));
        expect(mockRouter.push).toHaveBeenCalledWith({
            pathname: '/live-streaming',
            params: { roomId: 'room-1', mode: 'join' },
        });
    });

    it('asks signed-out viewers to sign in instead of showing nothing', async () => {
        signIn(null);
        await renderViewer();
        expect(screen.queryByTestId('live-join')).toBeNull();
        fireEvent.press(screen.getByTestId('live-signin-to-join'));
        expect(mockRouter.push).toHaveBeenCalledWith('/login');
        expect(mockedGetRoom).not.toHaveBeenCalled();
        expect(screen.getByTestId('hls-player')).toBeTruthy();
    });

    it('shows the Studio shortcut instead of the join button to the host', async () => {
        signIn({ id: 'host-1', email: 'h@test.fr', username: 'Chef Paul' });
        await renderViewer();
        expect(screen.queryByTestId('live-join')).toBeNull();
        // explains why there is no join button (same account on two devices is a common test setup)
        expect(screen.getByTestId('live-host-notice')).toBeTruthy();
        fireEvent.press(screen.getByTestId('live-host-studio'));
        expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/studio');
    });

    it('shows "room full" instead of the join button when there is no spot left', async () => {
        mockedGetRoom.mockResolvedValue(makeRoom({ participants: ['host-1', 'a', 'b', 'c', 'd', 'e'] }));
        await renderViewer();
        expect(screen.queryByTestId('live-join')).toBeNull();
        expect(screen.getByText('Salle complète')).toBeTruthy();
    });

    it('still lets a registered co-streamer join a full room', async () => {
        mockedGetRoom.mockResolvedValue(makeRoom({ participants: ['host-1', 'user-1', 'a', 'b', 'c', 'd'] }));
        await renderViewer();
        expect(screen.getByTestId('live-join')).toBeTruthy();
    });

    it('shares the live with the native share sheet', async () => {
        const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
        await renderViewer();
        await act(async () => {
            fireEvent.press(screen.getByTestId('live-share'));
        });
        expect(share).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(share.mock.calls[0][0])).toContain('https://foodstream.tv/watch/room-1');
        share.mockRestore();
    });

    it('swallows a failing share sheet', async () => {
        const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('cancelled'));
        await renderViewer();
        await act(async () => {
            fireEvent.press(screen.getByTestId('live-share'));
        });
        expect(screen.getByTestId('hls-player')).toBeTruthy();
        share.mockRestore();
    });

    it('moves from the player to the replay state when the live ends while watching', async () => {
        jest.useFakeTimers();
        try {
            await renderViewer();
            expect(screen.getByTestId('hls-player')).toBeTruthy();
            mockedGetLive.mockResolvedValue(makeLive({ status: 'ended' }));
            await act(async () => {
                jest.advanceTimersByTime(10_000);
            });
            expect(screen.queryByTestId('hls-player')).toBeNull();
            expect(screen.getByText('Ce live est actuellement hors ligne ou terminé.')).toBeTruthy();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('LiveViewerScreen - ended', () => {
    it('shows an offline message when there is no replay', async () => {
        mockedGetLive.mockResolvedValue(makeLive({ status: 'ended', has_replay: false }));
        await renderViewer();
        expect(screen.getByText('Ce live est actuellement hors ligne ou terminé.')).toBeTruthy();
        expect(screen.queryByTestId('hls-player')).toBeNull();
        expect(screen.queryByTestId('chat-panel')).toBeNull();
    });

    it('plays an absolute replay url with the replay player', async () => {
        mockedGetLive.mockResolvedValue(
            makeLive({ status: 'ended', has_replay: true, replay_url: 'https://cdn.test/replays/1.m3u8' })
        );
        await renderViewer();
        expect(screen.getByTestId('hls-player').props.children).toBe('replay|https://cdn.test/replays/1.m3u8');
        expect(screen.getByText('REDIFFUSION')).toBeTruthy();
    });

    it('resolves a relative replay url against the API host (without /api)', async () => {
        mockedGetLive.mockResolvedValue(makeLive({ status: 'ended', has_replay: true, replay_url: '/replays/1.mp4' }));
        await renderViewer();
        expect(screen.getByTestId('hls-player').props.children).toBe('replay|http://localhost:8081/replays/1.mp4');
    });

    it('never hands a non-http replay url to the player', async () => {
        mockedGetLive.mockResolvedValue(makeLive({ status: 'ended', has_replay: true, replay_url: 'javascript:alert(1)' }));
        await renderViewer();
        expect(screen.queryByTestId('hls-player')).toBeNull();
        expect(screen.getByTestId('replay-preparing')).toBeTruthy();
    });

    it('says the replay is being prepared when it is flagged but has no url yet', async () => {
        mockedGetLive.mockResolvedValue(makeLive({ status: 'ended', has_replay: true }));
        await renderViewer();
        expect(screen.getByText('Rediffusion en préparation')).toBeTruthy();
    });
});

describe('LiveViewerScreen - polling', () => {
    it('refreshes every 10 s and stops as soon as the screen unmounts', async () => {
        jest.useFakeTimers();
        try {
            const { unmount } = await renderViewer();
            expect(mockedGetLive).toHaveBeenCalledTimes(1);
            await act(async () => {
                jest.advanceTimersByTime(10_000);
            });
            expect(mockedGetLive).toHaveBeenCalledTimes(2);
            await act(async () => {
                jest.advanceTimersByTime(10_000);
            });
            expect(mockedGetLive).toHaveBeenCalledTimes(3);

            const roomCalls = mockedGetRoom.mock.calls.length;
            const chatCalls = mockedGetChat.mock.calls.length;
            unmount();
            await act(async () => {
                jest.advanceTimersByTime(120_000);
            });
            expect(mockedGetLive).toHaveBeenCalledTimes(3);
            expect(mockedGetRoom).toHaveBeenCalledTimes(roomCalls);
            expect(mockedGetChat).toHaveBeenCalledTimes(chatCalls);
        } finally {
            jest.useRealTimers();
        }
    });

    it('ignores a late answer that arrives after unmount', async () => {
        let resolve!: (live: LiveDTO) => void;
        mockedGetLive.mockReturnValue(new Promise<LiveDTO>((r) => (resolve = r)));
        const { unmount } = await renderViewer();
        unmount();
        await act(async () => resolve(makeLive()));
        expect(mockedGetLive).toHaveBeenCalledTimes(1);
        expect(mockedGetRoom).toHaveBeenCalledTimes(1);
    });
});

describe('LiveViewerScreen - chat', () => {
    it('sends a message optimistically and refreshes the chat', async () => {
        await renderViewer();
        const input = screen.getByTestId('chat-input');
        fireEvent.changeText(input, '  Bonjour chef  ');

        mockedGetChat.mockResolvedValue([{ id: 'm1', username: 'alice', message: 'Bonjour chef' }]);
        await act(async () => {
            fireEvent.press(screen.getByTestId('chat-send'));
        });
        expect(mockedPostChat).toHaveBeenCalledWith('room-1', 'Bonjour chef');
        expect(screen.getAllByText(/Bonjour chef/)).toHaveLength(1);
        expect(screen.getByTestId('chat-input').props.value).toBe('');
    });

    it('keeps the text and shows an error when sending fails', async () => {
        mockedPostChat.mockRejectedValueOnce(new Error('boom'));
        await renderViewer();
        fireEvent.changeText(screen.getByTestId('chat-input'), 'Salut');
        await act(async () => {
            fireEvent.press(screen.getByTestId('chat-send'));
        });
        expect(screen.getByTestId('chat-send-error')).toBeTruthy();
        expect(screen.getByTestId('chat-input').props.value).toBe('Salut');
    });

    it('shows the sign-in prompt instead of the composer when signed out', async () => {
        signIn(null);
        await renderViewer();
        expect(screen.queryByTestId('chat-input')).toBeNull();
        expect(mockedGetChat).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('chat-sign-in'));
        expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });
});

describe('LiveViewerScreen - cooking assistant', () => {
    it('adds a Recipe tab and a strip under the video when the live has a recipe', async () => {
        signIn(viewerUser);
        mockedGetLive.mockResolvedValue(makeLive({ description: recipeDescription() }));
        await renderViewer();

        expect(await screen.findByTestId('tab-recipe')).toBeTruthy();
        expect(screen.getByTestId('cooking-strip')).toBeTruthy();
        expect(screen.getByTestId('cooking-strip-next').props.children).toBe('Prochain : Pommes');

        // the description shown to the viewers no longer carries the recipe JSON
        fireEvent.press(screen.getByTestId('tab-info'));
        expect(screen.queryByText(/FOODSTREAM_RECIPE/)).toBeNull();
    });

    it('opens the recipe from the strip, with the tab selected and the strip gone', async () => {
        signIn(viewerUser);
        mockedGetLive.mockResolvedValue(makeLive({ description: recipeDescription() }));
        await renderViewer();

        fireEvent.press(await screen.findByTestId('cooking-strip'));
        expect(await screen.findByTestId('recipe-tab')).toBeTruthy();
        expect(screen.getByTestId('cooking-assistant')).toBeTruthy();
        expect(screen.queryByTestId('cooking-strip')).toBeNull();

        fireEvent.press(screen.getByTestId('ingredient-0'));
        fireEvent.press(screen.getByTestId('tab-chat'));
        // back on the chat, the strip follows the progress
        expect(await screen.findByTestId('cooking-strip-next')).toHaveTextContent('Prochain : Pâte brisée');
    });

    it('has no Recipe tab and no strip when the live has no recipe', async () => {
        signIn(viewerUser);
        await renderViewer();
        await screen.findByTestId('tab-chat');
        expect(screen.queryByTestId('tab-recipe')).toBeNull();
        expect(screen.queryByTestId('cooking-strip')).toBeNull();
    });

    it('ignores a broken recipe instead of crashing', async () => {
        signIn(viewerUser);
        mockedGetLive.mockResolvedValue(makeLive({ description: `Une tarte\n\n${RECIPE_MARKER}\n{broken` }));
        await renderViewer();
        await screen.findByTestId('tab-chat');
        expect(screen.queryByTestId('tab-recipe')).toBeNull();
    });

    it('lets a spectator prepare the ingredients of a scheduled live', async () => {
        signIn(viewerUser);
        mockedGetLive.mockResolvedValue(makeLive({ status: 'scheduled', scheduled_at: SCHEDULED_AT, description: recipeDescription() }));
        await renderViewer();
        expect(await screen.findByTestId('cooking-assistant')).toBeTruthy();
    });
});
