import { renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { usePolling } from '../usePolling';

describe('usePolling', () => {
    let appStateListener: ((state: string) => void) | undefined;
    const remove = jest.fn();

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        appStateListener = undefined;
        jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, listener: (state: string) => void) => {
            appStateListener = listener;
            return { remove };
        }) as never);
        Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('runs immediately then on every interval', () => {
        const task = jest.fn();
        renderHook(() => usePolling(task, 1000));

        expect(task).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(3000);
        expect(task).toHaveBeenCalledTimes(4);
    });

    it('stops while the app is in the background and resumes when active again', () => {
        const task = jest.fn();
        renderHook(() => usePolling(task, 1000));
        task.mockClear();

        appStateListener?.('background');
        jest.advanceTimersByTime(5000);
        expect(task).not.toHaveBeenCalled();

        appStateListener?.('active');
        expect(task).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(1000);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('clears the timer and the listener on unmount', () => {
        const task = jest.fn();
        const { unmount } = renderHook(() => usePolling(task, 1000));
        unmount();
        task.mockClear();

        jest.advanceTimersByTime(5000);
        expect(task).not.toHaveBeenCalled();
        expect(remove).toHaveBeenCalled();
    });

    it('always calls the latest task and swallows its rejections', async () => {
        const first = jest.fn();
        const second = jest.fn().mockRejectedValue(new Error('nope'));
        const { rerender } = renderHook((props: { task: () => unknown }) => usePolling(props.task as () => void, 1000), { initialProps: { task: first } });

        rerender({ task: second });
        jest.advanceTimersByTime(1000);

        expect(second).toHaveBeenCalled();
        await Promise.resolve(); // would surface as an unhandled rejection if not caught
    });
});
