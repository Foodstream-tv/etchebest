import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import Sheet from '@/components/profile/Sheet';
import { displayNameOf, safeImageUrl } from '@/components/profile/profileUtils';
import Avatar from '@/components/ui/Avatar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';
import { userImage, UserSummary } from '@/services/social';

type FollowListSheetProps = {
    visible: boolean;
    title: string;
    users: UserSummary[];
    loading?: boolean;
    error?: boolean;
    onRetry?: () => void;
    onClose: () => void;
    onSelectUser?: (user: UserSummary) => void;
};

/** Web `FollowListModal`: followers / following of a user, each row opens that user's profile. */
export default function FollowListSheet({ visible, title, users, loading = false, error = false, onRetry, onClose, onSelectUser }: Readonly<FollowListSheetProps>) {
    const styles = useStyles();
    const { t } = useI18n();

    let body: React.ReactNode;
    if (loading) {
        body = <LoadingState label={t('common.loading')} />;
    } else if (error) {
        body = <ErrorState title={t('profile.followList.error')} onRetry={onRetry} testID="follow-list-error" />;
    } else if (users.length === 0) {
        body = <EmptyState icon="people-outline" title={t('profile.noUsers')} testID="follow-list-empty" />;
    } else {
        body = (
            <FlatList
                data={users}
                keyExtractor={(user) => user.id}
                style={styles.list}
                renderItem={({ item }) => {
                    const name = displayNameOf(item, t('common.user'));
                    return (
                        <Pressable
                            onPress={() => onSelectUser?.(item)}
                            accessibilityRole="button"
                            accessibilityLabel={t('profile.openProfileAria', { name })}
                            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                        >
                            <Avatar uri={safeImageUrl(userImage(item))} name={name} size={44} />
                            <View style={styles.texts}>
                                <Text style={styles.name} numberOfLines={1}>
                                    {name}
                                </Text>
                                {item.username && item.username !== name ? (
                                    <Text style={styles.handle} numberOfLines={1}>
                                        @{item.username}
                                    </Text>
                                ) : null}
                            </View>
                        </Pressable>
                    );
                }}
            />
        );
    }

    return (
        <Sheet visible={visible} title={title} onClose={onClose} scroll={false} testID="follow-list-sheet">
            {body}
        </Sheet>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    list: {
        padding: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.lg,
    },
    pressed: {
        backgroundColor: colors.surfaceStrong,
    },
    texts: {
        flex: 1,
    },
    name: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
    },
    handle: {
        color: colors.muted,
        fontSize: 13,
    },
}));
