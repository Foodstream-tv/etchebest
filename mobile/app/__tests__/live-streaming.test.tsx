import { act, fireEvent, renderWithProviders } from '@/test-utils/render';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, BackHandler, Linking } from 'react-native';

import LiveStreamingScreen from '../live-streaming';
import { useWebRTC } from '@/hooks/useWebRTC';
import { getLiveByRoomId } from '@/services/lives';
import { clearLiveDrafts, setLiveDraft } from '@/utils/liveDraft';

jest.mock('@/services/lives', () => ({
    ...jest.requireActual('@/services/lives'),
    getLiveByRoomId: jest.fn(),
}));
jest.mock('@/services/storage', () => {
    const api = { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) };
    return { __esModule: true, default: api, storage: api };
});

jest.mock('@/hooks/useWebRTC', () => ({
    useWebRTC: jest.fn(),
}));

jest.mock('@/components/StreamView', () => {
    const { View } = require('react-native');
    return { __esModule: true, default: (props: { stream: { id: string } }) => <View testID={`stream-${props.stream.id}`} /> };
});

const mockedUseWebRTC = useWebRTC as jest.Mock;
const mockedGetLive = getLiveByRoomId as jest.Mock;
const mockedParams = useLocalSearchParams as jest.Mock;

function hookState(overrides: Record<string, unknown> = {}) {
    return {
        state: 'idle',
        roomId: null,
        localStream: null,
        remoteStreams: [],
        error: null,
        errorCode: null,
        isAudioMuted: false,
        isVideoMuted: false,
        isFrontCamera: true,
        startLive: jest.fn().mockResolvedValue(undefined),
        hostExistingRoom: jest.fn().mockResolvedValue(undefined),
        joinAsCoStreamer: jest.fn().mockResolvedValue(undefined),
        stopLive: jest.fn().mockResolvedValue(undefined),
        toggleAudio: jest.fn(),
        toggleVideo: jest.fn(),
        switchCamera: jest.fn(),
        ...overrides,
    };
}

const router = (useRouter as unknown as () => { back: jest.Mock; replace: jest.Mock; canGoBack: jest.Mock })();

beforeEach(() => {
    jest.clearAllMocks();
    router.canGoBack.mockReturnValue(true);
    mockedGetLive.mockResolvedValue({ description: '' });
    clearLiveDrafts();
});

describe('LiveStreamingScreen - host', () => {
    it('shows the launch button and starts the live with the Studio title, tags and description', () => {
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: '  Pasta   maison ', tags: 'Italien,Pâtisserie', description: 'Fraîche' });

        const { getByTestId, getByText } = renderWithProviders(<LiveStreamingScreen />);
        expect(getByText('Pasta maison')).toBeTruthy();

        fireEvent.press(getByTestId('launch-live'));

        expect(hook.startLive).toHaveBeenCalledTimes(1);
        expect(hook.startLive).toHaveBeenCalledWith('Pasta maison', {
            title: 'Pasta maison',
            description: 'Fraîche',
            tags: ['Italien', 'Pâtisserie'],
        });
    });

    it('starts the live with everything the Studio collected: recipe, level, duration, thumbnail', () => {
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        const recipe = JSON.stringify({ ingredients: [{ name: 'farine', qty: '200 g' }], cookingTimer: 600 });
        mockedParams.mockReturnValue({
            mode: 'host',
            title: 'Pasta maison',
            description: `Fraîche\n\n---FOODSTREAM_RECIPE---\n${recipe}`,
            level: 'Avancé',
            durationMinutes: '90',
            thumbnailUrl: '/api/uploads/t.jpg',
        });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('launch-live'));

        expect(hook.startLive).toHaveBeenCalledWith('Pasta maison', {
            title: 'Pasta maison',
            description: `Fraîche\n\n---FOODSTREAM_RECIPE---\n${recipe}`,
            tags: [],
            level: 'Avancé',
            durationMinutes: 90,
            thumbnailUrl: '/api/uploads/t.jpg',
        });
    });

    it('takes the description and the thumbnail of the Studio from the draft, not from the route', () => {
        const recipe = JSON.stringify({ ingredients: [{ name: 'Farine', qty: '200 g' }], cookingTimer: 300 });
        const draft = setLiveDraft({ description: `Fraîche\n\n---FOODSTREAM_RECIPE---\n${recipe}`, thumbnailUrl: '/api/uploads/t.jpg' });
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'Pasta maison', durationMinutes: '45', draft });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('launch-live'));

        expect(hook.startLive).toHaveBeenCalledWith('Pasta maison', {
            title: 'Pasta maison',
            description: `Fraîche\n\n---FOODSTREAM_RECIPE---\n${recipe}`,
            tags: [],
            level: undefined,
            durationMinutes: 45,
            thumbnailUrl: '/api/uploads/t.jpg',
        });
    });

    it('falls back to the route params without a draft (deep link, old navigation state)', () => {
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'Pasta maison', description: 'Fraîche', draft: 'draft-unknown' });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('launch-live'));
        expect(hook.startLive).toHaveBeenCalledWith('Pasta maison', expect.objectContaining({ description: 'Fraîche' }));
    });

    it('ignores tampered Studio params (bad level, duration, thumbnail, broken recipe)', () => {
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({
            mode: 'host',
            title: 'Pasta maison',
            description: 'Fraîche\n\n---FOODSTREAM_RECIPE---\n{broken',
            level: 'Dieu',
            durationMinutes: '99999',
            thumbnailUrl: 'javascript:alert(1)',
        });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('launch-live'));

        expect(hook.startLive).toHaveBeenCalledWith('Pasta maison', {
            title: 'Pasta maison',
            description: 'Fraîche',
            tags: [],
            level: undefined,
            durationMinutes: undefined,
            thumbnailUrl: undefined,
        });
    });

    it('warns the host, before going live, that the live is recorded and replayed publicly', () => {
        mockedUseWebRTC.mockReturnValue(hookState());
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        expect(getByTestId('recording-notice')).toBeTruthy();
    });

    it('no longer shows the recording notice to the host once live (the button area is busy)', () => {
        mockedUseWebRTC.mockReturnValue(hookState({ state: 'live', localStream: { id: 'local' } }));
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        const { queryByTestId } = renderWithProviders(<LiveStreamingScreen />);
        expect(queryByTestId('recording-notice')).toBeNull();
    });

    it('never uses the old hardcoded title', () => {
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });
        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('launch-live'));
        expect(hook.startLive.mock.calls[0][0]).toBe('Mon live');
        expect(JSON.stringify(hook.startLive.mock.calls)).not.toContain('Live Stream');
    });

    it('blocks the launch when the title param is missing or invalid', () => {
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'ab' });

        const { getByTestId, getByText } = renderWithProviders(<LiveStreamingScreen />);
        expect(getByText('Le titre du live est obligatoire.')).toBeTruthy();
        fireEvent.press(getByTestId('launch-live'));
        expect(hook.startLive).not.toHaveBeenCalled();
    });

    it('hosts an existing scheduled room when a roomId is given (no title needed)', () => {
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', roomId: 'sched-1' });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('launch-live'));
        expect(hook.hostExistingRoom).toHaveBeenCalledWith('sched-1');
        expect(hook.startLive).not.toHaveBeenCalled();
    });

    it('ignores a double tap on "Lancer le live"', () => {
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('launch-live'));
        fireEvent.press(getByTestId('launch-live'));
        expect(hook.startLive).toHaveBeenCalledTimes(1);
    });

    it('asks for confirmation before stopping, then stops and leaves', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        const hook = hookState({ state: 'live', localStream: { id: 'local' }, roomId: 'room-12345678' });
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('stop-live'));

        expect(alertSpy).toHaveBeenCalledTimes(1);
        expect(alertSpy.mock.calls[0][0]).toBe('Arrêter le live ?');
        expect(hook.stopLive).not.toHaveBeenCalled();

        const buttons = alertSpy.mock.calls[0][2] as { text: string; style?: string; onPress?: () => void }[];
        const destructive = buttons.find((b) => b.style === 'destructive');
        expect(destructive?.text).toBe('Arrêter le live');
        await act(async () => {
            destructive?.onPress?.();
        });
        expect(hook.stopLive).toHaveBeenCalledTimes(1);
        expect(router.back).toHaveBeenCalledTimes(1);
    });

    it('cancelling the confirmation keeps the live running', () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        const hook = hookState({ state: 'live', localStream: { id: 'local' } });
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('back-button'));
        expect(alertSpy).toHaveBeenCalledTimes(1);
        const buttons = alertSpy.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
        buttons.find((b) => b.style === 'cancel')?.onPress?.();
        expect(hook.stopLive).not.toHaveBeenCalled();
        expect(router.back).not.toHaveBeenCalled();
    });

    it('leaves without confirmation when nothing is running', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        await act(async () => {
            fireEvent.press(getByTestId('back-button'));
        });
        expect(alertSpy).not.toHaveBeenCalled();
        expect(hook.stopLive).toHaveBeenCalledTimes(1);
        expect(router.back).toHaveBeenCalledTimes(1);
    });

    it('Android hardware back asks for confirmation while live, and lets the navigator through otherwise', () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        let handler: (() => boolean) | undefined;
        const remove = jest.fn();
        jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, cb: () => boolean) => {
            handler = cb;
            return { remove };
        }) as never);

        mockedUseWebRTC.mockReturnValue(hookState({ state: 'live', localStream: { id: 'local' } }));
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });
        const view = renderWithProviders(<LiveStreamingScreen />);
        expect(handler?.()).toBe(true);
        expect(alertSpy).toHaveBeenCalledTimes(1);

        mockedUseWebRTC.mockReturnValue(hookState({ state: 'idle' }));
        view.rerender(<LiveStreamingScreen />);
        expect(handler?.()).toBe(false);

        view.unmount();
        expect(remove).toHaveBeenCalled();
    });

    describe('navigation guard (swipe-back, back gesture, header back)', () => {
        const navigation = (jest.requireMock('expo-router') as { __mockNavigation: { addListener: jest.Mock; setOptions: jest.Mock } }).__mockNavigation;
        const lastGuard = () => {
            const calls = navigation.addListener.mock.calls.filter(([name]: [string]) => name === 'beforeRemove');
            return calls[calls.length - 1][1] as (event: { data: { action: { type: string } }; preventDefault: () => void }) => void;
        };
        const event = (type: string) => ({ data: { action: { type } }, preventDefault: jest.fn() });

        it('asks for confirmation instead of leaving while a live is running', () => {
            const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
            mockedUseWebRTC.mockReturnValue(hookState({ state: 'live', localStream: { id: 'local' } }));
            mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });
            renderWithProviders(<LiveStreamingScreen />);

            const back = event('GO_BACK');
            lastGuard()(back);

            expect(back.preventDefault).toHaveBeenCalledTimes(1);
            expect(alertSpy).toHaveBeenCalledTimes(1);
            // the iOS swipe-back gesture is disabled while live
            expect(navigation.setOptions).toHaveBeenCalledWith({ gestureEnabled: false });
        });

        it('lets the exit through once the user confirmed (and stops the live)', async () => {
            const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
            const hook = hookState({ state: 'live', localStream: { id: 'local' } });
            mockedUseWebRTC.mockReturnValue(hook);
            mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });
            renderWithProviders(<LiveStreamingScreen />);

            lastGuard()(event('POP'));
            const buttons = alertSpy.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
            await act(async () => {
                buttons.find((button) => button.style === 'destructive')?.onPress?.();
            });

            expect(hook.stopLive).toHaveBeenCalledTimes(1);
            const exit = event('GO_BACK');
            lastGuard()(exit);
            expect(exit.preventDefault).not.toHaveBeenCalled();
        });

        it('does not interfere when nothing is running, or for replace/reset (e.g. session expired)', () => {
            mockedUseWebRTC.mockReturnValue(hookState({ state: 'idle' }));
            mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });
            const idle = renderWithProviders(<LiveStreamingScreen />);
            const back = event('GO_BACK');
            lastGuard()(back);
            expect(back.preventDefault).not.toHaveBeenCalled();
            expect(navigation.setOptions).toHaveBeenCalledWith({ gestureEnabled: true });
            idle.unmount();

            mockedUseWebRTC.mockReturnValue(hookState({ state: 'live', localStream: { id: 'local' } }));
            renderWithProviders(<LiveStreamingScreen />);
            const replace = event('REPLACE');
            lastGuard()(replace);
            expect(replace.preventDefault).not.toHaveBeenCalled();
        });
    });

    it('shows the status, room and the mute / camera / flip controls while live', () => {
        const hook = hookState({ state: 'live', localStream: { id: 'local' }, roomId: 'abcdefghijkl' });
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        const { getByText, getByTestId, getByLabelText } = renderWithProviders(<LiveStreamingScreen />);
        expect(getByText('En direct')).toBeTruthy();
        expect(getByText('Room abcdefgh…')).toBeTruthy();
        expect(getByTestId('stream-local')).toBeTruthy();

        fireEvent.press(getByLabelText('Couper le micro'));
        fireEvent.press(getByLabelText('Couper la caméra'));
        fireEvent.press(getByLabelText('Changer de caméra'));
        expect(hook.toggleAudio).toHaveBeenCalledTimes(1);
        expect(hook.toggleVideo).toHaveBeenCalledTimes(1);
        expect(hook.switchCamera).toHaveBeenCalledTimes(1);
    });

    it('keeps the preview and the leave control while reconnecting (no retry button)', () => {
        const hook = hookState({ state: 'reconnecting', localStream: { id: 'local' }, roomId: 'abcdefghijkl' });
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        const { getAllByText, getByTestId, queryByTestId } = renderWithProviders(<LiveStreamingScreen />);
        expect(getAllByText('Reconnexion…').length).toBeGreaterThan(0);
        expect(getByTestId('stream-local')).toBeTruthy();
        expect(getByTestId('stop-live')).toBeTruthy();
        expect(queryByTestId('retry-live')).toBeNull();
    });

    it('explains a lost connection and an ended live', () => {
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        mockedUseWebRTC.mockReturnValue(hookState({ state: 'error', error: 'x', errorCode: 'connection' }));
        const first = renderWithProviders(<LiveStreamingScreen />);
        expect(first.getByText(/connexion a été perdue/)).toBeTruthy();
        first.unmount();

        mockedUseWebRTC.mockReturnValue(hookState({ state: 'error', error: 'x', errorCode: 'ended' }));
        const second = renderWithProviders(<LiveStreamingScreen />);
        expect(second.getByText(/Le live est terminé/)).toBeTruthy();
    });

    it('shows a clear message and a settings link when the permission is denied', () => {
        const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
        mockedUseWebRTC.mockReturnValue(hookState({ state: 'error', error: 'Permission denied', errorCode: 'permission' }));
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        const { getByText, getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        expect(getByText(/accès à la caméra et au micro est refusé/)).toBeTruthy();

        fireEvent.press(getByTestId('open-settings'));
        expect(openSettings).toHaveBeenCalledTimes(1);
    });

    it('maps the other error codes to localized messages', () => {
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        mockedUseWebRTC.mockReturnValue(hookState({ state: 'error', error: 'x', errorCode: 'conflict' }));
        const first = renderWithProviders(<LiveStreamingScreen />);
        expect(first.getByText(/déjà un live actif ou planifié/)).toBeTruthy();
        first.unmount();

        mockedUseWebRTC.mockReturnValue(hookState({ state: 'error', error: 'x', errorCode: 'unsupported' }));
        const second = renderWithProviders(<LiveStreamingScreen />);
        expect(second.getByText(/Expo Go/)).toBeTruthy();
    });

    it('retry for the host restarts the live', () => {
        const hook = hookState({ state: 'error', error: 'boom', errorCode: 'generic' });
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('retry-live'));
        expect(hook.startLive).toHaveBeenCalledTimes(1);
        expect(hook.startLive.mock.calls[0][0]).toBe('Mon live');
        expect(hook.stopLive).not.toHaveBeenCalled();
    });

    it('renders the remote stream picture-in-picture while the local preview stays main', () => {
        mockedUseWebRTC.mockReturnValue(
            hookState({
                state: 'live',
                localStream: { id: 'local' },
                remoteStreams: [{ id: 'guest', getVideoTracks: () => [{ id: 't', readyState: 'live', muted: false }] }],
            })
        );
        mockedParams.mockReturnValue({ mode: 'host', title: 'Mon live' });
        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        expect(getByTestId('stream-local')).toBeTruthy();
        expect(getByTestId('stream-guest')).toBeTruthy();
    });
});

describe('LiveStreamingScreen - join', () => {
    it('joins automatically, exactly once, even across re-renders', () => {
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'join', roomId: 'room-9' });

        const view = renderWithProviders(<LiveStreamingScreen />);
        expect(hook.joinAsCoStreamer).toHaveBeenCalledTimes(1);
        expect(hook.joinAsCoStreamer).toHaveBeenCalledWith('room-9');

        mockedUseWebRTC.mockReturnValue({ ...hook, state: 'creating' });
        view.rerender(<LiveStreamingScreen />);
        expect(hook.joinAsCoStreamer).toHaveBeenCalledTimes(1);
        expect(hook.startLive).not.toHaveBeenCalled();
    });

    it('retry re-joins explicitly and does not re-trigger the auto-join loop', () => {
        const hook = hookState({ state: 'error', error: 'room full', errorCode: 'generic' });
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'join', roomId: 'room-9' });

        const view = renderWithProviders(<LiveStreamingScreen />);
        expect(hook.joinAsCoStreamer).toHaveBeenCalledTimes(1);

        fireEvent.press(view.getByTestId('retry-live'));
        expect(hook.joinAsCoStreamer).toHaveBeenCalledTimes(2);
        expect(hook.stopLive).not.toHaveBeenCalled();

        view.rerender(<LiveStreamingScreen />);
        view.rerender(<LiveStreamingScreen />);
        expect(hook.joinAsCoStreamer).toHaveBeenCalledTimes(2);
    });

    it('keeps telling a co-streamer that the live is recorded while connected', () => {
        mockedUseWebRTC.mockReturnValue(hookState({ state: 'live', localStream: { id: 'local' } }));
        mockedParams.mockReturnValue({ mode: 'join', roomId: 'room-12345678' });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        expect(getByTestId('recording-notice')).toBeTruthy();
    });

    it('asks to confirm leaving a co-stream with the co-op wording', () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        mockedUseWebRTC.mockReturnValue(hookState({ state: 'live', localStream: { id: 'local' } }));
        mockedParams.mockReturnValue({ mode: 'join', roomId: 'room-9' });

        const { getByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(getByTestId('stop-live'));
        expect(alertSpy.mock.calls[0][0]).toBe('Quitter le live ?');
    });

    it('shows an error and does not try to join without a room id', () => {
        const hook = hookState();
        mockedUseWebRTC.mockReturnValue(hook);
        mockedParams.mockReturnValue({ mode: 'join' });

        const { getByText } = renderWithProviders(<LiveStreamingScreen />);
        expect(getByText(/Live introuvable/)).toBeTruthy();
        expect(hook.joinAsCoStreamer).not.toHaveBeenCalled();
    });
});

describe('LiveStreamingScreen - recipe while broadcasting', () => {
    const MARKER = '---FOODSTREAM_RECIPE---';
    const recipeText = (extra = '') =>
        `Une tarte\n\n${MARKER}\n${JSON.stringify({ ingredients: [{ name: 'Pommes', qty: '4' }], cookingTimer: 600, ...(extra ? JSON.parse(extra) : {}) })}`;
    const flush = async () => {
        await act(async () => {
            await Promise.resolve();
        });
    };

    it('lets the host open the recipe typed in the Studio, then come back to the live', async () => {
        mockedUseWebRTC.mockReturnValue(hookState({ state: 'live', localStream: { id: 'local' }, roomId: 'room-9' }));
        mockedParams.mockReturnValue({ mode: 'host', title: 'Tarte aux pommes', description: recipeText() });

        const { findByTestId, getByTestId, queryByTestId } = renderWithProviders(<LiveStreamingScreen />);
        fireEvent.press(await findByTestId('open-recipe'));

        expect(getByTestId('cooking-assistant')).toBeTruthy();
        expect(getByTestId('ingredient-0')).toBeTruthy();
        fireEvent.press(getByTestId('ingredient-0'));

        fireEvent.press(getByTestId('recipe-close'));
        expect(queryByTestId('open-recipe')).toBeTruthy(); // still broadcasting
        expect(mockedGetLive).not.toHaveBeenCalled(); // the host's own recipe is not fetched
    });

    it('reads the recipe of the live a co-streamer joins', async () => {
        mockedGetLive.mockResolvedValue({ description: recipeText() });
        mockedUseWebRTC.mockReturnValue(hookState({ state: 'live', localStream: { id: 'local' }, roomId: 'room-5' }));
        mockedParams.mockReturnValue({ mode: 'join', roomId: 'room-5' });

        const { findByTestId } = renderWithProviders(<LiveStreamingScreen />);
        expect(await findByTestId('open-recipe')).toBeTruthy();
        expect(mockedGetLive).toHaveBeenCalledWith('room-5');
    });

    it('has no recipe button for a live without recipe, or when the live cannot be read', async () => {
        mockedUseWebRTC.mockReturnValue(hookState({ state: 'live', localStream: { id: 'local' }, roomId: 'room-5' }));
        mockedParams.mockReturnValue({ mode: 'join', roomId: 'room-5' });

        const first = renderWithProviders(<LiveStreamingScreen />);
        await flush();
        expect(first.queryByTestId('open-recipe')).toBeNull();
        first.unmount();

        mockedGetLive.mockRejectedValue(new Error('network'));
        const second = renderWithProviders(<LiveStreamingScreen />);
        await flush();
        expect(second.queryByTestId('open-recipe')).toBeNull();
        expect(second.getByTestId('stop-live')).toBeTruthy(); // the broadcast itself is unaffected
    });
});
