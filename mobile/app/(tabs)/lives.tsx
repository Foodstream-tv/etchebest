import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import LivesList from '@/components/ui/LivesList';
import Screen from '@/components/ui/Screen';
import SearchBar from '@/components/ui/SearchBar';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { ALL_TAG, LIVE_TAGS, TAGS_SEPARATOR } from '@/constants/tags';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLivesFeed } from '@/hooks/useLivesFeed';
import { LiveDTO, LiveStatusFilter } from '@/services/lives';

type StatusTab = Extract<LiveStatusFilter, 'all' | 'live' | 'scheduled'>;

/** Route params can be string | string[] depending on the router. */
function firstParam(value: string | string[] | undefined): string {
    return (Array.isArray(value) ? value[0] : value) ?? '';
}

/** Tags arrive as `tag=BBQ` (category card) and/or `tags=Asiatique|Healthy` (several filters from Home). */
export function parseTagParams(tag: string | string[] | undefined, tags: string | string[] | undefined): string[] {
    const raw = [firstParam(tags), firstParam(tag)].join(TAGS_SEPARATOR);
    const unique = new Set(
        raw
            .split(TAGS_SEPARATOR)
            .map((item) => item.trim())
            .filter((item) => item && item !== ALL_TAG && item !== 'All')
    );
    return Array.from(unique);
}

export default function LivesScreen() {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();
    const router = useRouter();
    const params = useLocalSearchParams<{ q?: string; tag?: string; tags?: string }>();

    const [query, setQuery] = useState(firstParam(params.q));
    const [tags, setTags] = useState<string[]>(() => parseTagParams(params.tag, params.tags));
    const [tab, setTab] = useState<StatusTab>('all');

    // Home categories / search deep-link into this tab while it is already mounted.
    const paramQ = firstParam(params.q);
    const paramTagsKey = parseTagParams(params.tag, params.tags).join(TAGS_SEPARATOR);
    useEffect(() => {
        setQuery(paramQ);
        setTags(paramTagsKey ? paramTagsKey.split(TAGS_SEPARATOR) : []);
    }, [paramQ, paramTagsKey]);

    const debouncedQuery = useDebouncedValue(query.trim(), 350);
    const feed = useLivesFeed({ q: debouncedQuery, tag: tags, status: tab });

    const toggleTag = useCallback((item: string) => setTags((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item])), []);

    const tabs = useMemo(
        () => [
            { key: 'all' as const, label: t('watch.tab.all') },
            { key: 'live' as const, label: t('watch.tab.live') },
            { key: 'scheduled' as const, label: t('watch.tab.scheduled') },
        ],
        [t]
    );

    const openLive = useCallback(
        (live: LiveDTO) => router.push({ pathname: '/live-viewer', params: { roomId: live.room_id, roomName: live.title } } as never),
        [router]
    );

    const header = (
        <View style={styles.header}>
            <View style={styles.badge}>
                <Ionicons name="radio" size={14} color={colors.orangeText} />
                <Text style={styles.badgeText}>{t('watch.catalogBadge')}</Text>
            </View>
            <Text style={styles.title} accessibilityRole="header">
                {t('watch.heroTitle')}
            </Text>
            <Text style={styles.description}>{t('watch.heroDesc')}</Text>

            <Card style={styles.filters}>
                <SearchBar testID="lives-search" value={query} onChangeText={setQuery} placeholder={t('watch.searchPlaceholder')} />
                <SegmentedControl options={tabs} value={tab} onChange={setTab} accessibilityLabel={t('watch.filterStatusAria')} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tags} accessibilityLabel={t('watch.filterCategoryAria')}>
                    <Chip label={t('replays.tagAll')} active={tags.length === 0} onPress={() => setTags([])} testID={`tag-${ALL_TAG}`} />
                    {/* tags coming from Home filters that are not in the quick list stay visible and removable */}
                    {[...tags.filter((item) => !(LIVE_TAGS as readonly string[]).includes(item)), ...LIVE_TAGS].map((item) => (
                        <Chip key={item} label={item} active={tags.includes(item)} onPress={() => toggleTag(item)} testID={`tag-${item}`} />
                    ))}
                </ScrollView>
            </Card>
        </View>
    );

    return (
        <Screen testID="lives-screen">
            <LivesList feed={feed} onOpen={openLive} header={header} emptyTitle={t('watch.emptyTitle')} emptyDescription={t('watch.emptyDesc')} />
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
