import { Platform } from 'react-native';

export const brandTheme = {
    colors: {
        orange: '#f97316',
        orangeDim: '#c2540a',
        orangeGlow: 'rgba(249, 115, 22, 0.28)',
        bg: '#0c0804',
        surface: 'rgba(255, 255, 255, 0.04)',
        surfaceStrong: 'rgba(255, 255, 255, 0.08)',
        border: 'rgba(255, 255, 255, 0.08)',
        text: '#faf5ee',
        muted: 'rgba(250, 245, 238, 0.55)',
        placeholder: 'rgba(250, 245, 238, 0.32)',
        success: '#4ade80',
        danger: '#f87171',
    },
    gradients: {
        primary: ['#f97316', '#c2540a'] as const,
        orbMain: ['rgba(249, 115, 22, 0.22)', 'rgba(249, 115, 22, 0.02)'] as const,
        orbSecondary: ['rgba(249, 115, 22, 0.16)', 'rgba(249, 115, 22, 0.01)'] as const,
    },
    radii: {
        lg: 14,
        xl: 20,
        xxl: 28,
        pill: 40,
    },
};

export const brandHeadlineFont = Platform.select({
    ios: 'Times New Roman',
    android: 'serif',
    default: 'serif',
});
