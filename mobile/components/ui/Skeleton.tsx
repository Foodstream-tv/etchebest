import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

type SkeletonProps = {
    height?: number;
    width?: number | `${number}%`;
    radius?: number;
    style?: StyleProp<ViewStyle>;
};

/** Pulsing placeholder (web `animate-pulse bg-black/5 dark:bg-white/10`). */
export default function Skeleton({ height = 16, width = '100%', radius = 8, style }: Readonly<SkeletonProps>) {
    const { colors } = useTheme();
    const opacity = useRef(new Animated.Value(0.55)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.55, duration: 800, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);

    return (
        <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[{ height, width, borderRadius: radius, backgroundColor: colors.surfaceStrong, opacity }, style]}
        />
    );
}
