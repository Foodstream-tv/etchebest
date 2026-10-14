import Hls from 'hls.js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { isHlsUrl } from '@/components/live/media';
import PlayerOverlay from '@/components/live/PlayerOverlay';
import {
    MANIFEST_SETTLE_MS,
    MAX_MEDIA_RECOVERIES,
    maxRetriesFor,
    PlayerMode,
    PlayerStatus,
    retryDelay,
} from '@/components/live/playerRetry';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';

interface HLSPlayerProps {
    uri: string;
    onLoad?: () => void;
    /** Called once per failure, after the automatic retries are exhausted. */
    onError?: (err: unknown) => void;
    style?: StyleProp<ViewStyle>;
    /** live: retries while the stream is not started; replay: static file, fails fast. */
    mode?: PlayerMode;
    accessibilityLabel?: string;
}

type ErrorKey = 'unavailable' | 'media' | 'stream' | 'unsupported' | 'replay';

const noop = () => {};

/**
 * Web HLS player (hls.js, native HLS on Safari, plain <video> for mp4 replays).
 *
 * Every timer, listener and hls.js instance created by the effect is released in its
 * cleanup, and nothing touches React state once it has run (no update after unmount,
 * no `startLoad` on a destroyed instance). `onLoad` / `onError` live in refs so that
 * inline callbacks from the parent never rebuild the player.
 */
export default function HLSPlayer({ uri, onLoad, onError, style, mode = 'live', accessibilityLabel }: Readonly<HLSPlayerProps>) {
    const styles = useStyles();
    const { t } = useI18n();
    const videoRef = useRef<HTMLVideoElement>(null);

    const [status, setStatus] = useState<PlayerStatus>('loading');
    const [attempt, setAttempt] = useState(0);
    const [errorKey, setErrorKey] = useState<ErrorKey>('unavailable');
    const [retryNonce, setRetryNonce] = useState(0);

    const onLoadRef = useRef(onLoad);
    const onErrorRef = useRef(onError);
    useEffect(() => {
        onLoadRef.current = onLoad;
        onErrorRef.current = onError;
    });

    const maxRetries = maxRetriesFor(mode);

    useEffect(() => {
        const element = videoRef.current;
        setStatus('loading');
        setAttempt(0);
        if (!element || !uri) return;
        const video: HTMLVideoElement = element;

        let disposed = false;
        let retries = 0;
        let mediaRecoveries = 0;
        let hls: Hls | null = null;
        let settleTimer: ReturnType<typeof setTimeout> | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let removeNativeListeners: () => void = noop;

        const clearTimers = () => {
            if (settleTimer) clearTimeout(settleTimer);
            if (retryTimer) clearTimeout(retryTimer);
            settleTimer = null;
            retryTimer = null;
        };

        const destroyHls = () => {
            if (!hls) return;
            const instance = hls;
            hls = null;
            try {
                instance.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
                instance.off(Hls.Events.ERROR, handleHlsError);
                instance.destroy();
            } catch {
                // already destroyed
            }
        };

        /** Terminal failure: one `onError` call, an inline message and a retry button. */
        const failHard = (key: ErrorKey, detail: unknown) => {
            if (disposed) return;
            clearTimers();
            destroyHls();
            setErrorKey(key);
            setStatus('error');
            onErrorRef.current?.(detail);
        };

        const markReady = () => {
            if (disposed) return;
            retries = 0;
            setAttempt(0);
            setStatus('ready');
            video.play().catch(noop);
            onLoadRef.current?.();
        };

        function handleManifestParsed() {
            if (disposed) return;
            clearTimers();
            // Delay so every variant has synchronised segments before the first frame.
            settleTimer = setTimeout(() => {
                settleTimer = null;
                markReady();
            }, MANIFEST_SETTLE_MS);
        }

        function handleHlsError(_event: unknown, data: { fatal?: boolean; type?: string; details?: string }) {
            if (disposed || !data?.fatal) return;
            console.warn('[HLS.js] Fatal error:', data.type, data.details);

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                if (retries < maxRetries) {
                    retries += 1;
                    setAttempt(retries);
                    setStatus('waiting');
                    clearTimers();
                    destroyHls();
                    retryTimer = setTimeout(() => {
                        retryTimer = null;
                        startHls();
                    }, retryDelay(retries));
                    return;
                }
                failHard(mode === 'live' ? 'unavailable' : 'replay', data);
                return;
            }

            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < MAX_MEDIA_RECOVERIES) {
                mediaRecoveries += 1;
                try {
                    hls?.recoverMediaError();
                } catch {
                    failHard('media', data);
                }
                return;
            }

            failHard(data.type === Hls.ErrorTypes.MEDIA_ERROR ? 'media' : 'stream', data);
        }

        function startHls() {
            if (disposed) return;
            setStatus('loading');
            const instance = new Hls({
                enableWorker: true,
                lowLatencyMode: mode === 'live',
                maxBufferLength: mode === 'live' ? 6 : 30,
                maxMaxBufferLength: mode === 'live' ? 12 : 60,
                liveSyncDurationCount: 2,
                liveMaxLatencyDurationCount: 4,
                startPosition: -1,
                maxBufferHole: 0.5,
                fragLoadingTimeOut: 10000,
            });
            hls = instance;
            instance.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
            instance.on(Hls.Events.ERROR, handleHlsError);
            instance.loadSource(uri);
            instance.attachMedia(video);
        }

        const startElementPlayback = (key: ErrorKey) => {
            // Safari (native HLS) and plain files: the <video> element does the work.
            const onLoadedMetadata = () => markReady();
            const onVideoError = () => failHard(key, video.error);
            video.addEventListener('loadedmetadata', onLoadedMetadata);
            video.addEventListener('error', onVideoError);
            removeNativeListeners = () => {
                video.removeEventListener('loadedmetadata', onLoadedMetadata);
                video.removeEventListener('error', onVideoError);
            };
            video.src = uri;
        };

        if (!isHlsUrl(uri)) {
            startElementPlayback(mode === 'live' ? 'stream' : 'replay');
        } else if (Hls.isSupported()) {
            startHls();
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            startElementPlayback(mode === 'live' ? 'stream' : 'replay');
        } else {
            failHard('unsupported', null);
        }

        return () => {
            disposed = true;
            clearTimers();
            removeNativeListeners();
            destroyHls();
            // A <video> removed from the page can keep playing its audio until it is garbage collected:
            // stop it and drop its source explicitly.
            try {
                video.pause?.();
                video.removeAttribute?.('src');
                video.load?.();
            } catch {
                // element already gone
            }
        };
    }, [uri, retryNonce, mode, maxRetries]);

    const handleRetry = useCallback(() => setRetryNonce((n) => n + 1), []);

    const messages: Record<ErrorKey, string> = {
        unavailable: t('live.player.unavailable'),
        media: t('watch.room.mediaError'),
        stream: t('watch.room.streamError'),
        unsupported: t('watch.room.unsupportedBrowser'),
        replay: t('live.player.replayUnavailable'),
    };

    return (
        <View style={[styles.container, style]} accessibilityLabel={accessibilityLabel}>
            <video ref={videoRef} style={videoStyle} playsInline autoPlay={mode === 'live'} controls />
            <PlayerOverlay
                status={status}
                attempt={attempt}
                maxAttempts={maxRetries}
                message={messages[errorKey]}
                onRetry={errorKey === 'unsupported' ? undefined : handleRetry}
            />
        </View>
    );
}

const videoStyle = { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' } as const;

const useStyles = makeStyles(({ colors }) => ({
    container: {
        flex: 1,
        backgroundColor: colors.video,
        justifyContent: 'center',
        alignItems: 'center',
    },
}));
