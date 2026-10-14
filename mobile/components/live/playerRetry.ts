/** Shared retry policy of the native and web HLS players. */

/** Auto-retries while a live has not started yet (manifest 404 / network error). */
export const MAX_LIVE_RETRIES = 10;
/** Replays are static files: fail fast. */
export const MAX_REPLAY_RETRIES = 2;
/** `hls.recoverMediaError()` is allowed this many times per load, then it is a hard failure. */
export const MAX_MEDIA_RECOVERIES = 3;
/** Gives up on a source that neither plays nor errors after this long (native player). */
export const LOAD_TIMEOUT_MS = 20_000;
/** Delay before showing the first frame, so every HLS variant has synchronised segments (web). */
export const MANIFEST_SETTLE_MS = 1200;

export type PlayerMode = 'live' | 'replay';

export function maxRetriesFor(mode: PlayerMode): number {
    return mode === 'live' ? MAX_LIVE_RETRIES : MAX_REPLAY_RETRIES;
}

/** 500 ms, 1 s, 1.5 s … capped at 5 s (same curve as the web watch page). */
export function retryDelay(attempt: number): number {
    return Math.min(500 * Math.max(1, attempt), 5000);
}

export type PlayerStatus = 'loading' | 'waiting' | 'ready' | 'error';
