import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';

type FollowStatsProps = {
    followersCount: number;
    followingCount: number;
    onOpenFollowers: () => void;
    onOpenFollowing: () => void;
    align?: 'start' | 'center';
};

/** Web `FollowStats`: two tappable counters that open the follower / following lists. */
export default function FollowStats({ followersCount, followingCount, onOpenFollowers, onOpenFollowing, align = 'start' }: Readonly<FollowStatsProps>) {
    const styles = useStyles();
    const { t } = useI18n();

    return (
        <View style={[styles.row, align === 'center' && styles.center]} accessibilityLabel={t('profile.followStatsAria')}>
            <Pressable
                onPress={onOpenFollowers}
                accessibilityRole="button"
                accessibilityLabel={t('profile.showFollowersAria', { count: followersCount, plural: followersCount > 1 ? 's' : '' })}
                style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
                testID="follow-stats-followers"
            >
                <Text style={styles.value}>{followersCount}</Text>
                <Text style={styles.label}>{t('profile.followers')}</Text>
            </Pressable>
            <Pressable
                onPress={onOpenFollowing}
                accessibilityRole="button"
                accessibilityLabel={t('profile.showFollowingAria', { count: followingCount, plural: followingCount > 1 ? 's' : '' })}
                style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
                testID="follow-stats-following"
            >
                <Text style={styles.value}>{followingCount}</Text>
                <Text style={styles.label}>{t('profile.following')}</Text>
            </Pressable>
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    center: {
        justifyContent: 'center',
    },
    stat: {
        minWidth: 88,
        minHeight: 48,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radii.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    pressed: {
        backgroundColor: colors.surfaceStrong,
    },
    value: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
    },
    label: {
        color: colors.muted,
        fontSize: 12,
    },
}));
