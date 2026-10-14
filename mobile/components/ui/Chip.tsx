import React from 'react';
import { Pressable, StyleProp, Text, ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/contexts/ThemeContext';

type ChipProps = {
    label: string;
    active?: boolean;
    onPress?: () => void;
    icon?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

/** Filter/tag pill: active = orange fill (web `bg-orange-500 text-white`). */
export default function Chip({ label, active = false, onPress, icon, style, testID }: Readonly<ChipProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            testID={testID}
            style={({ pressed }) => [styles.chip, active && styles.active, pressed && styles.pressed, style]}
        >
            {icon}
            <Text style={[styles.label, { color: active ? colors.onBrand : colors.text }]} numberOfLines={1}>
                {label}
            </Text>
        </Pressable>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        minHeight: 40,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    active: {
        backgroundColor: colors.orange,
        borderColor: colors.orange,
    },
    pressed: {
        opacity: 0.8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    },
}));
