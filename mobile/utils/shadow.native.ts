import type { ViewStyle } from 'react-native';

export type ShadowConfig = {
    color: string;
    offset: { width: number; height: number };
    opacity: number;
    radius: number;
    elevation?: number;
};

export const createShadowStyle = ({
    color,
    offset,
    opacity,
    radius,
    elevation,
}: ShadowConfig): ViewStyle => {
    const elevationStyle = typeof elevation === 'number' ? { elevation } : {};

    return {
        shadowColor: color,
        shadowOffset: offset,
        shadowOpacity: opacity,
        shadowRadius: radius,
        ...elevationStyle,
    };
};
