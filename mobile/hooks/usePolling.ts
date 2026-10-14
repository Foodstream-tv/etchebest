import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Runs `task` immediately then every `intervalMs`, but only while the screen is
 * focused and the app is in the foreground (the web page polls /lives every 10 s;
 * on a phone that would drain battery and data in the background).
 *
 * `task` may change between renders; the latest one is always used.
 */
export function usePolling(task: () => void | Promise<void>, intervalMs: number, deps: readonly unknown[] = []): void {
    const taskRef = useRef(task);
    useEffect(() => {
        taskRef.current = task;
    });

    useFocusEffect(
        // eslint-disable-next-line react-hooks/exhaustive-deps
        useCallback(() => {
            let timer: ReturnType<typeof setInterval> | null = null;

            const run = () => {
                void Promise.resolve(taskRef.current()).catch(() => {});
            };
            const start = () => {
                if (timer) return;
                run();
                timer = setInterval(run, intervalMs);
            };
            const stop = () => {
                if (timer) clearInterval(timer);
                timer = null;
            };

            // 'unknown'/null can be reported before the first native state event: treat it as foreground.
            const isBackground = (state: string | null | undefined) => state === 'background' || state === 'inactive';

            if (!isBackground(AppState.currentState)) start();
            const sub = AppState.addEventListener('change', (state) => {
                if (isBackground(state)) stop();
                else start();
            });

            return () => {
                sub.remove();
                stop();
            };
        }, [intervalMs, ...deps])
    );
}
