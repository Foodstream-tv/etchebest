import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { Pop, useReducedMotion } from '@/components/studio/motion';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

/** "Fiche complétée à 62 %": a bar that fills as the form does, and a small celebration at 100 %. */
export default function FormProgress({ percent }: Readonly<{ percent: number }>) {
    const { t } = useI18n();
    const styles = useStyles();
    const { colors } = useTheme();
    const reduced = useReducedMotion();
    const width = useRef(new Animated.Value(percent)).current;

    useEffect(() => {
        if (reduced) {
            width.setValue(percent);
            return;
        }
        const animation = Animated.timing(width, { toValue: percent, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false });
        animation.start();
        return () => animation.stop();
    }, [percent, reduced, width]);

    const done = percent >= 100;
    return (
        <View style={styles.wrap} testID="form-progress">
            <View
                style={styles.track}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: percent }}
                accessibilityLabel={t('studio.progress.label', { percent })}
            >
                <Animated.View
                    style={[styles.fill, { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }]}
                />
            </View>
            <View style={styles.caption}>
                {done ? (
                    <Pop>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    </Pop>
                ) : null}
                <Text style={[styles.text, done && styles.textDone]} testID="form-progress-text">
                    {done ? t('studio.progress.done') : t('studio.progress.label', { percent })}
                </Text>
            </View>
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    wrap: { gap: 6 },
    track: {
        height: 8,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceStrong,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: radii.pill,
        backgroundColor: colors.orange,
    },
    caption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    text: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
    },
    textDone: {
        color: colors.success,
        fontWeight: '700',
    },
}));
