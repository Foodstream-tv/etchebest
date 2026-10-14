import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import AppHeader from '@/components/home/AppHeader';
import FiltersSheet from '@/components/home/FiltersSheet';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LiveCard from '@/components/ui/LiveCard';
import Screen from '@/components/ui/Screen';
import SearchBar from '@/components/ui/SearchBar';
import SectionHeader from '@/components/ui/SectionHeader';
import Skeleton from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { HOME_CATEGORIES, TAGS_SEPARATOR } from '@/constants/tags';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePolling } from '@/hooks/usePolling';
import { getLives, liveHostImage, LiveDTO } from '@/services/lives';

const FEATURED_COUNT = 4;
const POLL_MS = 15_000;

type CreatorEntry = { id: string; name: string; image?: string };

/** Distinct hosts of the lives currently on the platform ("Chefs à découvrir"). */
export function creatorsFromLives(lives: readonly LiveDTO[]): CreatorEntry[] {
    const seen = new Map<string, CreatorEntry>();
    for (const live of lives) {
        const id = live.user?.id;
        if (!id || seen.has(id)) continue;
        seen.set(id, { id, name: live.user?.username || 'Foodstream', image: liveHostImage(live) });
    }
    return Array.from(seen.values());
}

export default function HomeScreen() {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();
    const router = useRouter();

    const [query, setQuery] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [lives, setLives] = useState<LiveDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<unknown>(null);

    const livesRef = useRef<LiveDTO[]>([]);
    const debouncedQuery = useDebouncedValue(query.trim(), 350);
    const tagsKey = tags.join('\n');

    const load = useCallback(async () => {
        try {
            // scheduled + live: featured = the live ones, creators = hosts of both
            const page = await getLives({ q: debouncedQuery, tag: tags, limit: 24 });
            livesRef.current = page.lives;
            setLives(page.lives);
            setError(null);
        } catch (err) {
            // keep the previous list on a background failure
            if (livesRef.current.length === 0) {
                setError(err);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQuery, tagsKey]);

    usePolling(load, POLL_MS, [debouncedQuery, tagsKey]);

    const featured = useMemo(() => lives.filter((live) => live.status === 'live').slice(0, FEATURED_COUNT), [lives]);
    const creators = useMemo(() => creatorsFromLives(lives), [lives]);
    const filtersActive = debouncedQuery.length > 0 || tags.length > 0;

    const openLives = useCallback(
        (params?: { q?: string; tag?: string; tags?: string }) => router.push({ pathname: '/(tabs)/lives', params } as never),
        [router]
    );
    const openLive = useCallback(
        (live: LiveDTO) => router.push({ pathname: '/live-viewer', params: { roomId: live.room_id, roomName: live.title } } as never),
        [router]
    );

    const submitSearch = () => openLives({ q: query.trim() || undefined, tags: tags.length > 0 ? tags.join(TAGS_SEPARATOR) : undefined });

    return (
        <Screen testID="home-screen">
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            void load();
                        }}
                        tintColor={colors.orange}
                    />
                }
            >
                <AppHeader />

                <View style={styles.hero}>
                    <Text style={styles.heroTitle} accessibilityRole="header">
                        {t('home.hero.title')}
                    </Text>
                    <Text style={styles.heroSubtitle}>{t('home.hero.subtitle')}</Text>

                    <Card style={styles.searchCard}>
                        <SearchBar
                            testID="home-search"
                            value={query}
                            onChangeText={setQuery}
                            placeholder={t('home.hero.searchPlaceholder')}
                            onSubmit={submitSearch}
                        />
                        <View style={styles.searchActions}>
                            <Button label={t('home.hero.discover')} onPress={submitSearch} style={styles.discover} testID="home-discover" />
                            <Pressable
                                onPress={() => setFiltersOpen(true)}
                                style={[styles.filterButton, tags.length > 0 && styles.filterButtonActive]}
                                accessibilityRole="button"
                                accessibilityLabel={t('home.hero.filters')}
                                testID="home-filters"
                            >
                                <Ionicons name="options-outline" size={20} color={tags.length > 0 ? colors.onBrand : colors.text} />
                                {tags.length > 0 ? <Text style={styles.filterCount}>{tags.length}</Text> : null}
                            </Pressable>
                        </View>
                    </Card>
                </View>

                <View style={styles.section}>
                    <SectionHeader
                        tag={t('common.live')}
                        tagIcon="flame"
                        title={t('home.featured.title')}
                        subtitle={t('home.featured.desc')}
                        actionLabel={t('home.featured.viewAll')}
                        onAction={() => openLives({ q: debouncedQuery || undefined, tags: tags.length > 0 ? tags.join(TAGS_SEPARATOR) : undefined })}
                    />
                    {loading ? (
                        <View accessibilityRole="progressbar" accessibilityLabel={t('home.featured.loadingAria')} style={styles.skeletons}>
                            {[0, 1].map((key) => (
                                <Card key={key}>
                                    <Skeleton height={170} radius={0} />
                                    <View style={styles.skeletonBody}>
                                        <Skeleton height={16} width="75%" />
                                        <Skeleton height={12} width="45%" />
                                    </View>
                                </Card>
                            ))}
                        </View>
                    ) : error && featured.length === 0 ? (
                        <Card>
                            <ErrorState title={t('watch.loadError')} error={error} onRetry={() => void load()} testID="home-error" />
                        </Card>
                    ) : featured.length > 0 ? (
                        <View style={styles.liveList}>
                            {featured.map((live) => (
                                <LiveCard key={live.id} live={live} onPress={openLive} />
                            ))}
                        </View>
                    ) : (
                        <Card>
                            <EmptyState
                                icon="radio-outline"
                                title={t('home.featured.empty')}
                                description={filtersActive ? t('home.empty') : t('home.hero.noLiveDesc')}
                                actionLabel={filtersActive ? t('home.hero.resetFilters') : t('home.hero.goToStudio')}
                                onAction={() => {
                                    if (filtersActive) {
                                        setQuery('');
                                        setTags([]);
                                    } else {
                                        router.push('/(tabs)/studio' as never);
                                    }
                                }}
                                testID="home-empty"
                            />
                        </Card>
                    )}
                </View>

                <View style={styles.section}>
                    <SectionHeader
                        title={t('home.categories.title')}
                        subtitle={t('home.categories.subtitle')}
                        actionLabel={t('home.categories.exploreAll')}
                        onAction={() => openLives()}
                    />
                    <View style={styles.categoryGrid}>
                        {HOME_CATEGORIES.map((category) => (
                            <Pressable
                                key={category.tag}
                                style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}
                                onPress={() => openLives({ tag: category.tag })}
                                accessibilityRole="button"
                                accessibilityLabel={`${t('home.categories.seeLives')}: ${t(category.labelKey)}`}
                                testID={`category-${category.tag}`}
                            >
                                <View style={styles.emojiBox}>
                                    <Text style={styles.emoji}>{category.emoji}</Text>
                                </View>
                                <Text style={styles.categoryTitle}>{t(category.labelKey)}</Text>
                                <Text style={styles.categoryDesc} numberOfLines={2}>
                                    {t(category.descKey)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {creators.length > 0 ? (
                    <View style={[styles.section, styles.lastSection]}>
                        <SectionHeader
                            tag={t('home.creators.tag')}
                            tagIcon="star"
                            title={t('home.creators.heading')}
                            subtitle={t('home.creators.subtitle')}
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.creators}>
                            {creators.map((creator) => (
                                <Pressable
                                    key={creator.id}
                                    style={styles.creator}
                                    onPress={() => router.push({ pathname: '/profile/[id]', params: { id: creator.id } } as never)}
                                    accessibilityRole="button"
                                    accessibilityLabel={creator.name}
                                    testID={`creator-${creator.id}`}
                                >
                                    <Avatar uri={creator.image} name={creator.name} size={64} />
                                    <Text style={styles.creatorName} numberOfLines={1}>
                                        {creator.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                ) : null}
            </ScrollView>

            <FiltersSheet visible={filtersOpen} value={tags} onClose={() => setFiltersOpen(false)} onApply={setTags} />
        </Screen>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    content: {
        paddingBottom: 32,
    },
    hero: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    heroTitle: {
        color: colors.text,
        fontSize: 34,
        fontWeight: '700',
        letterSpacing: -0.8,
        lineHeight: 38,
    },
    heroSubtitle: {
        color: colors.muted,
        fontSize: 15,
        lineHeight: 22,
        marginTop: 10,
    },
    searchCard: {
        marginTop: 20,
        padding: 12,
        gap: 12,
    },
    searchActions: {
        flexDirection: 'row',
        gap: 10,
    },
    discover: {
        flex: 1,
    },
    filterButton: {
        minWidth: 52,
        minHeight: 52,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
    },
    filterButtonActive: {
        backgroundColor: colors.orange,
        borderColor: colors.orange,
    },
    filterCount: {
        color: colors.onBrand,
        fontSize: 14,
        fontWeight: '700',
    },
    section: {
        paddingHorizontal: 20,
        marginTop: 32,
    },
    lastSection: {
        marginBottom: 8,
    },
    skeletons: {
        gap: 16,
    },
    skeletonBody: {
        padding: 16,
        gap: 10,
    },
    liveList: {
        gap: 16,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    categoryCard: {
        width: '48%',
        flexGrow: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radii.card,
        padding: 18,
    },
    pressed: {
        opacity: 0.85,
    },
    emojiBox: {
        width: 52,
        height: 52,
        borderRadius: radii.lg,
        backgroundColor: colors.orangeSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    emoji: {
        fontSize: 28,
    },
    categoryTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
    },
    categoryDesc: {
        color: colors.muted,
        fontSize: 13,
        lineHeight: 18,
        marginTop: 4,
    },
    creators: {
        gap: 16,
        paddingRight: 8,
    },
    creator: {
        width: 76,
        alignItems: 'center',
        gap: 8,
    },
    creatorName: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
        maxWidth: 76,
    },
}));
