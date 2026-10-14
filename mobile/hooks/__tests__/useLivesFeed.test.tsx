import { act, renderHook, waitFor } from '@testing-library/react-native';

import { makeLive } from '@/test-utils/fixtures';
import { getLives } from '@/services/lives';

import { useLivesFeed } from '../useLivesFeed';

jest.mock('@/services/lives', () => ({
    ...jest.requireActual('@/services/lives'),
    getLives: jest.fn(),
}));

const mockedGetLives = getLives as jest.Mock;

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };
function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const page = (lives: ReturnType<typeof makeLive>[], total = lives.length) => ({ lives, total, page: 1, limit: 12 });

describe('useLivesFeed', () => {
    beforeEach(() => jest.clearAllMocks());

    it('loads the first page', async () => {
        const lives = [makeLive(), makeLive()];
        mockedGetLives.mockResolvedValue(page(lives));

        const { result } = renderHook(() => useLivesFeed({ q: '', tag: 'Tout', status: 'all', pollMs: 0 }));

        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.lives).toEqual(lives);
        expect(result.current.error).toBeNull();
        expect(mockedGetLives).toHaveBeenCalledWith({ q: '', tag: 'Tout', status: 'all', page: 1, limit: 12 });
    });

    it('reports an error when nothing could be loaded, and recovers on refresh', async () => {
        mockedGetLives.mockRejectedValueOnce(new Error('offline'));
        const { result } = renderHook(() => useLivesFeed({ q: '', tag: 'Tout', status: 'all', pollMs: 0 }));

        await waitFor(() => expect(result.current.error).toBe('offline'));
        expect(result.current.lives).toEqual([]);

        mockedGetLives.mockResolvedValue(page([makeLive()]));
        await act(async () => {
            await result.current.refresh();
        });
        expect(result.current.error).toBeNull();
        expect(result.current.lives).toHaveLength(1);
    });

    it('keeps the current list when a background refresh fails', async () => {
        mockedGetLives.mockResolvedValueOnce(page([makeLive({ title: 'kept' })]));
        const { result } = renderHook(() => useLivesFeed({ q: '', tag: 'Tout', status: 'all', pollMs: 0 }));
        await waitFor(() => expect(result.current.lives).toHaveLength(1));

        mockedGetLives.mockRejectedValueOnce(new Error('boom'));
        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.lives[0].title).toBe('kept');
        expect(result.current.error).toBeNull();
    });

    it('paginates without duplicating cards', async () => {
        const a = makeLive();
        const b = makeLive();
        const c = makeLive();
        mockedGetLives.mockResolvedValueOnce(page([a, b], 3));
        const { result } = renderHook(() => useLivesFeed({ q: '', tag: 'Tout', status: 'all', pageSize: 2, pollMs: 0 }));
        await waitFor(() => expect(result.current.lives).toHaveLength(2));
        expect(result.current.hasMore).toBe(true);

        mockedGetLives.mockResolvedValueOnce(page([b, c], 3)); // `b` shifted onto page 2
        await act(async () => {
            await result.current.loadMore();
        });

        expect(result.current.lives.map((live) => live.id)).toEqual([a.id, b.id, c.id]);
        expect(mockedGetLives).toHaveBeenLastCalledWith({ q: '', tag: 'Tout', status: 'all', page: 2, limit: 2 });
        expect(result.current.hasMore).toBe(false);
    });

    it('flags a load-more failure without dropping the list', async () => {
        mockedGetLives.mockResolvedValueOnce(page([makeLive()], 5));
        const { result } = renderHook(() => useLivesFeed({ q: '', tag: 'Tout', status: 'all', pageSize: 1, pollMs: 0 }));
        await waitFor(() => expect(result.current.lives).toHaveLength(1));

        mockedGetLives.mockRejectedValueOnce(new Error('x'));
        await act(async () => {
            await result.current.loadMore();
        });

        expect(result.current.loadMoreError).toBe(true);
        expect(result.current.lives).toHaveLength(1);
    });

    it('ignores concurrent loadMore calls', async () => {
        mockedGetLives.mockResolvedValueOnce(page([makeLive()], 5));
        const { result } = renderHook(() => useLivesFeed({ q: '', tag: 'Tout', status: 'all', pageSize: 1, pollMs: 0 }));
        await waitFor(() => expect(result.current.lives).toHaveLength(1));

        const pending = deferred<ReturnType<typeof page>>();
        mockedGetLives.mockReturnValueOnce(pending.promise);
        await act(async () => {
            void result.current.loadMore();
            void result.current.loadMore();
            pending.resolve(page([makeLive()], 5));
        });

        expect(mockedGetLives).toHaveBeenCalledTimes(2); // initial + a single next page
    });

    it('discards a stale response that arrives after the filters changed', async () => {
        const slow = deferred<ReturnType<typeof page>>();
        mockedGetLives.mockReturnValueOnce(slow.promise);
        const { result, rerender } = renderHook((props: { q: string }) => useLivesFeed({ q: props.q, tag: 'Tout', status: 'all', pollMs: 0 }), {
            initialProps: { q: 'old' },
        });

        mockedGetLives.mockResolvedValueOnce(page([makeLive({ title: 'fresh' })]));
        rerender({ q: 'new' });
        await waitFor(() => expect(result.current.lives[0]?.title).toBe('fresh'));

        await act(async () => {
            slow.resolve(page([makeLive({ title: 'stale' })]));
        });

        expect(result.current.lives.map((live) => live.title)).toEqual(['fresh']);
    });

    it('applies the client-side filter to every page', async () => {
        mockedGetLives.mockResolvedValue(page([makeLive({ has_replay: true }), makeLive({ has_replay: false })]));
        const { result } = renderHook(() =>
            useLivesFeed({ q: '', tag: 'Tout', status: 'ended', pollMs: 0, filter: (live) => Boolean(live.has_replay) })
        );
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.lives).toHaveLength(1);
    });

    it('does not update state after unmount', async () => {
        const slow = deferred<ReturnType<typeof page>>();
        mockedGetLives.mockReturnValueOnce(slow.promise);
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        const { unmount } = renderHook(() => useLivesFeed({ q: '', tag: 'Tout', status: 'all', pollMs: 0 }));

        unmount();
        await act(async () => {
            slow.resolve(page([makeLive()]));
        });

        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });
});
