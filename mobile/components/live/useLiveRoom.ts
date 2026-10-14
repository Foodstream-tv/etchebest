import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePolling } from '@/hooks/usePolling';
import authService, { StoredUser } from '@/services/auth';
import { ApiError } from '@/services/http';
import { getLiveByRoomId, LiveDTO } from '@/services/lives';
import { getRoom, RoomInfo } from '@/services/streaming';

/** Same cadence as the web watch page. */
export const ROOM_POLL_INTERVAL_MS = 10_000;
/** Co-streamer spots a live accepts besides its host (web: `registeredCount >= 5`). */
export const MAX_CO_STREAMERS = 5;

export type LiveStatus = 'scheduled' | 'live' | 'ended';
export type LoadError = 'notFound' | 'network' | null;

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

/** Normalizes an expo-router param (string | string[] | undefined) into a usable room id. */
export function parseRoomId(value: string | string[] | undefined): string | null {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string') return null;
    const id = raw.trim();
    return id.length > 0 && id.length <= 200 ? id : null;
}

export type LiveRoomState = {
    live: LiveDTO | null;
    room: RoomInfo | null;
    user: StoredUser | null;
    signedIn: boolean;
    /** true until the first answer (or failure) */
    loading: boolean;
    error: LoadError;
    status: LiveStatus | null;
    isHost: boolean;
    /** Registered co-streamers, host excluded */
    registeredCount: number;
    isReserved: boolean;
    isFull: boolean;
    refresh: () => Promise<void>;
    /** Forces a full reload with the loading state (retry button) */
    reload: () => Promise<void>;
};

/**
 * Live info (public) + room (needs auth, 404 while the room is not active), refreshed every ~10 s
 * while the screen is focused and the app is in the foreground. Late answers for a previous
 * `roomId` or after unmount are dropped. A failed refresh keeps the data already displayed.
 */
export function useLiveRoom(roomId: string | null): LiveRoomState {
    const [live, setLive] = useState<LiveDTO | null>(null);
    const [room, setRoom] = useState<RoomInfo | null>(null);
    const [user, setUser] = useState<StoredUser | null>(null);
    const [signedIn, setSignedIn] = useState(false);
    const [loading, setLoading] = useState(Boolean(roomId));
    const [error, setError] = useState<LoadError>(null);

    const requestRef = useRef(0);
    const hasDataRef = useRef(false);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // New room: forget the previous one.
    useEffect(() => {
        requestRef.current += 1;
        hasDataRef.current = false;
        setLive(null);
        setRoom(null);
        setError(null);
        setLoading(Boolean(roomId));
    }, [roomId]);

    const refresh = useCallback(async () => {
        if (!roomId) return;
        const request = ++requestRef.current;
        const isCurrent = () => mountedRef.current && request === requestRef.current;

        const [token, storedUser] = await Promise.all([
            authService.getToken().catch(() => null),
            authService.getUser().catch(() => null),
        ]);
        if (!isCurrent()) return;
        const authenticated = Boolean(token);

        const [liveResult, roomResult] = await Promise.allSettled([
            getLiveByRoomId(roomId),
            authenticated ? getRoom(roomId) : Promise.resolve<RoomInfo | null>(null),
        ]);
        if (!isCurrent()) return;

        setSignedIn(authenticated);
        setUser(authenticated ? storedUser : null);

        const nextRoom = roomResult.status === 'fulfilled' ? roomResult.value : null;
        if (roomResult.status === 'fulfilled' || isNotFound(roomResult.reason)) {
            setRoom(nextRoom);
        }

        if (liveResult.status === 'fulfilled') {
            setLive(liveResult.value);
            hasDataRef.current = true;
            setError(null);
        } else if (!hasDataRef.current) {
            // No live record: an active room is still watchable (web falls back to the room too).
            if (nextRoom) {
                hasDataRef.current = true;
                setError(null);
            } else {
                setError(isNotFound(liveResult.reason) ? 'notFound' : 'network');
            }
        }
        setLoading(false);
    }, [roomId]);

    usePolling(refresh, ROOM_POLL_INTERVAL_MS, [refresh]);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        await refresh();
    }, [refresh]);

    const status: LiveStatus | null = live?.status ?? (room ? 'live' : null);

    const derived = useMemo(() => {
        const hostId = room?.host || live?.user?.id;
        const isHost = Boolean(user?.id && live?.user?.id && String(user.id) === String(live.user.id));
        const participants = room?.participants ?? [];
        const registeredCount = participants.filter((p) => String(p) !== String(hostId)).length;
        const isReserved =
            Boolean(user?.id) &&
            String(user?.id) !== String(hostId) &&
            participants.some((p) => String(p) === String(user?.id));
        return { isHost, registeredCount, isReserved, isFull: registeredCount >= MAX_CO_STREAMERS };
    }, [room, live, user]);

    return { live, room, user, signedIn, loading, error, status, refresh, reload, ...derived };
}
