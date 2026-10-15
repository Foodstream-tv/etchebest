import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Text, View } from 'react-native';

import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { toDateString } from '@/utils/studioSchedule';

type Props = {
    /** Local file or public image url; empty shows a placeholder. */
    imageUri: string;
    title: string;
    tags: readonly string[];
    date: string;
    time: string;
};

/** "YYYY-MM-DD" -> localized date, or the raw value when it is not a real date (web `formatPreviewDate`). */
export function formatPreviewDate(value: string, fallback: string, locale: 'fr' | 'en'): string {
    if (!value) return fallback;
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    const [y, m, d] = parts.map(Number);
    const parsed = new Date(y, m - 1, d);
    if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return value;
    return parsed.toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR');
}

/** Live card as the viewers will see it (web `StudioPreviewCard`). */
export default function StudioPreviewCard({ imageUri, title, tags, date, time }: Readonly<Props>) {
    const { t, locale } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const today = toDateString(new Date());
    const dateLabel = date === today ? t('common.today') : formatPreviewDate(date, t('common.today'), locale);

    return (
        <Card style={styles.card} testID="studio-preview">
            <View style={styles.inner}>
                <Text style={styles.heading} accessibilityRole="header">
                    {t('studio.broadcast.preview')}
                </Text>
                <View style={styles.media}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.image} accessibilityLabel={t('studio.broadcast.previewAlt', { title })} testID="preview-image" />
                    ) : (
                        <View style={[styles.image, styles.placeholder]} testID="preview-placeholder">
                            <Ionicons name="image-outline" size={40} color={colors.placeholder} />
                        </View>
                    )}
                    <Badge label="LIVE" tone="gradient" style={styles.badge} />
                </View>
                <View style={styles.body}>
                    {tags.length > 0 ? (
                        <View style={styles.tags} accessibilityLabel={t('watch.liveTagsAria')}>
                            {tags.map((tag) => (
                                <Badge key={tag} label={tag} tone="soft" />
                            ))}
                        </View>
                    ) : null}
                    <Text style={styles.title} numberOfLines={3} testID="preview-title">
                        {title}
                    </Text>
                    <Text style={styles.meta}>{`${t('studio.preview.byYou')} • ${dateLabel}, ${time}`}</Text>
                </View>
            </View>
        </Card>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    card: {
        width: '100%',
    },
    inner: {
        padding: 14,
        gap: 12,
    },
    heading: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    media: {
        borderRadius: radii.lg,
        overflow: 'hidden',
        backgroundColor: colors.surfaceStrong,
    },
    image: {
        width: '100%',
        aspectRatio: 16 / 9,
    },
    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: 10,
        left: 10,
    },
    body: {
        gap: 8,
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    title: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    meta: {
        color: colors.muted,
        fontSize: 12,
    },
}));
