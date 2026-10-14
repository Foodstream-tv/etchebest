import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Linking,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

import HLSPlayer from '@/components/HLSPlayer';
import ChatPanel from '@/components/live/ChatPanel';
import { formatScheduledDate } from '@/components/live/format';
import HostScheduledCard from '@/components/live/HostScheduledCard';
import LiveInfoCard from '@/components/live/LiveInfoCard';
import { getPublicMediaUrl } from '@/components/live/media';
import ReservationCard, { ReservationMessage } from '@/components/live/ReservationCard';
import { parseRoomId, useLiveRoom } from '@/components/live/useLiveRoom';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Screen from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { getGoogleCalendarUrl, getLiveWebUrl } from '@/lib/calendar';
import { parseLiveDescription } from '@/services/lives';
import { cancelReserveRoom, getHLSUrl, reserveRoom } from '@/services/streaming';
import { showToast } from '@/utils/toast';
import { haptics } from '@/utils/haptics';

type Tab = 'chat' | 'info';

const firstParam = (value: string | string[] | undefined): string | undefined =>
    (Array.isArray(value) ? value[0] : value) || undefined;

const errorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error && error.message ? error.message : fallback;

export default function LiveViewerScreen() {
    const params = useLocalSearchParams<{ roomId?: string | string[]; roomName?: string | string[] }>();
    const roomId = parseRoomId(params.roomId);

    if (!roomId) {
        return <InvalidRoom />;
    }
    // Keyed so that every piece of state (tab, reservation message…) is reset when the room changes.
    return <LiveViewer key={roomId} roomId={roomId} roomNameParam={firstParam(params.roomName)} />;
}

function useGoBack() {
    const router = useRouter();
    return useCallback(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)' as never);
    }, [router]);
}

function InvalidRoom() {
    const { t } = useI18n();
    const goBack = useGoBack();
    return (
        <Screen plain edges={['top', 'bottom', 'left', 'right']} testID="live-viewer-invalid">
            <ViewerHeader onBack={goBack} />
            <View style={staticStyles.centered}>
                <EmptyState
                    icon="alert-circle-outline"
                    title={t('live.invalidRoom')}
                    description={t('live.invalidRoomDesc')}
                    actionLabel={t('common.back')}
                    onAction={goBack}
                    testID="live-invalid-room"
                />
            </View>
        </Screen>
    );
}

type HeaderProps = {
    title?: string;
    badge?: React.ReactNode;
    onBack: () => void;
    onShare?: () => void;
};

function ViewerHeader({ title, badge, onBack, onShare }: Readonly<HeaderProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();

    return (
        <View style={styles.header}>
            <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                style={styles.iconButton}
                hitSlop={8}
                testID="live-back"
            >
                <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
            {badge}
            <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
            </Text>
            {onShare ? (
                <Pressable
                    onPress={onShare}
                    accessibilityRole="button"
                    accessibilityLabel={t('watch.room.shareAria')}
                    style={styles.iconButton}
                    hitSlop={8}
                    testID="live-share"
                >
                    <Ionicons name="share-social-outline" size={22} color={colors.text} />
                </Pressable>
            ) : null}
        </View>
    );
}

function LiveViewer({ roomId, roomNameParam }: Readonly<{ roomId: string; roomNameParam?: string }>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t, locale } = useI18n();
    const router = useRouter();
    const goBack = useGoBack();
    const { width, height } = useWindowDimensions();

    const { live, room, user, signedIn, loading, error, status, isHost, registeredCount, isReserved, isFull, refresh, reload } =
        useLiveRoom(roomId);

    const [tab, setTab] = useState<Tab>('chat');
    const [busy, setBusy] = useState<'reserve' | 'cancel' | null>(null);
    const [reservationMessage, setReservationMessage] = useState<ReservationMessage | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const inFlightRef = useRef(false);

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const { description } = useMemo(() => parseLiveDescription(live?.description), [live?.description]);
    const title = room?.name || live?.title || roomNameParam || t('live.untitled');
    const dateLabel = formatScheduledDate(live?.scheduled_at, locale, t('watch.upcomingDate'));
    const replayUrl = useMemo(() => getPublicMediaUrl(live?.replay_url), [live?.replay_url]);
    const hasReplay = Boolean(live?.has_replay || live?.replay_url);
    const hlsUrl = useMemo(() => getHLSUrl(roomId), [roomId]);

    const showLivePlayer = status === 'live';
    const showReplayPlayer = status === 'ended' && replayUrl !== '';
    const showPlayer = showLivePlayer || showReplayPlayer;
    const landscape = showPlayer && width > height;

    // ----- navigation -----
    const openProfile = useCallback(
        (userId: string) => router.push({ pathname: '/profile/[id]', params: { id: userId } } as never),
        [router]
    );
    const openStudio = useCallback(() => router.push('/(tabs)/studio' as never), [router]);
    const openLogin = useCallback(() => router.push('/login' as never), [router]);
    const joinAsCoStreamer = useCallback(
        () => router.push({ pathname: '/live-streaming', params: { roomId, mode: 'join' } }),
        [router, roomId]
    );

    // ----- share / calendar -----
    const onShare = useCallback(async () => {
        const url = getLiveWebUrl(roomId);
        const text = `${t('live.share.text')} — ${title}`;
        try {
            await Share.share(Platform.OS === 'ios' ? { title, message: text, url } : { title, message: `${text}\n${url}` });
        } catch {
            // dismissed or unavailable: nothing to do
        }
    }, [roomId, title, t]);

    const onCalendar = useCallback(() => {
        const liveUrl = getLiveWebUrl(roomId);
        const url = getGoogleCalendarUrl({
            title: t('live.calendar.title', { title }),
            description,
            scheduledAt: live?.scheduled_at ?? '',
            liveUrl,
            joinText: description ? t('live.calendar.join', { url: liveUrl }) : t('live.calendar.joinDefault', { url: liveUrl }),
        });
        if (!url) {
            showToast(t('live.calendar.error'), 'error');
            return;
        }
        Linking.openURL(url).catch(() => showToast(t('live.calendar.error'), 'error'));
    }, [roomId, title, description, live?.scheduled_at, t]);

    // ----- reservation -----
    const onReserve = useCallback(async () => {
        if (!signedIn) {
            setReservationMessage({ text: t('watch.room.loginToReserve'), isError: true });
            return;
        }
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setBusy('reserve');
        setReservationMessage(null);
        try {
            await reserveRoom(roomId);
            haptics.success();
            if (!mountedRef.current) return;
            setReservationMessage({ text: t('watch.room.reservationSuccess') });
            await refresh().catch(() => {});
        } catch (err) {
            if (mountedRef.current) setReservationMessage({ text: errorMessage(err, t('live.reserve.error')), isError: true });
        } finally {
            inFlightRef.current = false;
            if (mountedRef.current) setBusy(null);
        }
    }, [signedIn, roomId, refresh, t]);

    const onCancelReservation = useCallback(async () => {
        if (!signedIn || inFlightRef.current) return;
        inFlightRef.current = true;
        setBusy('cancel');
        setReservationMessage(null);
        try {
            await cancelReserveRoom(roomId);
            if (!mountedRef.current) return;
            setReservationMessage({ text: t('watch.room.cancelSuccess') });
            await refresh().catch(() => {});
        } catch (err) {
            if (mountedRef.current) setReservationMessage({ text: errorMessage(err, t('live.cancel.error')), isError: true });
        } finally {
            inFlightRef.current = false;
            if (mountedRef.current) setBusy(null);
        }
    }, [signedIn, roomId, refresh, t]);

    const onPullToRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refresh();
        } finally {
            if (mountedRef.current) setRefreshing(false);
        }
    }, [refresh]);

    // ----- derived UI -----
    let badge: React.ReactNode = null;
    if (status === 'live') badge = <Badge tone="gradient" label={t('watch.badge.live')} />;
    else if (status === 'scheduled') badge = <Badge tone="soft" label={t('watch.badge.scheduled')} />;
    else if (status === 'ended') badge = <Badge tone="neutral" label={hasReplay ? t('watch.badge.replay') : t('watch.offline')} />;

    const header = <ViewerHeader title={title} badge={badge} onBack={goBack} onShare={status ? onShare : undefined} />;

    if (loading) {
        return (
            <Screen plain edges={['top', 'bottom', 'left', 'right']} testID="live-viewer">
                <ViewerHeader title={roomNameParam} onBack={goBack} />
                <View style={staticStyles.centered}>
                    <LoadingState label={t('common.loading')} />
                </View>
            </Screen>
        );
    }

    if (error || !status) {
        return (
            <Screen plain edges={['top', 'bottom', 'left', 'right']} testID="live-viewer">
                <ViewerHeader title={roomNameParam} onBack={goBack} />
                <View style={staticStyles.centered}>
                    <ErrorState
                        testID="live-error"
                        title={error === 'notFound' ? t('live.notFound') : t('live.loadError')}
                        description={error === 'notFound' ? t('live.notFoundDesc') : undefined}
                        onRetry={error === 'notFound' ? undefined : reload}
                    />
                </View>
            </Screen>
        );
    }

    const viewers = status === 'live' ? (room?.viewers ?? live?.current_viewers ?? null) : null;
    const infoCard = (
        <LiveInfoCard
            title={title}
            live={live}
            description={description || (status === 'ended' ? t('replays.noDesc') : '')}
            subtitle={
                status === 'scheduled'
                    ? t('watch.room.scheduledFor', { date: dateLabel })
                    : status === 'ended'
                      ? t('watch.room.archiveLabel')
                      : undefined
            }
            viewers={viewers}
            participants={room ? room.participants.length : null}
            maxParticipants={room ? room.maxParticipants : null}
            onOpenProfile={openProfile}
        />
    );

    // ---- scheduled / ended without player: a single scrollable page ----
    if (!showPlayer) {
        let stage: React.ReactNode;
        if (status === 'scheduled') {
            stage = isHost ? (
                <HostScheduledCard
                    dateLabel={dateLabel}
                    registeredCount={registeredCount}
                    onOpenStudio={openStudio}
                    onCalendar={onCalendar}
                />
            ) : (
                <ReservationCard
                    dateLabel={dateLabel}
                    creatorName={live?.user?.username}
                    registeredCount={registeredCount}
                    isReserved={isReserved}
                    isFull={isFull}
                    signedIn={signedIn}
                    busy={busy}
                    message={reservationMessage}
                    onReserve={onReserve}
                    onCancel={onCancelReservation}
                    onCalendar={onCalendar}
                    onSignIn={openLogin}
                />
            );
        } else {
            stage = (
                <Card style={styles.stage} testID={hasReplay ? 'replay-preparing' : 'live-offline'}>
                    <Ionicons name={hasReplay ? 'hourglass-outline' : 'videocam-off-outline'} size={32} color={colors.muted} />
                    <Text style={styles.stageText} accessibilityRole="summary">
                        {hasReplay ? t('replays.preparing') : t('watch.room.offlineOrEnded')}
                    </Text>
                </Card>
            );
        }

        return (
            <Screen plain edges={['top', 'bottom', 'left', 'right']} testID="live-viewer">
                {header}
                <ScrollView
                    contentContainerStyle={styles.pageContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} tintColor={colors.orange} />}
                >
                    {stage}
                    {infoCard}
                </ScrollView>
            </Screen>
        );
    }

    // ---- live / replay with a video player ----
    const player = (
        <View style={landscape ? styles.playerLandscape : styles.player} testID="player-container">
            <HLSPlayer
                uri={showLivePlayer ? hlsUrl : replayUrl}
                mode={showLivePlayer ? 'live' : 'replay'}
                accessibilityLabel={showLivePlayer ? t('live.player.aria') : t('live.player.replayAria')}
            />
        </View>
    );

    const canJoin =
        showLivePlayer &&
        signedIn &&
        !isHost &&
        (isReserved ||
            !(isFull || (room && room.maxParticipants > 0 && room.participants.length >= room.maxParticipants)));

    // Whatever the situation, the user is told what they can do (or why they cannot) instead of
    // seeing nothing: host, signed out, spot available, room full.
    const liveActions = showLivePlayer ? (
        <View style={styles.actions}>
            {isHost ? (
                <View style={styles.actionColumn}>
                    <Text style={styles.actionHint} testID="live-host-notice">
                        {t('live.hostNotice')}
                    </Text>
                    <Button
                        label={t('watch.room.accessHostStudio')}
                        size="sm"
                        variant="secondary"
                        icon={<Ionicons name="radio-outline" size={18} color={colors.text} />}
                        onPress={openStudio}
                        testID="live-host-studio"
                    />
                </View>
            ) : !signedIn ? (
                <Button
                    label={t('live.signInToJoin')}
                    size="sm"
                    variant="secondary"
                    icon={<Ionicons name="log-in-outline" size={18} color={colors.text} />}
                    onPress={openLogin}
                    style={styles.actionFull}
                    testID="live-signin-to-join"
                />
            ) : canJoin ? (
                <View style={styles.actionColumn}>
                    <Button
                        label={t('live.joinCoStreamer')}
                        accessibilityLabel={t('live.joinCoStreamer')}
                        icon={<Ionicons name="videocam-outline" size={20} color={colors.onBrand} />}
                        onPress={joinAsCoStreamer}
                        testID="live-join"
                    />
                    <Text style={styles.actionHint}>{t('live.joinHint')}</Text>
                </View>
            ) : (
                <Badge tone="neutral" label={t('live.roomFull')} />
            )}
        </View>
    ) : null;

    const tabs = showLivePlayer ? (
        <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel={t('live.tabsAria')}>
            {(['chat', 'info'] as const).map((key) => {
                const selected = tab === key;
                return (
                    <Pressable
                        key={key}
                        onPress={() => setTab(key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={key === 'chat' ? t('watch.room.tabChat') : t('live.tab.info')}
                        style={[styles.tab, selected && styles.tabSelected]}
                        testID={`tab-${key}`}
                    >
                        <Ionicons
                            name={key === 'chat' ? 'chatbubble-outline' : 'information-circle-outline'}
                            size={18}
                            color={selected ? colors.orangeText : colors.muted}
                        />
                        <Text style={[styles.tabLabel, { color: selected ? colors.orangeText : colors.muted }]}>
                            {key === 'chat' ? t('watch.room.tabChat') : t('live.tab.info')}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    ) : null;

    const side = showLivePlayer ? (
        <View style={styles.side}>
            {liveActions}
            {tabs}
            <View style={styles.sideBody}>
                <View style={[styles.fill, tab !== 'chat' && styles.hidden]}>
                    <ChatPanel roomId={roomId} signedIn={signedIn} username={user?.username} onSignIn={openLogin} />
                </View>
                {tab === 'info' ? (
                    <ScrollView contentContainerStyle={styles.pageContent} testID="info-tab">
                        {infoCard}
                    </ScrollView>
                ) : null}
            </View>
        </View>
    ) : (
        <ScrollView
            style={styles.side}
            contentContainerStyle={styles.pageContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} tintColor={colors.orange} />}
        >
            {infoCard}
        </ScrollView>
    );

    if (landscape) {
        return (
            <Screen plain edges={['top', 'bottom', 'left', 'right']} testID="live-viewer">
                <View style={styles.landscapeRow}>
                    {player}
                    <View style={styles.landscapeSide}>
                        {header}
                        {side}
                    </View>
                </View>
            </Screen>
        );
    }

    return (
        <Screen plain edges={['top', 'bottom', 'left', 'right']} testID="live-viewer">
            {header}
            {player}
            {side}
        </Screen>
    );
}

// Color-free layout shared by the small helper screens.
const staticStyles = {
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
} as const;

const useStyles = makeStyles(({ colors, radii }) => ({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceStrong,
        borderWidth: 1,
        borderColor: colors.border,
    },
    headerTitle: {
        flex: 1,
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
    },
    player: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: colors.video,
    },
    playerLandscape: {
        flex: 3,
        backgroundColor: colors.video,
    },
    landscapeRow: {
        flex: 1,
        flexDirection: 'row',
    },
    landscapeSide: {
        flex: 2,
    },
    side: {
        flex: 1,
    },
    sideBody: {
        flex: 1,
        padding: 12,
    },
    fill: {
        flex: 1,
    },
    hidden: {
        display: 'none',
    },
    actions: {
        paddingHorizontal: 16,
        paddingTop: 12,
        flexDirection: 'row',
    },
    actionColumn: {
        flex: 1,
        gap: 8,
    },
    actionFull: {
        flex: 1,
    },
    actionHint: {
        color: colors.muted,
        fontSize: 13,
        lineHeight: 18,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginTop: 8,
    },
    tab: {
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabSelected: {
        borderBottomColor: colors.orange,
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    pageContent: {
        padding: 16,
        gap: 16,
    },
    stage: {
        padding: 28,
        alignItems: 'center',
        gap: 12,
    },
    stageText: {
        color: colors.muted,
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
}));
