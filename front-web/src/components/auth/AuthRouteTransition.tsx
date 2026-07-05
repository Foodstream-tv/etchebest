"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

const ROUTE_ORDER: Record<string, number> = {
  "/signin": 0,
  "/forgot-password": 1,
  "/signup": 2,
};

type AuthRouteTransitionProps = Readonly<{
  children: ReactNode;
}>;

function getRouteIndex(pathname: string): number {
  return ROUTE_ORDER[pathname] ?? 0;
}

export default function AuthRouteTransition({
  children,
}: AuthRouteTransitionProps) {
  const pathname = usePathname();
  const previousPathRef = useRef(pathname);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => {
    const previousPath = previousPathRef.current;

    if (previousPath === pathname) return;

    const previousIndex = getRouteIndex(previousPath);
    const nextIndex = getRouteIndex(pathname);

    setDirection(nextIndex >= previousIndex ? "forward" : "backward");
    setTransitionKey((prev) => prev + 1);
    previousPathRef.current = pathname;
  }, [pathname]);

  const animationClass = useMemo(() => {
    return direction === "forward"
      ? "auth-page-enter-forward"
      : "auth-page-enter-backward";
  }, [direction]);

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-visible"
        aria-hidden="true"
      >
        <span className="steam-line steam-line-1" />
        <span className="steam-line steam-line-2" />
        <span className="steam-line steam-line-3" />
      </div>

      <div key={transitionKey} className={`relative z-10 ${animationClass}`}>
        {children}
      </div>
    </div>
  );
}