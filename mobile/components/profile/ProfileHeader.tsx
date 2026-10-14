import React from 'react';
import { Text, View } from 'react-native';

import FollowStats from '@/components/profile/FollowStats';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';

type ProfileHeaderProps = React.PropsWithChildren<{
    name: string;
    username?: string;
    bio?: string;
    imageUrl?: string;
    verified?: boolean;
    chef?: boolean;
    followersCount: number;
    followingCount: number;
    onOpenFollowers: () => void;
    onOpenFollowing: () => void;
    /** Centered (public profile) or left-aligned (own profile) */
    centered?: boolean;
}>;

/** Avatar, name, handle, role badges, bio and follow counters; `children` are the actions below. */
export default function ProfileHeader({
    name,
    username,
    bio,
    imageUrl,
    verified,
    chef,
    followersCount,
    followingCount,
    onOpenFollowers,
    onOpenFollowing,
    centered = false,
    children,
}: Readonly<ProfileHeaderProps>) {
    const styles = useStyles();
    const { t } = useI18n();

    return (
        <Card style={styles.card} testID="profile-header">
            <View style={[styles.top, centered && styles.topCentered]}>
                <Avatar uri={imageUrl} name={name} size={centered ? 96 : 72} />
                <View style={[styles.texts, centered && styles.textsCentered]}>
                    <Text style={[styles.name, centered && styles.centerText]} numberOfLines={2} accessibilityRole="header">
                        {name}
                    </Text>
                    {username ? <Text style={styles.handle}>@{username}</Text> : null}
                    {verified || chef ? (
                        <View style={styles.badges}>
                            {verified ? <Badge label={t('profile.verified')} tone="neutral" /> : null}
                            {chef ? <Badge label={t('profile.chef')} tone="soft" /> : null}
                        </View>
                    ) : null}
                </View>
            </View>
            {bio ? <Text style={[styles.bio, centered && styles.centerText]}>{bio}</Text> : null}
            <FollowStats
                followersCount={followersCount}
                followingCount={followingCount}
                onOpenFollowers={onOpenFollowers}
                onOpenFollowing={onOpenFollowing}
                align={centered ? 'center' : 'start'}
            />
            {children}
        </Card>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    card: {
        padding: 20,
        gap: 16,
    },
    top: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    topCentered: {
        flexDirection: 'column',
    },
    texts: {
        flex: 1,
        gap: 4,
    },
    textsCentered: {
        flex: 0,
        alignItems: 'center',
    },
    centerText: {
        textAlign: 'center',
    },
    name: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    handle: {
        color: colors.muted,
        fontSize: 14,
    },
    badges: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    bio: {
        color: colors.text,
        fontSize: 15,
        lineHeight: 22,
    },
}));
