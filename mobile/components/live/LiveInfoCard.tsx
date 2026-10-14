import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { liveHostImage, LiveDTO } from '@/services/lives';

import { pluralSuffix } from './format';

type LiveInfoCardProps = {
    title: string;
    live: LiveDTO | null;
    description: string;
    /** Subtitle line (scheduled date, archive label…) */
    subtitle?: string;
    viewers: number | null;
    participants: number | null;
    maxParticipants: number | null;
    onOpenProfile?: (userId: string) => void;
};

/** Title, host, tags, description and counters of the live (web "info" block under the player). */
export default function LiveInfoCard({
    title,
    live,
    description,
    subtitle,
    viewers,
    participants,
    maxParticipants,
    onOpenProfile,
}: Readonly<LiveInfoCardProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();

    const host = live?.user;
    const hostName = host?.username || t('watch.creator');
    const tags = live?.tags ?? [];

    return (
        <Card style={styles.card} testID="live-info-card">
            <Text style={styles.title} accessibilityRole="header">
                {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

            {host?.id ? (
                <Pressable
                    onPress={() => onOpenProfile?.(host.id)}
                    accessibilityRole="link"
                    accessibilityLabel={t('live.openProfile', { name: hostName })}
                    style={styles.host}
                    testID="live-host"
                >
                    <Avatar uri={liveHostImage({ user: host })} name={hostName} size={40} />
                    <View style={styles.hostText}>
                        <Text style={styles.hostLabel}>{t('watch.creator')}</Text>
                        <Text style={styles.hostName} numberOfLines={1}>
                            {hostName}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
            ) : null}

            {tags.length > 0 ? (
                <View style={styles.tags} accessibilityLabel={t('watch.liveTagsAria')}>
                    {tags.map((tag) => (
                        <Chip key={tag.id ?? tag.slug} label={tag.name} />
                    ))}
                </View>
            ) : null}

            {description ? <Text style={styles.description}>{description}</Text> : null}

            <View style={styles.pills}>
                {viewers !== null ? (
                    <Badge
                        tone="neutral"
                        label={t('watch.viewersCount', { count: viewers, plural: pluralSuffix(viewers) })}
                    />
                ) : null}
                {participants !== null && maxParticipants !== null ? (
                    <Badge tone="neutral" label={t('watch.room.streamersCount', { count: participants, max: maxParticipants })} />
                ) : null}
            </View>

        </Card>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    card: {
        padding: 18,
        gap: 12,
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    subtitle: {
        color: colors.muted,
        fontSize: 14,
    },
    host: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 48,
    },
    hostText: {
        flex: 1,
    },
    hostLabel: {
        color: colors.muted,
        fontSize: 12,
    },
    hostName: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    description: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 22,
    },
    pills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
}));
