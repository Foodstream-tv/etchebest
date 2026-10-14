import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';

import Avatar from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import Screen from '@/components/ui/Screen';
import SearchBar from '@/components/ui/SearchBar';
import Skeleton from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getPublicMediaUrl } from '@/utils/media';
import { globalSearch, SearchResponse, userImage } from '@/services/social';

type SearchState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; cause: unknown }
    | { status: 'done'; results: SearchResponse };

/** Global search (web top-nav dropdown): chefs and lives, as-you-type with a 250 ms debounce. */
export default function SearchScreen() {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();
    const router = useRouter();

    const [query, setQuery] = useState('');
    const [state, setState] = useState<SearchState>({ status: 'idle' });
    const debounced = useDebouncedValue(query.trim(), 250);
    const requestId = useRef(0);

    useEffect(() => {
        const id = ++requestId.current;
        if (!debounced) {
            setState({ status: 'idle' });
            return;
        }

        setState({ status: 'loading' });
        globalSearch(debounced)
            .then((results) => {
                if (id === requestId.current) setState({ status: 'done', results });
            })
            .catch((err: unknown) => {
                if (id === requestId.current) {
                    setState({ status: 'error', cause: err });
                }
            });

        // Invalidate in-flight work when the query changes or the screen unmounts.
        return () => {
            requestId.current++;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounced]);

    const openUser = (id: string) => {
        Keyboard.dismiss();
        router.push({ pathname: '/profile/[id]', params: { id } } as never);
    };
    const openLive = (roomId: string | undefined, title: string) => {
        if (!roomId) return;
        Keyboard.dismiss();
        router.push({ pathname: '/live-viewer', params: { roomId, roomName: title } } as never);
    };

    const results = state.status === 'done' ? state.results : null;
    const hasResults = Boolean(results && (results.users.length > 0 || results.lives.length > 0));

    return (
        <Screen testID="search-screen">
            <View style={styles.bar}>
                <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <SearchBar testID="search-input" value={query} onChangeText={setQuery} placeholder={t('nav.searchPlaceholder')} style={styles.input} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                {state.status === 'idle' ? <EmptyState icon="search-outline" title={t('search.title')} description={t('search.hint')} testID="search-idle" /> : null}

                {state.status === 'loading' ? (
                    <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
                        {[0, 1, 2].map((key) => (
                            <Skeleton key={key} height={56} radius={16} />
                        ))}
                    </View>
                ) : null}

                {state.status === 'error' ? <ErrorState title={t('search.error')} error={state.cause} onRetry={() => setQuery((current) => `${current} `.trimEnd())} testID="search-error" /> : null}

                {results && !hasResults ? <EmptyState icon="search-outline" title={t('nav.noResults')} testID="search-empty" /> : null}

                {results && results.users.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('nav.chefs')}</Text>
                        <Card compact>
                            {results.users.map((chef, index) => {
                                // never fall back to the e-mail: it is another user's private data
                                const name = chef.username || t('nav.chefRole');
                                return (
                                    <Pressable
                                        key={chef.id}
                                        onPress={() => openUser(chef.id)}
                                        style={[styles.row, index > 0 && styles.rowDivider]}
                                        accessibilityRole="button"
                                        accessibilityLabel={name}
                                        testID={`result-user-${chef.id}`}
                                    >
                                        <Avatar uri={userImage(chef)} name={name} size={44} />
                                        <View style={styles.rowTexts}>
                                            <Text style={styles.rowTitle} numberOfLines={1}>
                                                {name}
                                            </Text>
                                            <Text style={styles.rowSubtitle}>{t('nav.chefRole')}</Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </Card>
                    </View>
                ) : null}

                {results && results.lives.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('search.livesHeading')}</Text>
                        <Card compact>
                            {results.lives.map((live, index) => {
                                const title = live.title || t('nav.untitledLive');
                                const thumbnail = getPublicMediaUrl(live.thumbnailUrl || live.thumbnail_url);
                                const dish = live.dishName || live.dish_name;
                                return (
                                    <Pressable
                                        key={live.id}
                                        onPress={() => openLive(live.room_id, title)}
                                        style={[styles.row, index > 0 && styles.rowDivider]}
                                        accessibilityRole="button"
                                        accessibilityLabel={title}
                                        testID={`result-live-${live.id}`}
                                    >
                                        <View style={styles.thumb}>
                                            {thumbnail ? <Image source={{ uri: thumbnail }} style={styles.thumbImage} resizeMode="cover" /> : <Ionicons name="restaurant-outline" size={20} color={colors.muted} />}
                                        </View>
                                        <View style={styles.rowTexts}>
                                            <Text style={styles.rowTitle} numberOfLines={1}>
                                                {title}
                                            </Text>
                                            {dish ? <Text style={styles.rowSubtitle}>{dish}</Text> : null}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </Card>
                    </View>
                ) : null}
            </ScrollView>
        </Screen>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    back: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceStrong,
    },
    input: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 32,
        gap: 20,
    },
    skeletons: {
        gap: 10,
    },
    section: {
        gap: 8,
    },
    sectionTitle: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        paddingHorizontal: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        minHeight: 64,
    },
    rowDivider: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    rowTexts: {
        flex: 1,
    },
    rowTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
    },
    rowSubtitle: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 2,
    },
    thumb: {
        width: 64,
        height: 44,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceStrong,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
}));
