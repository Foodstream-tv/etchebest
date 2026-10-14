import { useCallback, useEffect, useRef, useState } from 'react';

import { getUserFollowers, getUserFollowing, UserSummary } from '@/services/social';

export type FollowListKind = 'followers' | 'following';

type Options = {
    /** Authoritative count returned by the API when a list is opened */
    onCount?: (kind: FollowListKind, count: number) => void;
};

/**
 * State machine behind the follower / following sheet: open(kind) fetches the list,
 * retry() refetches it, stale answers (another list opened meanwhile) are dropped.
 */
export function useFollowList(userId: string | null | undefined, { onCount }: Options = {}) {
    const [kind, setKind] = useState<FollowListKind | null>(null);
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const requestId = useRef(0);
    const mounted = useRef(true);
    const onCountRef = useRef(onCount);
    onCountRef.current = onCount;

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const load = useCallback(
        async (target: FollowListKind) => {
            if (!userId) return;
            const id = ++requestId.current;
            setKind(target);
            setUsers([]);
            setError(false);
            setLoading(true);
            try {
                const res = target === 'followers' ? await getUserFollowers(userId) : await getUserFollowing(userId);
                if (!mounted.current || id !== requestId.current) return;
                const list = (target === 'followers' ? res?.followers : res?.following) ?? [];
                setUsers(Array.isArray(list) ? list : []);
                if (typeof res?.count === 'number') onCountRef.current?.(target, res.count);
            } catch {
                if (mounted.current && id === requestId.current) setError(true);
            } finally {
                if (mounted.current && id === requestId.current) setLoading(false);
            }
        },
        [userId]
    );

    const close = useCallback(() => {
        requestId.current += 1; // drop any pending answer
        setKind(null);
        setLoading(false);
    }, []);

    const retry = useCallback(() => {
        if (kind) void load(kind);
    }, [kind, load]);

    return { kind, users, loading, error, open: load, close, retry };
}
