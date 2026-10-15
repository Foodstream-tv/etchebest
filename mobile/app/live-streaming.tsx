import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StreamView from '@/components/StreamView';
import Button from '@/components/ui/Button';
import { withAlpha } from '@/constants/theme';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { StreamingState, useWebRTC, type WebRTCErrorCode } from '@/hooks/useWebRTC';
import { haptics } from '@/utils/haptics';
import { confirmAction } from '@/utils/confirm';
import {
    firstParam,
    parseTags,
    parseDuration,
    parseLevel,
    parseThumbnailUrl,
    sanitizeLiveDescription,
    validTitleOrNull,
} from '@/utils/webrtcParams';

type Translate = ReturnType<typeof useI18n>['t'];

const STATUS_LABEL_KEYS = {
    idle: 'broadcast.statusIdle',
    creating: 'broadcast.statusCreating',
    connecting: 'broadcast.statusConnecting',
    live: 'broadcast.statusLive',
    reconnecting: 'broadcast.statusReconnecting',
    error: 'broadcast.statusError',
    disconnected: 'broadcast.statusDisconnected',
} as const;

const PLACEHOLDER_KEYS = {
    idle: 'broadcast.cameraInactive',
    creating: 'broadcast.emptyStateCreating',
    connecting: 'broadcast.emptyStateConnecting',
    live: 'broadcast.emptyStateLive',
    reconnecting: 'broadcast.emptyStateReconnecting',
    error: 'broadcast.emptyStateError',
    disconnected: 'broadcast.emptyStateDisconnected',
} as const;

/** Human message for a failure code (the raw technical message is only a fallback). */
function describeBroadcastError(code: WebRTCErrorCode | null, message: string | null, t: Translate): string {
    switch (code) {
        case 'permission':
            return t('golive.error.permission');
        case 'device':
            return t('golive.error.device');
        case 'unsupported':
            return t('golive.error.unsupported');
        case 'conflict':
            return t('golive.error.conflict');
        case 'connection':
            return t('golive.error.connection');
        case 'ended':
            return t('golive.error.ended');
        default:
            return message || t('broadcast.emptyStateError');
    }
}

function StatusPill({ state }: Readonly<{ state: StreamingState }>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();

    const tone =
        state === 'live' || state === 'error'
            ? colors.danger
            : state === 'creating' || state === 'connecting' || state === 'reconnecting'
              ? colors.warning
              : withAlpha(colors.onBrand, 0.7);

    return (
        <View
            style={[styles.pill, { borderColor: tone, backgroundColor: withAlpha(tone, 0.13) }]}
            accessibilityRole="text"
            accessibilityLabel={t(STATUS_LABEL_KEYS[state])}
            testID="status-pill"
        >
            <View style={[styles.pillDot, { backgroundColor: tone }]} />
            <Text style={[styles.pillText, { color: tone }]}>{t(STATUS_LABEL_KEYS[state])}</Text>
        </View>
    );
}

function Placeholder({ state }: Readonly<{ state: StreamingState }>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const loading = state === 'creating' || state === 'connecting' || state === 'reconnecting';

    return (
        <View style={styles.placeholder}>
            {loading ? (
                <ActivityIndicator size="large" color={colors.orange} />
            ) : (
                <Ionicons name="videocam-outline" size={64} color={withAlpha(colors.onBrand, 0.7)} />
            )}
            <Text style={styles.placeholderText}>{t(PLACEHOLDER_KEYS[state])}</Text>
        </View>
    );
}

function RoundControl({
    icon,
    label,
    onPress,
    active = false,
    disabled = false,
    testID,
}: Readonly<{
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress: () => void;
    active?: boolean;
    disabled?: boolean;
    testID?: string;
}>) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active, disabled }}
            testID={testID}
            style={[styles.roundControl, active && styles.roundControlActive, disabled && { opacity: 0.4 }]}
        >
            <Ionicons name={icon} size={22} color={active ? colors.danger : colors.onBrand} />
        </Pressable>
    );
}

export default function LiveStreamingScreen() {
    const router = useRouter();
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const params = useLocalSearchParams<{
        roomId?: string | string[];
        mode?: string | string[];
        title?: string | string[];
        description?: string | string[];
        tags?: string | string[];
        level?: string | string[];
        durationMinutes?: string | string[];
        thumbnailUrl?: string | string[];
    }>();

    const isHost = firstParam(params.mode) !== 'join';
    const targetRoomId = firstParam(params.roomId);
    // Params can be tampered with (deep links): validate again, never trust them.
    const liveTitle = validTitleOrNull(firstParam(params.title));
    const liveDescription = sanitizeLiveDescription(firstParam(params.description));
    const liveTags = parseTags(firstParam(params.tags));
    const liveLevel = parseLevel(firstParam(params.level));
    const liveDuration = parseDuration(firstParam(params.durationMinutes));
    const liveThumbnail = parseThumbnailUrl(firstParam(params.thumbnailUrl));
    const hostsExistingRoom = isHost && !!targetRoomId;
    const canStartHost = hostsExistingRoom || liveTitle !== null;

    const {
        state,
        roomId,
        localStream,
        remoteStreams,
        error,
        errorCode,
        isAudioMuted,
        isVideoMuted,
        isFrontCamera,
        startLive,
        hostExistingRoom,
        joinAsCoStreamer,
        stopLive,
        toggleAudio,
        toggleVideo,
        switchCamera,
    } = useWebRTC();

    const [hasStarted, setHasStarted] = useState(false);
    const autoJoinedRef = useRef<string | null>(null);

    const active = state === 'creating' || state === 'connecting' || state === 'live' || state === 'reconnecting';
    const failed = state === 'error' || state === 'disconnected';

    const primaryRemoteStream =
        remoteStreams.find((stream: any) => {
            const videoTracks = typeof stream?.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
            return videoTracks.some((track: any) => track?.readyState === 'live' && track?.muted === false);
        }) ??
        remoteStreams.find((stream: any) => {
            const videoTracks = typeof stream?.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
            return videoTracks.some((track: any) => track?.readyState === 'live');
        }) ??
        remoteStreams[0] ??
        null;

    const showRemotePip = !!localStream && !!primaryRemoteStream;

    const primaryRemoteRenderKey = primaryRemoteStream
        ? `${(primaryRemoteStream as any).id}-${((primaryRemoteStream as any).getVideoTracks?.() || [])
              .map((track: any) => `${track.id}:${track.readyState}:${track.muted}`)
              .join('|')}`
        : 'no-remote';

    const leaveScreen = useCallback(() => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    }, [router]);

    const reportedLiveRef = useRef(false);
    useEffect(() => {
        if (state === 'live' && !reportedLiveRef.current) haptics.success();
        reportedLiveRef.current = state === 'live';
    }, [state]);

    // Auto-join once per room (the retry button re-joins explicitly, it never re-arms this effect).
    useEffect(() => {
        if (isHost || !targetRoomId || autoJoinedRef.current === targetRoomId) return;
        autoJoinedRef.current = targetRoomId;
        setHasStarted(true);
        void joinAsCoStreamer(targetRoomId);
    }, [isHost, targetRoomId, joinAsCoStreamer]);

    const handleStartLive = useCallback(async () => {
        haptics.tap();
        // The hook ignores a second start while one is running; the button is disabled as well.
        setHasStarted(true);
        if (hostsExistingRoom && targetRoomId) {
            await hostExistingRoom(targetRoomId);
            return;
        }
        if (!liveTitle) return;
        await startLive(liveTitle, {
            title: liveTitle,
            description: liveDescription || undefined,
            tags: liveTags,
            level: liveLevel,
            durationMinutes: liveDuration,
            thumbnailUrl: liveThumbnail,
        });
    }, [hostExistingRoom, hostsExistingRoom, liveDescription, liveDuration, liveLevel, liveTags, liveThumbnail, liveTitle, startLive, targetRoomId]);

    const handleRetry = useCallback(() => {
        if (isHost) {
            void handleStartLive();
        } else if (targetRoomId) {
            void joinAsCoStreamer(targetRoomId);
        }
    }, [handleStartLive, isHost, joinAsCoStreamer, targetRoomId]);

    // Set once the user confirmed leaving, so the navigation guard below lets that exit through.
    const leavingRef = useRef(false);

    const endAndLeave = useCallback(async () => {
        leavingRef.current = true;
        await stopLive();
        leaveScreen();
    }, [leaveScreen, stopLive]);

    /** Stopping a host live ends it for everybody: always ask while something is running. */
    const requestLeave = useCallback(() => {
        if (!active) {
            void endAndLeave();
            return;
        }
        haptics.warning();
        confirmAction({
            title: t(isHost ? 'golive.stopConfirmTitle' : 'golive.leaveConfirmTitle'),
            message: t(isHost ? 'golive.stopConfirmHost' : 'golive.leaveConfirmJoin'),
            confirmLabel: t(isHost ? 'golive.stopConfirmAction' : 'broadcast.leave'),
            cancelLabel: t('common.cancel'),
            destructive: true,
            onConfirm: () => {
                void endAndLeave();
            },
        });
    }, [active, endAndLeave, isHost, t]);

    // Any "go back" while live (iOS swipe-back, Android back gesture, header back, hardware back):
    // same confirmation as the on-screen controls. Replace/reset (e.g. session expired) pass through,
    // the hook releases the camera and the room on unmount anyway.
    const navigation = useNavigation();
    const guardRef = useRef({ active, requestLeave });
    useEffect(() => {
        guardRef.current = { active, requestLeave };
    });
    useEffect(() => {
        navigation.setOptions({ gestureEnabled: !active });
    }, [active, navigation]);
    useEffect(() => {
        return navigation.addListener('beforeRemove', (event: { data: { action: { type: string } }; preventDefault: () => void }) => {
            if (leavingRef.current || !guardRef.current.active) return;
            if (!['GO_BACK', 'POP', 'POP_TO_TOP'].includes(event.data.action.type)) return;
            event.preventDefault();
            guardRef.current.requestLeave();
        });
    }, [navigation]);

    // Android hardware back: same confirmation as the on-screen controls.
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!active) return false; // let the navigator go back; the hook releases everything on unmount
            requestLeave();
            return true;
        });
        return () => subscription.remove();
    }, [active, requestLeave]);

    let mainVideo: React.ReactNode;
    if (localStream) {
        mainVideo = (
            <StreamView
                key={`local-main-${(localStream as any)?.id ?? 'stream'}`}
                stream={localStream as unknown as MediaStream}
                style={styles.mainVideo}
                objectFit="cover"
                mirror={isFrontCamera}
                zOrder={0}
            />
        );
    } else if (primaryRemoteStream) {
        mainVideo = (
            <StreamView
                key={primaryRemoteRenderKey}
                stream={primaryRemoteStream as unknown as MediaStream}
                style={styles.mainVideo}
                objectFit="cover"
                zOrder={20}
            />
        );
    } else {
        mainVideo = <Placeholder state={state} />;
    }

    const missingRoom = !isHost && !targetRoomId;
    let errorMessage: string | null = null;
    if (missingRoom) {
        errorMessage = t('golive.missingRoom');
    } else if (isHost && !canStartHost && !hasStarted) {
        errorMessage = t('studio.error.titleRequired');
    } else if (error) {
        errorMessage = describeBroadcastError(errorCode, error, t);
    }

    const roomLabel = roomId ? `${t('broadcast.roomLabel')} ${roomId.slice(0, 8)}…` : null;
    const headerTitle = isHost ? t('broadcast.modeHost') : t('golive.title.join');
    // The live is recorded and published as a public replay: say so before the host goes live,
    // and keep saying it to a co-streamer while connected (joining starts on its own).
    const showRecordingNotice = (isHost && !hasStarted && state === 'idle') || (!isHost && active);

    let controls: React.ReactNode = null;
    if (isHost && !hasStarted && state === 'idle') {
        controls = (
            <Button
                label={t('broadcast.launchLive')}
                onPress={handleStartLive}
                disabled={!canStartHost}
                icon={<Ionicons name="radio-outline" size={20} color={colors.onBrand} />}
                style={styles.mainButton}
                testID="launch-live"
            />
        );
    } else if (active) {
        controls = (
            <View style={styles.controlsColumn}>
                {localStream ? (
                    <View style={styles.roundRow}>
                        <RoundControl
                            icon={isAudioMuted ? 'mic-off-outline' : 'mic-outline'}
                            label={t(isAudioMuted ? 'broadcast.unmuteMic' : 'broadcast.muteMic')}
                            active={isAudioMuted}
                            onPress={toggleAudio}
                            testID="toggle-audio"
                        />
                        <RoundControl
                            icon={isVideoMuted ? 'videocam-off-outline' : 'videocam-outline'}
                            label={t(isVideoMuted ? 'broadcast.enableCam' : 'broadcast.disableCam')}
                            active={isVideoMuted}
                            onPress={toggleVideo}
                            testID="toggle-video"
                        />
                        <RoundControl
                            icon="camera-reverse-outline"
                            label={t('golive.switchCamera')}
                            onPress={switchCamera}
                            // the native camera is stopped while the video is off
                            disabled={isVideoMuted}
                            testID="switch-camera"
                        />
                    </View>
                ) : null}
                <Button
                    label={t(isHost ? 'broadcast.stopLive' : 'broadcast.leave')}
                    variant="danger"
                    onPress={requestLeave}
                    icon={<Ionicons name="stop-circle-outline" size={20} color={colors.onBrand} />}
                    style={styles.mainButton}
                    testID="stop-live"
                />
            </View>
        );
    } else if (failed) {
        controls = (
            <Button
                label={t('common.retry')}
                variant="secondary"
                onPress={handleRetry}
                disabled={!isHost && !targetRoomId}
                icon={<Ionicons name="refresh-outline" size={20} color={colors.text} />}
                style={styles.mainButton}
                testID="retry-live"
            />
        );
    } else if (hasStarted) {
        // started but the hook did not report "creating" yet: keep the button inert, no double start
        controls = (
            <Button label={t('broadcast.launchLive')} loading disabled style={styles.mainButton} testID="launch-live" />
        );
    }

    return (
        <View style={styles.root}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <Pressable
                        onPress={requestLeave}
                        accessibilityRole="button"
                        accessibilityLabel={t('broadcast.backAria')}
                        style={styles.backButton}
                        testID="back-button"
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.onBrand} />
                    </Pressable>
                    <StatusPill state={state} />
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {headerTitle}
                        </Text>
                        {roomLabel ? (
                            <Text style={styles.roomText} numberOfLines={1}>
                                {roomLabel}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {isHost && liveTitle ? (
                    <Text style={styles.liveTitle} numberOfLines={2} testID="live-title">
                        {liveTitle}
                    </Text>
                ) : null}

                <View style={styles.videoContainer}>
                    {mainVideo}

                    {showRemotePip ? (
                        <View style={styles.pipContainer}>
                            <StreamView
                                key={`remote-pip-${primaryRemoteRenderKey}`}
                                stream={primaryRemoteStream as unknown as MediaStream}
                                style={styles.pipVideo}
                                objectFit="cover"
                                zOrder={30}
                            />
                        </View>
                    ) : null}

                    {__DEV__ ? (
                        <View style={styles.debugOverlay} pointerEvents="none">
                            <Text style={styles.debugText}>
                                {`remoteStreams=${remoteStreams.length} primary=${primaryRemoteStream ? 'yes' : 'no'} state=${state}`}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {errorMessage ? (
                    <View style={styles.errorBox} accessibilityRole="alert" testID="error-box">
                        <Ionicons name="warning-outline" size={18} color={colors.danger} />
                        <View style={styles.errorBody}>
                            <Text style={styles.errorText}>{errorMessage}</Text>
                            {errorCode === 'permission' ? (
                                <Pressable
                                    onPress={() => {
                                        void Linking.openSettings();
                                    }}
                                    accessibilityRole="link"
                                    accessibilityLabel={t('golive.openSettings')}
                                    style={styles.settingsLink}
                                    testID="open-settings"
                                >
                                    <Text style={styles.settingsLinkText}>{t('golive.openSettings')}</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    </View>
                ) : null}

                {showRecordingNotice ? (
                    <Text style={styles.recordingNotice} testID="recording-notice">
                        {t('broadcast.recordingNotice')}
                    </Text>
                ) : null}

                <View style={styles.controls}>{controls}</View>
            </SafeAreaView>
        </View>
    );
}

// The whole screen is a video surface: it stays black in both themes, text on it is white.
const useStyles = makeStyles(({ colors, radii }) => ({
    root: {
        flex: 1,
        backgroundColor: colors.video,
    },
    safe: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: withAlpha(colors.onBrand, 0.15),
        justifyContent: 'center',
        alignItems: 'center',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: radii.pill,
        borderWidth: 1,
    },
    pillDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '700',
    },
    headerInfo: {
        flex: 1,
        alignItems: 'flex-end',
    },
    headerTitle: {
        color: colors.onBrand,
        fontSize: 13,
        fontWeight: '700',
    },
    roomText: {
        color: withAlpha(colors.onBrand, 0.6),
        fontSize: 11,
    },
    liveTitle: {
        color: colors.onBrand,
        fontSize: 18,
        fontWeight: '800',
        paddingHorizontal: 16,
        paddingBottom: 4,
    },
    videoContainer: {
        flex: 1,
        borderRadius: radii.lg,
        overflow: 'hidden',
        margin: 12,
        backgroundColor: colors.video,
    },
    mainVideo: {
        flex: 1,
        borderRadius: radii.lg,
    },
    placeholder: {
        flex: 1,
        backgroundColor: withAlpha(colors.onBrand, 0.08),
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        padding: 16,
    },
    placeholderText: {
        color: withAlpha(colors.onBrand, 0.7),
        fontSize: 14,
        textAlign: 'center',
    },
    pipContainer: {
        position: 'absolute',
        top: 12,
        right: 12,
    },
    pipVideo: {
        width: 120,
        height: 90,
        borderRadius: radii.md,
        backgroundColor: colors.video,
    },
    debugOverlay: {
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: 8,
        backgroundColor: withAlpha(colors.video, 0.6),
        borderRadius: radii.sm,
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    debugText: {
        color: colors.success,
        fontSize: 10,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 12,
        backgroundColor: withAlpha(colors.danger, 0.16),
        borderRadius: radii.md,
    },
    errorBody: {
        flex: 1,
        gap: 4,
    },
    errorText: {
        color: colors.onBrand,
        fontSize: 13,
        lineHeight: 18,
    },
    settingsLink: {
        minHeight: 44,
        justifyContent: 'center',
    },
    settingsLinkText: {
        color: colors.orange,
        fontSize: 14,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    controls: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        alignItems: 'stretch',
    },
    controlsColumn: {
        gap: 14,
    },
    roundRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    roundControl: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: withAlpha(colors.onBrand, 0.16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    roundControlActive: {
        backgroundColor: withAlpha(colors.onBrand, 0.3),
    },
    mainButton: {
        alignSelf: 'stretch',
    },
    recordingNotice: {
        color: withAlpha(colors.onBrand, 0.75),
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'center',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
}));
