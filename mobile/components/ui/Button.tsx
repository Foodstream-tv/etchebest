import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';

import { brandGradient } from '@/constants/theme';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = {
    label: string;
    onPress?: () => void;
    variant?: ButtonVariant;
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
    testID?: string;
    /** Compact height for inline actions (cards, rows) */
    size?: 'md' | 'sm';
};

/**
 * Web equivalents: `auth-btn-primary` (brand gradient, rounded-2xl, orange glow),
 * white/black bordered secondary, red destructive.
 */
export default function Button({
    label,
    onPress,
    variant = 'primary',
    loading = false,
    disabled = false,
    icon,
    style,
    accessibilityLabel,
    testID,
    size = 'md',
}: Readonly<ButtonProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const inactive = disabled || loading;

    const textColor =
        variant === 'primary' || variant === 'danger'
            ? colors.onBrand
            : variant === 'ghost'
              ? colors.orangeText
              : colors.text;

    const content = (
        <View style={[styles.row, size === 'sm' ? styles.rowSm : styles.rowMd]}>
            {loading ? <ActivityIndicator size="small" color={textColor} /> : icon}
            <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: textColor }]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );

    return (
        <Pressable
            onPress={inactive ? undefined : onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled: inactive, busy: loading }}
            testID={testID}
            style={({ pressed }) => [
                styles.base,
                variant === 'primary' && styles.primaryShadow,
                variant === 'secondary' && styles.secondary,
                variant === 'danger' && styles.danger,
                variant === 'ghost' && styles.ghost,
                inactive && styles.inactive,
                pressed && !inactive && styles.pressed,
                style,
            ]}
        >
            {variant === 'primary' ? (
                <LinearGradient
                    colors={brandGradient}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.gradient}
                >
                    {content}
                </LinearGradient>
            ) : (
                content
            )}
        </Pressable>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    base: {
        borderRadius: radii.lg,
        overflow: 'hidden',
    },
    gradient: {
        borderRadius: radii.lg,
    },
    primaryShadow: {
        boxShadow: `0px 10px 30px ${colors.orangeGlow}`,
        elevation: 4,
    },
    secondary: {
        backgroundColor: colors.surfaceStrong,
        borderWidth: 1,
        borderColor: colors.border,
    },
    danger: {
        backgroundColor: colors.danger,
    },
    ghost: {
        backgroundColor: colors.orangeSoft,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
    },
    rowMd: {
        minHeight: 52,
    },
    rowSm: {
        minHeight: 40,
    },
    label: {
        fontSize: 16,
        fontWeight: '700',
    },
    labelSm: {
        fontSize: 14,
    },
    inactive: {
        opacity: 0.55,
    },
    pressed: {
        opacity: 0.85,
        transform: [{ scale: 0.99 }],
    },
}));
