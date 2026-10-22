import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { orbs } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

type BrandBackdropProps = {
    compact?: boolean;
};

/** Decorative orange orbs of the web background (AppBackground.tsx), themed. */
export default function BrandBackdrop({ compact = false }: Readonly<BrandBackdropProps>) {
    const { scheme } = useTheme();
    const palette = orbs[scheme];

    return (
        <View style={styles.overlay} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LinearGradient
                colors={palette.main}
                start={{ x: 0.3, y: 0.3 }}
                end={{ x: 1, y: 1 }}
                style={[styles.orb, compact ? styles.orbMainCompact : styles.orbMain]}
            />
            <LinearGradient
                colors={palette.secondary}
                start={{ x: 0.8, y: 0.2 }}
                end={{ x: 0.3, y: 0.9 }}
                style={[styles.orb, compact ? styles.orbSecondaryCompact : styles.orbSecondary]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFill,
    },
    orb: {
        borderRadius: 999,
        position: 'absolute',
    },
    orbMain: {
        width: 360,
        height: 360,
        top: -140,
        right: -140,
    },
    orbMainCompact: {
        width: 280,
        height: 280,
        top: -110,
        right: -100,
    },
    orbSecondary: {
        width: 260,
        height: 260,
        bottom: -100,
        left: -110,
    },
    orbSecondaryCompact: {
        width: 180,
        height: 180,
        bottom: -70,
        left: -80,
    },
});
