import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { brandTheme } from '@/constants/brandTheme';

type BrandBackdropProps = {
    compact?: boolean;
};

export default function BrandBackdrop({ compact = false }: Readonly<BrandBackdropProps>) {

    return (
        <View style={styles.overlay}>
            <LinearGradient
                colors={brandTheme.gradients.orbMain}
                start={{ x: 0.3, y: 0.3 }}
                end={{ x: 1, y: 1 }}
                style={[styles.orb, compact ? styles.orbMainCompact : styles.orbMain]}
            />
            <LinearGradient
                colors={brandTheme.gradients.orbSecondary}
                start={{ x: 0.8, y: 0.2 }}
                end={{ x: 0.3, y: 0.9 }}
                style={[styles.orb, compact ? styles.orbSecondaryCompact : styles.orbSecondary]}
            />
            <LinearGradient
                colors={['rgba(249, 115, 22, 0.18)', 'rgba(249, 115, 22, 0)']}
                style={styles.orbSmall}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        pointerEvents: 'none',
    },
    orb: {
        borderRadius: 999,
        position: 'absolute',
        borderWidth: 1,
        borderColor: 'rgba(249, 115, 22, 0.12)',
    },
    orbMain: {
        width: 360,
        height: 360,
        top: -120,
        right: -110,
    },
    orbMainCompact: {
        width: 280,
        height: 280,
        top: -110,
        right: -90,
    },
    orbSecondary: {
        width: 220,
        height: 220,
        bottom: 120,
        left: -90,
    },
    orbSecondaryCompact: {
        width: 160,
        height: 160,
        bottom: 80,
        left: -70,
    },
    orbSmall: {
        position: 'absolute',
        width: 86,
        height: 86,
        borderRadius: 999,
        top: 100,
        left: 30,
    },
});
