import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

// One shared answer for the whole app: asked once, when this module loads (so it is known before the first
// screen animates), and kept up to date while the system setting changes.
let reduced = false;
const listeners = new Set<() => void>();
let probed = false;
let subscription: { remove: () => void } | null = null;

function setReduced(value: boolean) {
    if (value === reduced) return;
    reduced = value;
    listeners.forEach((listener) => listener());
}

function probeOnce() {
    if (probed) return;
    probed = true;
    try {
        const probe = AccessibilityInfo?.isReduceMotionEnabled?.();
        if (probe && typeof probe.then === 'function') probe.then((value) => setReduced(Boolean(value))).catch(() => undefined);
    } catch {
        // Optional: without the probe we animate.
    }
}
probeOnce();

function subscribe(listener: () => void) {
    listeners.add(listener);
    if (!subscription) {
        try {
            subscription = AccessibilityInfo?.addEventListener?.('reduceMotionChanged', (value: boolean) => setReduced(Boolean(value))) ?? null;
        } catch {
            subscription = null;
        }
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            subscription?.remove?.();
            subscription = null;
        }
    };
}

/** True when the system asks for less motion: animations then jump straight to their end state. */
export function useReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, () => reduced, () => false);
}

/** Test helper: forget what was learned from the system. */
export function resetReducedMotionForTests() {
    reduced = false;
    probed = false;
    listeners.clear();
    subscription = null;
}

type MotionProps = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    delay?: number;
    testID?: string;
};

/** Fades in while sliding up a few pixels when it mounts (a step, a new row). */
export function Rise({ children, style, delay = 0, testID }: Readonly<MotionProps>) {
    const reduced = useReducedMotion();
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (reduced) {
            progress.setValue(1);
            return;
        }
        const animation = Animated.timing(progress, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
        animation.start();
        return () => animation.stop();
    }, [reduced, delay, progress]);
    return (
        <Animated.View
            testID={testID}
            style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
        >
            {children}
        </Animated.View>
    );
}

/** Pops in with a small overshoot when it mounts (a chip that was just added). */
export function Pop({ children, style, testID }: Readonly<MotionProps>) {
    const reduced = useReducedMotion();
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (reduced) {
            progress.setValue(1);
            return;
        }
        const animation = Animated.spring(progress, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true });
        animation.start();
        return () => animation.stop();
    }, [reduced, progress]);
    return (
        <Animated.View
            testID={testID}
            style={[style, { opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }), transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}
        >
            {children}
        </Animated.View>
    );
}

/** Wraps its content in a short "bump" each time `trigger` changes (a stepper value, an emoji preview). */
export function Bump({ trigger, children, style }: Readonly<{ trigger: unknown; children: React.ReactNode; style?: StyleProp<ViewStyle> }>) {
    const reduced = useReducedMotion();
    const scale = useRef(new Animated.Value(1)).current;
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        if (reduced) return;
        const animation = Animated.sequence([
            Animated.timing(scale, { toValue: 1.08, duration: 90, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
        ]);
        animation.start();
        return () => animation.stop();
    }, [trigger, reduced, scale]);
    return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}
