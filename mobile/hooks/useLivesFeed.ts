import { useCallback, useEffect, useRef, useState } from 'react';

import { getLives, LiveDTO, LiveStatusFilter } from '@/services/lives';

import { usePolling } from './usePolling';

type UseLivesFeedParams = {
    q: string;
    tag: string | readonly string[];
    status: LiveStatusFilter;
    pageSize?: number;
    /** Page-1 refresh cadence while the screen is focused (web: 10 s). 0 disables polling. */
    pollMs?: number;
    /** Keep only some lives (e.g. replays that really have a recording) */
    filter?: (live: LiveDTO) => boolean;
};

export type LivesFeed = {
    lives: LiveDTO[];
    total: number;
    /** First load / filter change: nothing to show yet */
    loading: boolean;
    refreshing: boolean;
    loadingMore: boolean;
    /** Error with nothing to show (a failed background refresh keeps the previous list) */
    error: string | null;
    /** The caught error behind `error`, to describe it precisely (offline, 404, 5xx…) */
    errorCause: unknown;
    loadMoreError: boolean;
    hasMore: boolean;
    refresh: () => Promise<void>;
    loadMore: () => Promise<void>;
};

const DEFAULT_PAGE_SIZE = 12;

function mergeById(head: LiveDTO[], tail: LiveDTO[]): LiveDTO[] {
    const seen = new Set(head.map((live) => live.id));
    return [...head, ...tail.filter((live) => !seen.has(live.id))];
}

/**
 * Paginated + polled list of lives (Lives and Replays tabs, web `watch/page.tsx`).
 * Responses that arrive after the filters changed (or after unmount) are discarded.
 */
export function useLivesFeed({ q, tag, status, pageSize = DEFAULT_PAGE_SIZE, pollMs = 10_000, filter }: UseLivesFeedParams): LivesFeed {
    const tagKey = Array.isArray(tag) ? tag.join('\n') : (tag as string);
    const paramsKey = `${q}|${tagKey}|${status}|${pageSize}`;

    const [lives, setLives] = useState<LiveDTO[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorCause, setErrorCause] = useState<unknown>(undefined);
    const [loadMoreError, setLoadMoreError] = useState(false);

    const paramsKeyRef = useRef(paramsKey);
    const pageRef = useRef(1);
    const loadingMoreRef = useRef(false);
    const livesRef = useRef<LiveDTO[]>([]);
    const filterRef = useRef(filter);
    const queryRef = useRef({ q, tag, status, pageSize });

    useEffect(() => {
        filterRef.current = filter;
        queryRef.current = { q, tag, status, pageSize };
    });

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // New filters: forget the previous list so stale cards never flash under a new query.
    useEffect(() => {
        paramsKeyRef.current = paramsKey;
        pageRef.current = 1;
        livesRef.current = [];
        loadingMoreRef.current = false;
        setLives([]);
        setTotal(0);
        setError(null);
        setErrorCause(undefined);
        setLoadMoreError(false);
        setLoadingMore(false);
        setLoading(true);
    }, [paramsKey]);

    const isCurrent = (key: string) => mountedRef.current && paramsKeyRef.current === key;

    const fetchFirstPage = useCallback(async () => {
        const key = paramsKeyRef.current;
        const query = queryRef.current;
        try {
            const res = await getLives({ q: query.q, tag: query.tag, status: query.status, page: 1, limit: query.pageSize });
            if (!isCurrent(key)) return;

            const fresh = filterRef.current ? res.lives.filter(filterRef.current) : res.lives;
            // Keep already-loaded further pages below the refreshed first page.
            const next = pageRef.current > 1 ? mergeById(fresh, livesRef.current) : fresh;
            livesRef.current = next;
            setLives(next);
            setTotal(res.total);
            setError(null);
            setErrorCause(undefined);
        } catch (err) {
            if (!isCurrent(key)) return;
            // A failed background refresh must not wipe what the user is reading.
            if (livesRef.current.length === 0) {
                setError(err instanceof Error ? err.message : 'error');
                setErrorCause(err);
            }
        } finally {
            if (isCurrent(key)) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    usePolling(fetchFirstPage, pollMs > 0 ? pollMs : 24 * 60 * 60 * 1000, [paramsKey]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        pageRef.current = 1;
        await fetchFirstPage();
    }, [fetchFirstPage]);

    const loadMore = useCallback(async () => {
        if (loadingMoreRef.current) return;
        const key = paramsKeyRef.current;
        const query = queryRef.current;
        const nextPage = pageRef.current + 1;

        loadingMoreRef.current = true;
        setLoadingMore(true);
        setLoadMoreError(false);
        try {
            const res = await getLives({ q: query.q, tag: query.tag, status: query.status, page: nextPage, limit: query.pageSize });
            if (!isCurrent(key)) return;

            const incoming = filterRef.current ? res.lives.filter(filterRef.current) : res.lives;
            const merged = mergeById(livesRef.current, incoming);
            pageRef.current = nextPage;
            livesRef.current = merged;
            setLives(merged);
            setTotal(res.total);
        } catch {
            if (isCurrent(key)) setLoadMoreError(true);
        } finally {
            loadingMoreRef.current = false;
            if (isCurrent(key)) setLoadingMore(false);
        }
    }, []);

    return {
        lives,
        total,
        loading,
        refreshing,
        loadingMore,
        error,
        errorCause,
        loadMoreError,
        // With a client-side filter the loaded count no longer maps to the server total: count pages instead.
        hasMore: filter ? pageRef.current * pageSize < total : lives.length < total,
        refresh,
        loadMore,
    };
}
