import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/LanguageContext';
import { LiveDTO } from '@/services/lives';
import { getPublicMediaUrl } from '@/utils/media';

import Badge from './Badge';

type LiveCardProps = {
    live: LiveDTO;
    onPress: (live: LiveDTO) => void;
    /** Fixed width (horizontal carousels); full width when omitted */
    width?: number;
};

export function formatScheduledDate(value: string | null | undefined, locale: 'fr' | 'en', fallback: string): string {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

/** Live tile: 16:9 thumbnail, status badge, viewer count, title and host (web `LiveGridCard`). */
export default function LiveCard({ live, onPress, width }: Readonly<LiveCardProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t, locale } = useI18n();
    const [imageFailed, setImageFailed] = useState(false);

    const author = live.user?.username || 'Foodstream';
    const title = live.title || t('nav.untitledLive');
    const isLive = live.status === 'live';
    const isScheduled = live.status === 'scheduled';
    // Thumbnails uploaded from the web Studio are relative `/api/uploads/...` paths.
    const thumbnailUrl = getPublicMediaUrl(live.thumbnail_url);
    const showThumbnail = thumbnailUrl !== '' && !imageFailed;
    const statusLabel = isLive ? t('watch.badge.live') : isScheduled ? t('watch.badge.scheduled') : t('watch.badge.replay');

    return (
        <Pressable
            onPress={() => onPress(live)}
            accessibilityRole="button"
            accessibilityLabel={t('home.card.watchAria', { title, author })}
            testID={`live-card-${live.room_id || live.id}`}
            style={({ pressed }) => [styles.card, width ? { width } : null, pressed && styles.pressed]}
        >
            <View style={styles.media}>
                {showThumbnail ? (
                    <Image source={{ uri: thumbnailUrl }} style={styles.image} resizeMode="cover" onError={() => setImageFailed(true)} />
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name="restaurant-outline" size={32} color={colors.muted} />
                    </View>
                )}
                <Badge label={statusLabel} tone={isLive ? 'gradient' : 'dark'} style={styles.statusBadge} />
                {live.dish_name ? <Badge label={live.dish_name} tone="dark" style={styles.dishBadge} /> : null}
                {isLive ? (
                    <View style={styles.viewers}>
                        <Ionicons name="eye-outline" size={13} color="#ffffff" />
                        <Text style={styles.viewersText}>{live.current_viewers ?? 0}</Text>
                    </View>
                ) : null}
            </View>
            <View style={styles.body}>
                <Text style={styles.title} numberOfLines={2}>
                    {title}
                </Text>
                <View style={styles.metaRow}>
                    <Ionicons name="person-outline" size={13} color={colors.muted} />
                    <Text style={styles.meta} numberOfLines={1}>
                        {author}
                    </Text>
                    {isScheduled ? (
                        <Text style={styles.when} numberOfLines={1}>
                            {formatScheduledDate(live.scheduled_at, locale, t('watch.upcomingDate'))}
                        </Text>
                    ) : null}
                </View>
            </View>
        </Pressable>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    card: {
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radii.card,
        overflow: 'hidden',
    },
    pressed: {
        opacity: 0.9,
        transform: [{ scale: 0.99 }],
    },
    media: {
        aspectRatio: 16 / 9,
        backgroundColor: colors.surfaceStrong,
    },
    image: {
        ...{ width: '100%', height: '100%' },
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
    },
    dishBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        maxWidth: '60%',
    },
    viewers: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.pill,
    },
    viewersText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '600',
    },
    body: {
        padding: 16,
        gap: 4,
    },
    title: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    meta: {
        flexShrink: 1,
        color: colors.muted,
        fontSize: 12,
    },
    when: {
        marginLeft: 'auto',
        color: colors.muted,
        fontSize: 12,
    },
}));
