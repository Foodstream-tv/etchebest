import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/contexts/ThemeContext';

type Option<T extends string> = { key: T; label: string };

type SegmentedControlProps<T extends string> = {
    options: readonly Option<T>[];
    value: T;
    onChange: (key: T) => void;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
};

/** Web status tabs (all / live / scheduled): joined buttons, active one on the brand orange. */
export default function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel, style }: Readonly<SegmentedControlProps<T>>) {
    const styles = useStyles();
    const { colors } = useTheme();

    return (
        <View style={[styles.wrap, style]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
            {options.map((option, index) => {
                const active = option.key === value;
                return (
                    <Pressable
                        key={option.key}
                        onPress={() => onChange(option.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={option.label}
                        testID={`segment-${option.key}`}
                        style={[styles.item, index > 0 && styles.divider, active && styles.active]}
                    >
                        <Text style={[styles.label, { color: active ? colors.onBrand : colors.muted }]} numberOfLines={1}>
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    wrap: {
        flexDirection: 'row',
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: 'hidden',
    },
    item: {
        flex: 1,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    divider: {
        borderLeftWidth: 1,
        borderLeftColor: colors.border,
    },
    active: {
        backgroundColor: colors.orange,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
    },
}));
