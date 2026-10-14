import React from 'react';

import HLSPlayer from '../HLSPlayer.web';
import { MANIFEST_SETTLE_MS, MAX_LIVE_RETRIES, MAX_MEDIA_RECOVERIES, MAX_REPLAY_RETRIES } from '../live/playerRetry';
import { act, fireEvent, renderWithProviders, screen } from '@/test-utils/render';

jest.mock('hls.js', () => {
    const instances: any[] = [];
    class MockHls {
        static isSupported = jest.fn(() => true);
        static Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' };
        static ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError', OTHER_ERROR: 'otherError' };
        static instances = instances;

        handlers: Record<string, ((...args: any[]) => void)[]> = {};
        config: Record<string, unknown>;
        on = jest.fn((event: string, cb: (...args: any[]) => void) => {
            (this.handlers[event] ||= []).push(cb);
        });
        off = jest.fn((event: string, cb: (...args: any[]) => void) => {
            this.handlers[event] = (this.handlers[event] || []).filter((h) => h !== cb);
        });
        loadSource = jest.fn();
        attachMedia = jest.fn();
        destroy = jest.fn();
        startLoad = jest.fn();
        recoverMediaError = jest.fn();

        constructor(config: Record<string, unknown>) {
            this.config = config;
            instances.push(this);
        }
        emit(event: string, data?: unknown) {
            [...(this.handlers[event] || [])].forEach((cb) => cb(event, data));
        }
    }
    return { __esModule: true, default: MockHls };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MockHls = require('hls.js').default as any;
const instances: any[] = MockHls.instances;
const { MANIFEST_PARSED, ERROR } = MockHls.Events;

function makeVideo(canPlayHls = '') {
    return {
        play: jest.fn(() => Promise.resolve()),
        pause: jest.fn(),
        load: jest.fn(),
        removeAttribute: jest.fn(),
        canPlayType: jest.fn(() => canPlayHls),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        src: '',
        error: null,
    };
}

let video = makeVideo();
const LIVE = 'https://api.test/hls/room-1/master.m3u8';

function renderPlayer(props: Partial<React.ComponentProps<typeof HLSPlayer>> = {}) {
    const onLoad = jest.fn();
    const onError = jest.fn();
    const utils = renderWithProviders(<HLSPlayer uri={LIVE} onLoad={onLoad} onError={onError} {...props} />, {
        createNodeMock: (element: any) => (element.type === 'video' ? video : null),
    });
    return { ...utils, onLoad, onError };
}

const networkFatal = { fatal: true, type: 'networkError', details: 'manifestLoadError' };

beforeEach(() => {
    jest.useFakeTimers();
    instances.length = 0;
    MockHls.isSupported.mockReturnValue(true);
    video = makeVideo();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('HLSPlayer (web)', () => {
    it('creates one hls.js instance with valid options and loads the uri', () => {
        renderPlayer();
        expect(instances).toHaveLength(1);
        const hls = instances[0];
        expect(hls.loadSource).toHaveBeenCalledWith(LIVE);
        expect(hls.attachMedia).toHaveBeenCalledWith(video);
        expect(hls.config).toEqual(expect.objectContaining({ fragLoadingTimeOut: 10000 }));
        expect(hls.config).not.toHaveProperty('segmentLoadingTimeout');
        expect(screen.getByTestId('player-loading')).toBeTruthy();
    });

    it('becomes ready after the settle delay and calls onLoad once', () => {
        const { onLoad } = renderPlayer();
        act(() => instances[0].emit(MANIFEST_PARSED));
        expect(onLoad).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(MANIFEST_SETTLE_MS);
        });
        expect(onLoad).toHaveBeenCalledTimes(1);
        expect(video.play).toHaveBeenCalled();
        expect(screen.queryByTestId('player-loading')).toBeNull();
    });

    it('stops the <video> element and drops its source on unmount (no lingering audio)', () => {
        const { unmount } = renderPlayer();
        video.pause.mockClear();
        video.load.mockClear();

        unmount();

        expect(video.pause).toHaveBeenCalled();
        expect(video.removeAttribute).toHaveBeenCalledWith('src');
        expect(video.load).toHaveBeenCalled();
    });

    it('does nothing after unmount: no onLoad, no play, no startLoad, listeners removed', () => {
        const { onLoad, onError, unmount } = renderPlayer();
        const hls = instances[0];
        act(() => hls.emit(MANIFEST_PARSED));
        unmount();

        expect(hls.destroy).toHaveBeenCalledTimes(1);
        expect(hls.off).toHaveBeenCalledWith(MANIFEST_PARSED, expect.any(Function));
        expect(hls.off).toHaveBeenCalledWith(ERROR, expect.any(Function));

        act(() => {
            hls.emit(ERROR, networkFatal);
            jest.advanceTimersByTime(60_000);
        });
        expect(onLoad).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(video.play).not.toHaveBeenCalled();
        expect(hls.startLoad).not.toHaveBeenCalled();
        expect(instances).toHaveLength(1);
    });

    it('retries network errors with a waiting state, without calling onError', () => {
        const { onError } = renderPlayer();
        act(() => instances[0].emit(ERROR, networkFatal));

        expect(screen.getByTestId('player-waiting')).toBeTruthy();
        expect(screen.getByText(`Le live n’a pas encore démarré… (1/${MAX_LIVE_RETRIES})`)).toBeTruthy();
        expect(instances[0].destroy).toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(instances).toHaveLength(2);
        expect(instances[1].loadSource).toHaveBeenCalledWith(LIVE);
    });

    it('caps the retries, then reports the failure exactly once and offers a retry', () => {
        const { onError } = renderPlayer();
        for (let i = 0; i < MAX_LIVE_RETRIES; i++) {
            act(() => instances[instances.length - 1].emit(ERROR, networkFatal));
            act(() => {
                jest.advanceTimersByTime(5000);
            });
        }
        expect(instances).toHaveLength(MAX_LIVE_RETRIES + 1);
        expect(onError).not.toHaveBeenCalled();

        act(() => instances[instances.length - 1].emit(ERROR, networkFatal));
        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('player-error')).toBeTruthy();
        expect(screen.getByText('Stream indisponible. Le live n’a peut-être pas encore commencé.')).toBeTruthy();

        act(() => {
            jest.advanceTimersByTime(60_000);
        });
        expect(instances).toHaveLength(MAX_LIVE_RETRIES + 1);
        expect(onError).toHaveBeenCalledTimes(1);

        // the retry button rebuilds the player
        fireEvent.press(screen.getByTestId('player-retry'));
        expect(instances).toHaveLength(MAX_LIVE_RETRIES + 2);
        expect(screen.queryByTestId('player-error')).toBeNull();
    });

    it('replays fail fast (few retries)', () => {
        const { onError } = renderPlayer({ mode: 'replay' });
        for (let i = 0; i < MAX_REPLAY_RETRIES; i++) {
            act(() => instances[instances.length - 1].emit(ERROR, networkFatal));
            act(() => {
                jest.advanceTimersByTime(5000);
            });
        }
        act(() => instances[instances.length - 1].emit(ERROR, networkFatal));
        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Impossible de lire cette rediffusion.')).toBeTruthy();
    });

    it('caps media-error recovery instead of looping forever', () => {
        const { onError } = renderPlayer();
        const hls = instances[0];
        const mediaFatal = { fatal: true, type: 'mediaError', details: 'bufferStalled' };

        for (let i = 0; i < MAX_MEDIA_RECOVERIES; i++) {
            act(() => hls.emit(ERROR, mediaFatal));
        }
        expect(hls.recoverMediaError).toHaveBeenCalledTimes(MAX_MEDIA_RECOVERIES);
        expect(onError).not.toHaveBeenCalled();

        act(() => hls.emit(ERROR, mediaFatal));
        expect(hls.recoverMediaError).toHaveBeenCalledTimes(MAX_MEDIA_RECOVERIES);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Erreur média.')).toBeTruthy();
    });

    it('ignores non fatal errors and reports other fatal errors once', () => {
        const { onError } = renderPlayer();
        act(() => instances[0].emit(ERROR, { fatal: false, type: 'networkError' }));
        expect(onError).not.toHaveBeenCalled();
        expect(screen.getByTestId('player-loading')).toBeTruthy();

        act(() => instances[0].emit(ERROR, { fatal: true, type: 'otherError', details: 'x' }));
        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Erreur lecture stream.')).toBeTruthy();
    });

    it('does not rebuild the player when the parent passes new inline callbacks', () => {
        const { rerender, onLoad } = renderPlayer();
        const onLoad2 = jest.fn();
        rerender(<HLSPlayer uri={LIVE} onLoad={onLoad2} onError={() => {}} />);
        rerender(<HLSPlayer uri={LIVE} onLoad={() => onLoad2()} onError={() => {}} />);
        expect(instances).toHaveLength(1);
        expect(instances[0].destroy).not.toHaveBeenCalled();

        act(() => instances[0].emit(MANIFEST_PARSED));
        act(() => {
            jest.advanceTimersByTime(MANIFEST_SETTLE_MS);
        });
        expect(onLoad).not.toHaveBeenCalled();
        expect(onLoad2).toHaveBeenCalledTimes(1);
    });

    it('resets its state and recreates the player when the uri changes', () => {
        const { rerender, onError } = renderPlayer();
        act(() => instances[0].emit(ERROR, { fatal: true, type: 'otherError' }));
        expect(screen.getByTestId('player-error')).toBeTruthy();

        const next = 'https://api.test/hls/room-2/master.m3u8';
        rerender(<HLSPlayer uri={next} onError={onError} />);
        expect(screen.queryByTestId('player-error')).toBeNull();
        expect(screen.getByTestId('player-loading')).toBeTruthy();
        expect(instances).toHaveLength(2);
        expect(instances[1].loadSource).toHaveBeenCalledWith(next);
    });

    it('drops a pending settle timer when the uri changes', () => {
        const { rerender, onLoad } = renderPlayer();
        act(() => instances[0].emit(MANIFEST_PARSED));
        rerender(<HLSPlayer uri="https://api.test/hls/room-2/master.m3u8" onLoad={onLoad} />);
        act(() => {
            jest.advanceTimersByTime(MANIFEST_SETTLE_MS * 2);
        });
        expect(onLoad).not.toHaveBeenCalled();
    });

    it('uses the native HLS branch (Safari) and removes its listeners on cleanup', () => {
        MockHls.isSupported.mockReturnValue(false);
        video = makeVideo('maybe');
        const { onLoad, onError, unmount } = renderPlayer();

        expect(instances).toHaveLength(0);
        expect(video.src).toBe(LIVE);
        const added = video.addEventListener.mock.calls as [string, () => void][];
        expect(added.map(([name]) => name).sort()).toEqual(['error', 'loadedmetadata']);

        act(() => added.find(([name]) => name === 'loadedmetadata')![1]());
        expect(onLoad).toHaveBeenCalledTimes(1);

        unmount();
        const removed = video.removeEventListener.mock.calls as [string, () => void][];
        for (const [name, handler] of added) {
            expect(removed).toContainEqual([name, handler]);
        }
        expect(onError).not.toHaveBeenCalled();
    });

    it('reports a native element error once', () => {
        MockHls.isSupported.mockReturnValue(false);
        video = makeVideo('maybe');
        const { onError } = renderPlayer();
        const errorHandler = (video.addEventListener.mock.calls as [string, () => void][]).find(([n]) => n === 'error')![1];
        act(() => errorHandler());
        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('player-error')).toBeTruthy();
    });

    it('plays non-HLS replays (mp4) directly with the video element', () => {
        const { onLoad } = renderPlayer({ uri: 'https://cdn.test/replay.mp4?token=1', mode: 'replay' });
        expect(instances).toHaveLength(0);
        expect(video.src).toBe('https://cdn.test/replay.mp4?token=1');
        const loaded = (video.addEventListener.mock.calls as [string, () => void][]).find(([n]) => n === 'loadedmetadata')![1];
        act(() => loaded());
        expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('shows an unsupported message when neither hls.js nor native HLS is available', () => {
        MockHls.isSupported.mockReturnValue(false);
        const { onError } = renderPlayer();
        expect(screen.getByText('Navigateur non supporté.')).toBeTruthy();
        expect(onError).toHaveBeenCalledTimes(1);
        // nothing to retry
        expect(screen.queryByTestId('player-retry')).toBeNull();
    });
});
