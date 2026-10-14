import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ApiError } from '@/services/http';
import { followUser, isFollowingUser, unfollowUser } from '@/services/social';
import toast from '@/utils/toast';
import { haptics } from '@/utils/haptics';

type FollowButtonProps = {
    userId: string;
    /** Id of the signed-in user: the button renders nothing on one's own profile */
    currentUserId?: string | null;
    /** Display name, used in the accessibility label */
    name?: string;
    /**
     * Called with the new state as soon as the user taps (optimistic) and again with the
     * previous state if the request fails, so a parent counter can follow along.
     */
    onChange?: (isFollowing: boolean) => void;
    style?: StyleProp<ViewStyle>;
};

/** Web `FollowButton`, with an optimistic update, rollback on error and a double-tap lock. */
export default function FollowButton({ userId, currentUserId, name, onChange, style }: Readonly<FollowButtonProps>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const [following, setFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const inFlight = useRef(false);
    const mounted = useRef(true);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const isSelf = !!currentUserId && currentUserId === userId;

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (isSelf || !userId) {
            setLoading(false);
            return;
        }
        let active = true;
        setLoading(true);
        isFollowingUser(userId)
            .then((res) => {
                if (active) setFollowing(Boolean(res?.is_following));
            })
            .catch(() => {
                // Unknown state: default to "not following"; a conflict answer is reconciled on tap.
                if (active) setFollowing(false);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [userId, isSelf]);

    const toggle = useCallback(async () => {
        if (inFlight.current || loading || isSelf || !userId) return;
        inFlight.current = true;

        const previous = following;
        const next = !previous;
        setFollowing(next);
        onChangeRef.current?.(next);
        haptics.tap();

        try {
            await (next ? followUser(userId) : unfollowUser(userId));
            if (next) haptics.success();
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            const alreadyInTargetState =
                error instanceof ApiError &&
                ((next && error.status === 403 && /already following/i.test(message)) ||
                    (!next && error.status === 400 && /not following/i.test(message)));

            if (alreadyInTargetState) {
                // The server already has the wanted state: keep it, but undo the optimistic count bump.
                if (mounted.current) onChangeRef.current?.(previous);
            } else {
                if (mounted.current) {
                    setFollowing(previous);
                    onChangeRef.current?.(previous);
                }
                haptics.error();
                toast.error(t('profile.follow.error'), { force: true });
            }
        } finally {
            inFlight.current = false;
        }
    }, [following, isSelf, loading, t, userId]);

    if (isSelf) return null;

    const label = following ? t('profile.followingBtn') : t('profile.follow');
    const a11yName = name ?? '';
    const accessibilityLabel = following ? t('profile.unfollowAria', { name: a11yName }) : t('profile.followAria', { name: a11yName });

    return (
        <Button
            label={label}
            accessibilityLabel={accessibilityLabel}
            variant={following ? 'secondary' : 'primary'}
            loading={loading}
            onPress={toggle}
            style={style}
            testID="follow-button"
            icon={
                loading ? undefined : (
                    <Ionicons name={following ? 'checkmark' : 'person-add-outline'} size={18} color={following ? colors.text : colors.onBrand} />
                )
            }
        />
    );
}
