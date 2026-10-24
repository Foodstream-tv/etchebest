import { useEffect, useRef } from "react";

/**
 * Calls `callback` every `intervalMs` while the tab is visible. The timer is
 * stopped when the tab is hidden (no requests, no re-renders for nobody) and
 * restarted with an immediate call when it comes back. The latest `callback`
 * is always used, so it never needs to be memoised by the caller.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;

    const tick = () => {
      void callbackRef.current();
    };
    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const start = () => {
      stop();
      timer = window.setInterval(tick, intervalMs);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
