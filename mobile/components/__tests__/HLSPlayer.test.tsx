import React from 'react';

import HLSPlayer from '../HLSPlayer';
import { LOAD_TIMEOUT_MS, MAX_LIVE_RETRIES, MAX_REPLAY_RETRIES } from '../live/playerRetry';
import { act, fireEvent, renderWithProviders, screen } from '@/test-utils/render';

type StatusListener = (event: { status: string; error?: unknown }) => void;

const mockSubscriptions: { remove: jest.Mock }[] = [];
const mockListeners: StatusListener[] = [];
const mockPlayer = {
    loop: true,
    status: 'idle',
    playing: false,
    play: jest.fn(),
    pause: jest.fn(),
    replaceAsync: jest.fn((_source: unknown) => Promise.resolve()),
    addListener: jest.fn((_event: string, cb: StatusListener) => {
        mockListeners.push(cb);
        const subscription = { remove: jest.fn() };
        mockSubscriptions.push(subscription);
        return subscription;
    }),
};

jest.mock('expo-video', () => ({
    useVideoPlayer: jest.fn((_source: unknown, setup?: (p: unknown) => void) => {
        setup?.(mockPlayer);
        return mockPlayer;
    }),
    VideoView: 'VideoView',
}));

const URI = 'https://api.test/hls/room-1/master.m3u8';
const emit = (status: string, error?: unknown) => act(() => mockListeners[mockListeners.length - 1]({ status, error }));
const advance = (ms: number) =>
    act(() => {
        jest.advanceTimersByTime(ms);
    });
const flush = () => act(async () => {});

beforeEach(() => {
    jest.useFakeTimers();
    mockListeners.length = 0;
    mockSubscriptions.length = 0;
    mockPlayer.status = 'idle';
    mockPlayer.loop = true;
    mockPlayer.playing = false;
    mockPlayer.play.mockClear();
    mockPlayer.pause.mockClear();
    mockPlayer.replaceAsync.mockClear();
    mockPlayer.addListener.mockClear();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('HLSPlayer (native)', () => {
    it('configures the player (no loop, autoplay) and shows the loading state', () => {
        renderWithProviders(<HLSPlayer uri={URI} />);
        expect(mockPlayer.loop).toBe(false);
        expect(mockPlayer.play).toHaveBeenCalled();
        expect(screen.getByTestId('player-loading')).toBeTruthy();
    });

    it('hides the overlay and calls onLoad once when ready', () => {
        const onLoad = jest.fn();
        renderWithProviders(<HLSPlayer uri={URI} onLoad={onLoad} />);
        emit('readyToPlay');
        expect(screen.queryByTestId('player-loading')).toBeNull();
        expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('does not re-subscribe when the parent passes new inline callbacks', () => {
        const { rerender } = renderWithProviders(<HLSPlayer uri={URI} onError={() => {}} onLoad={() => {}} />);
        rerender(<HLSPlayer uri={URI} onError={() => {}} onLoad={() => {}} />);
        rerender(<HLSPlayer uri={URI} onError={() => {}} onLoad={() => {}} />);
        expect(mockPlayer.addListener).toHaveBeenCalledTimes(1);
        expect(mockSubscriptions[0].remove).not.toHaveBeenCalled();
    });

    it('uses the latest callback even though it does not re-subscribe', () => {
        const first = jest.fn();
        const second = jest.fn();
        const { rerender } = renderWithProviders(<HLSPlayer uri={URI} onLoad={first} />);
        rerender(<HLSPlayer uri={URI} onLoad={second} />);
        emit('readyToPlay');
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('shows a "stream not started yet" state and retries automatically', async () => {
        const onError = jest.fn();
        renderWithProviders(<HLSPlayer uri={URI} onError={onError} />);

        emit('error', { message: 'HTTP 404' });
        expect(screen.getByTestId('player-waiting')).toBeTruthy();
        expect(screen.getByText(`Le live n’a pas encore démarré… (1/${MAX_LIVE_RETRIES})`)).toBeTruthy();
        expect(onError).not.toHaveBeenCalled();

        mockPlayer.play.mockClear();
        advance(500);
        await flush();
        expect(mockPlayer.replaceAsync).toHaveBeenCalledWith({ uri: URI });
        expect(mockPlayer.play).toHaveBeenCalled();
        expect(screen.getByTestId('player-loading')).toBeTruthy();

        emit('readyToPlay');
        expect(screen.queryByTestId('player-loading')).toBeNull();
        expect(onError).not.toHaveBeenCalled();
    });

    it('stops after the retry cap: one onError, inline error, manual retry', async () => {
        const onError = jest.fn();
        renderWithProviders(<HLSPlayer uri={URI} onError={onError} />);

        for (let i = 0; i < MAX_LIVE_RETRIES; i++) {
            emit('error');
            advance(5000);
            await flush();
        }
        expect(mockPlayer.replaceAsync).toHaveBeenCalledTimes(MAX_LIVE_RETRIES);
        expect(onError).not.toHaveBeenCalled();

        emit('error', 'boom');
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith('boom');
        expect(screen.getByTestId('player-error')).toBeTruthy();

        advance(60_000);
        await flush();
        expect(mockPlayer.replaceAsync).toHaveBeenCalledTimes(MAX_LIVE_RETRIES);

        fireEvent.press(screen.getByTestId('player-retry'));
        await flush();
        expect(mockPlayer.replaceAsync).toHaveBeenCalledTimes(MAX_LIVE_RETRIES + 1);
        expect(screen.queryByTestId('player-error')).toBeNull();
        expect(screen.getByTestId('player-loading')).toBeTruthy();
    });

    it('fails fast for replays with a replay specific message', () => {
        const onError = jest.fn();
        renderWithProviders(<HLSPlayer uri="https://cdn.test/replay.mp4" mode="replay" onError={onError} />);
        for (let i = 0; i < MAX_REPLAY_RETRIES; i++) {
            emit('error');
            advance(5000);
        }
        emit('error');
        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Impossible de lire cette rediffusion.')).toBeTruthy();
    });

    it('resets the error state when the uri changes', () => {
        const onError = jest.fn();
        const { rerender } = renderWithProviders(<HLSPlayer uri={URI} mode="replay" onError={onError} />);
        for (let i = 0; i <= MAX_REPLAY_RETRIES; i++) {
            emit('error');
            advance(5000);
        }
        expect(screen.getByTestId('player-error')).toBeTruthy();

        rerender(<HLSPlayer uri="https://api.test/hls/room-2/master.m3u8" mode="replay" onError={onError} />);
        expect(screen.queryByTestId('player-error')).toBeNull();
        expect(screen.getByTestId('player-loading')).toBeTruthy();
        // and the retry budget is fresh again
        emit('error');
        expect(screen.getByTestId('player-waiting')).toBeTruthy();
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it('gives up on a source that never answers (watchdog) and retries it', async () => {
        renderWithProviders(<HLSPlayer uri={URI} />);
        advance(LOAD_TIMEOUT_MS);
        expect(screen.getByTestId('player-waiting')).toBeTruthy();
        advance(500);
        await flush();
        expect(mockPlayer.replaceAsync).toHaveBeenCalledTimes(1);
    });

    it('releases the subscription and every timer on unmount', async () => {
        const onError = jest.fn();
        const { unmount } = renderWithProviders(<HLSPlayer uri={URI} onError={onError} />);
        emit('error');
        unmount();
        expect(mockSubscriptions[0].remove).toHaveBeenCalledTimes(1);

        advance(LOAD_TIMEOUT_MS * 3);
        await flush();
        expect(mockPlayer.replaceAsync).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    it('treats a rejected replaceAsync as a failed attempt', async () => {
        const onError = jest.fn();
        mockPlayer.replaceAsync.mockRejectedValue(new Error('released'));
        renderWithProviders(<HLSPlayer uri={URI} mode="replay" onError={onError} />);
        emit('error');
        advance(500);
        await flush();
        expect(screen.getByTestId('player-waiting')).toBeTruthy();
        mockPlayer.replaceAsync.mockResolvedValue(undefined);
    });

    it('pauses the player on unmount so the sound stops right away', () => {
        const { unmount } = renderWithProviders(<HLSPlayer uri={URI} />);
        mockPlayer.pause.mockClear();

        unmount();

        expect(mockPlayer.pause).toHaveBeenCalled();
    });

    it('does not throw when the native player is already released at unmount', () => {
        const { unmount } = renderWithProviders(<HLSPlayer uri={URI} />);
        mockPlayer.pause.mockImplementationOnce(() => {
            throw new Error('NativeSharedObjectNotFoundException');
        });

        expect(() => unmount()).not.toThrow();
    });
});
