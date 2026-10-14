import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import PlayerOverlay from '@/components/live/PlayerOverlay';
import {
    LOAD_TIMEOUT_MS,
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

/**
 * Native HLS / MP4 player (expo-video).
 *
 * - `onLoad` / `onError` are kept in refs, so inline arrows from the parent never
 *   re-subscribe the player.
 * - A source that fails (live not started yet, network blip) is retried with a
 *   bounded back-off and a "waiting" state; after the cap a retry button is shown
 *   and `onError` is called exactly once.
 * - Changing `uri` resets everything (state, counters, timers).
 */
export default function HLSPlayer({ uri, onLoad, onError, style, mode = 'live', accessibilityLabel }: Readonly<HLSPlayerProps>) {
    const styles = useStyles();
    const { t } = useI18n();

    const [status, setStatus] = useState<PlayerStatus>('loading');
    const [attempt, setAttempt] = useState(0);
    const [retryNonce, setRetryNonce] = useState(0);

    const onLoadRef = useRef(onLoad);
    const onErrorRef = useRef(onError);
    useEffect(() => {
        onLoadRef.current = onLoad;
        onErrorRef.current = onError;
    });

    const player = useVideoPlayer({ uri }, (p) => {
        p.loop = false;
        p.play();
    });

    // Sound must stop as soon as the user leaves: the player is paused when the screen loses focus
    // (another screen pushed on top keeps this one mounted) and when it unmounts, instead of waiting
    // for the native player to be released. It resumes on return only if it was playing.
    const resumeOnFocusRef = useRef(false);
    useFocusEffect(
        useCallback(() => {
            if (resumeOnFocusRef.current) {
                resumeOnFocusRef.current = false;
                try {
                    player.play();
                } catch {
                    // player already released
                }
            }
            return () => {
                try {
                    resumeOnFocusRef.current = Boolean(player.playing);
                    player.pause();
                } catch {
                    // player already released
                }
            };
        }, [player])
    );

    const maxRetries = maxRetriesFor(mode);
    const handledNonceRef = useRef(0);

    useEffect(() => {
        let disposed = false;
        let attempts = 0;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let watchdog: ReturnType<typeof setTimeout> | null = null;

        const clearTimers = () => {
            if (retryTimer) clearTimeout(retryTimer);
            if (watchdog) clearTimeout(watchdog);
            retryTimer = null;
            watchdog = null;
        };

        const armWatchdog = () => {
            if (watchdog) clearTimeout(watchdog);
            watchdog = setTimeout(() => fail(new Error('timeout')), LOAD_TIMEOUT_MS);
        };

        const reload = () => {
            if (disposed) return;
            setStatus('loading');
            armWatchdog();
            try {
                Promise.resolve(player.replaceAsync({ uri }))
                    .then(() => {
                        if (!disposed) player.play();
                    })
                    .catch((error: unknown) => fail(error));
            } catch (error) {
                fail(error);
            }
        };

        function fail(error: unknown) {
            if (disposed) return;
            clearTimers();
            if (attempts < maxRetries) {
                attempts += 1;
                setAttempt(attempts);
                setStatus('waiting');
                retryTimer = setTimeout(reload, retryDelay(attempts));
                return;
            }
            setStatus('error');
            onErrorRef.current?.(error);
        }

        setStatus('loading');
        setAttempt(0);
        armWatchdog();
        // A manual retry reloads the source; the first run of a player uses the one given to the hook.
        if (retryNonce !== handledNonceRef.current) {
            handledNonceRef.current = retryNonce;
            reload();
        } else if (player.status === 'readyToPlay') {
            clearTimers();
            setStatus('ready');
        }

        const subscription = player.addListener('statusChange', ({ status: next, error }) => {
            if (disposed) return;
            if (next === 'readyToPlay') {
                clearTimers();
                attempts = 0;
                setAttempt(0);
                setStatus('ready');
                onLoadRef.current?.();
            } else if (next === 'error') {
                fail(error);
            }
        });

        return () => {
            disposed = true;
            clearTimers();
            subscription.remove();
        };
    }, [player, uri, retryNonce, maxRetries]);

    const handleRetry = useCallback(() => setRetryNonce((n) => n + 1), []);

    return (
        <View style={[styles.container, style]} accessibilityLabel={accessibilityLabel}>
            <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
            <PlayerOverlay
                status={status}
                attempt={attempt}
                maxAttempts={maxRetries}
                message={mode === 'live' ? t('live.player.unavailable') : t('live.player.replayUnavailable')}
                onRetry={handleRetry}
            />
        </View>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    container: {
        flex: 1,
        backgroundColor: colors.video,
    },
    video: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
}));
