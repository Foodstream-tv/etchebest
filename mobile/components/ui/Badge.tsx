import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

import { brandGradient } from '@/constants/theme';
import { makeStyles } from '@/contexts/ThemeContext';

type BadgeProps = {
    label: string;
    /** gradient: LIVE (brand gradient); dark: overlay on thumbnails; soft: orange tinted; neutral */
    tone?: 'gradient' | 'dark' | 'soft' | 'neutral';
    style?: StyleProp<ViewStyle>;
};

/** LIVE / PLANIFIÉ / REDIFFUSION pills (web `LiveGridCard`). */
export default function Badge({ label, tone = 'neutral', style }: Readonly<BadgeProps>) {
    const styles = useStyles();

    if (tone === 'gradient') {
        return (
            <LinearGradient colors={brandGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.pill, style]}>
                <Text style={[styles.text, styles.onBrand]}>{label}</Text>
            </LinearGradient>
        );
    }

    return (
        <View style={[styles.pill, tone === 'dark' && styles.dark, tone === 'soft' && styles.soft, tone === 'neutral' && styles.neutral, style]}>
            <Text style={[styles.text, tone === 'dark' && styles.onBrand, tone === 'soft' && styles.softText, tone === 'neutral' && styles.neutralText]}>
                {label}
            </Text>
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    pill: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
    },
    dark: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    soft: {
        backgroundColor: colors.orangeSoft,
    },
    neutral: {
        backgroundColor: colors.surfaceStrong,
    },
    text: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    onBrand: {
        color: '#ffffff',
    },
    softText: {
        color: colors.orangeText,
    },
    neutralText: {
        color: colors.muted,
    },
}));
