import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import LivesList from '@/components/ui/LivesList';
import Screen from '@/components/ui/Screen';
import SearchBar from '@/components/ui/SearchBar';
import { ALL_TAG, LIVE_TAGS } from '@/constants/tags';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLivesFeed } from '@/hooks/useLivesFeed';
import { LiveDTO } from '@/services/lives';

/** An ended live without a recording would only open a "replay not ready" card. */
export const hasRecording = (live: LiveDTO): boolean => Boolean(live.has_replay || live.replay_url);

export default function ReplaysScreen() {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();
    const router = useRouter();

    const [query, setQuery] = useState('');
    const [tag, setTag] = useState(ALL_TAG);

    const debouncedQuery = useDebouncedValue(query.trim(), 350);
    // Ended lives rarely change: poll slowly.
    const feed = useLivesFeed({ q: debouncedQuery, tag: tag === ALL_TAG ? [] : [tag], status: 'ended', pollMs: 60_000, filter: hasRecording });

    const openReplay = useCallback(
        (live: LiveDTO) => router.push({ pathname: '/live-viewer', params: { roomId: live.room_id, roomName: live.title } } as never),
        [router]
    );

    // The server total includes lives without a recording: only announce a count when everything is loaded.
    const count = feed.lives.length;
    const header = (
        <View style={styles.header}>
            <View style={styles.badge}>
                <Ionicons name="play-circle" size={14} color={colors.orangeText} />
                <Text style={styles.badgeText}>{t('replays.badge')}</Text>
            </View>
            <Text style={styles.title} accessibilityRole="header">
                {t('replays.heroTitle')}
            </Text>
            <Text style={styles.description}>{t('replays.heroDesc')}</Text>
            {!feed.loading && !feed.hasMore && count > 0 ? (
                <Text style={styles.count}>{t('replays.count', { count, plural: count > 1 ? 's' : '' })}</Text>
            ) : null}

            <Card style={styles.filters}>
                <SearchBar testID="replays-search" value={query} onChangeText={setQuery} placeholder={t('replays.searchPlaceholder')} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tags}>
                    {[ALL_TAG, ...LIVE_TAGS].map((item) => (
                        <Chip key={item} label={item === ALL_TAG ? t('replays.tagAll') : item} active={tag === item} onPress={() => setTag(item)} testID={`tag-${item}`} />
                    ))}
                </ScrollView>
            </Card>
        </View>
    );

    return (
        <Screen testID="replays-screen">
            <LivesList
                feed={feed}
                onOpen={openReplay}
                header={header}
                emptyIcon="play-circle-outline"
                emptyTitle={t('replays.emptyTitle')}
                emptyDescription={t('replays.emptyDesc')}
            />
        </Screen>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    header: {
        paddingTop: 12,
        paddingBottom: 16,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: colors.orangeSoft,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.pill,
        marginBottom: 12,
    },
    badgeText: {
        color: colors.orangeText,
        fontSize: 13,
        fontWeight: '600',
    },
    title: {
        color: colors.text,
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.6,
        lineHeight: 32,
    },
    description: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 21,
        marginTop: 8,
    },
    count: {
        color: colors.orangeText,
        fontSize: 13,
        fontWeight: '600',
        marginTop: 10,
    },
    filters: {
        marginTop: 18,
        padding: 12,
        gap: 12,
    },
    tags: {
        gap: 8,
        paddingRight: 8,
    },
}));
