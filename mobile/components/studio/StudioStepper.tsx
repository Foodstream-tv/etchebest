import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { type StudioStep } from '@/hooks/useStudioForm';

const STEPS = [
    { step: 1, key: 'studio.steps.step1' },
    { step: 2, key: 'studio.steps.step2' },
    { step: 3, key: 'studio.steps.step3' },
] as const satisfies readonly { step: StudioStep; key: string }[];

/** The 3 tappable steps of the wizard: current (orange), done (tinted + check), to come (quiet). */
export default function StudioStepper({ active, onSelect }: Readonly<{ active: StudioStep; onSelect: (step: StudioStep) => void }>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();

    return (
        <View style={styles.bar} accessibilityRole="tablist" testID="studio-stepper">
            {STEPS.map(({ step, key }) => {
                const current = active === step;
                const done = active > step;
                // The visible label already starts with "1. ": show the bare text next to the badge instead.
                const label = t(key).replace(/^\d+\.\s*/, '');
                return (
                    <Pressable
                        key={step}
                        onPress={() => onSelect(step)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: current }}
                        accessibilityLabel={t(key)}
                        style={[styles.item, current && styles.itemCurrent, done && styles.itemDone]}
                        testID={`step-${step}`}
                    >
                        {done ? (
                            <Ionicons name="checkmark" size={16} color={colors.orangeText} />
                        ) : (
                            <View style={[styles.badge, current && styles.badgeCurrent]}>
                                <Text style={[styles.badgeText, current && styles.badgeTextCurrent]}>{step}</Text>
                            </View>
                        )}
                        <Text style={[styles.label, current && styles.labelCurrent, done && styles.labelDone]} numberOfLines={2}>
                            {label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    bar: {
        flexDirection: 'row',
        gap: 6,
        padding: 6,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    item: {
        flex: 1,
        minHeight: 56,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 4,
        paddingVertical: 8,
        borderRadius: radii.md,
    },
    itemCurrent: {
        backgroundColor: colors.orange,
    },
    itemDone: {
        backgroundColor: colors.orangeSoft,
    },
    badge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceStrong,
    },
    badgeCurrent: {
        backgroundColor: '#ffffff',
    },
    badgeText: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '800',
    },
    badgeTextCurrent: {
        color: colors.orangeDim,
    },
    label: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
    },
    labelCurrent: {
        color: colors.onBrand,
    },
    labelDone: {
        color: colors.orangeText,
    },
}));
