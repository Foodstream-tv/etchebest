import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles } from '@/contexts/ThemeContext';

interface SocialButtonProps {
    label: string;
    onPress: () => void;
    icon: React.ReactNode;
    disabled?: boolean;
    testID?: string;
}

/** Outlined provider button (Google…): themed surface, rounded-2xl like the web `OAuthButton`. */
const SocialButton = React.memo(function SocialButton({ label, onPress, icon, disabled = false, testID }: SocialButtonProps) {
    const styles = useStyles();
    return (
        <Pressable
            style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
            onPress={disabled ? undefined : onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            testID={testID}
        >
            <View style={styles.content}>
                <View style={styles.iconBadge}>{icon}</View>
                <Text style={styles.text} numberOfLines={1}>
                    {label}
                </Text>
            </View>
        </Pressable>
    );
});

export default SocialButton;

const useStyles = makeStyles(({ colors, radii }) => ({
    button: {
        borderRadius: radii.lg,
        minHeight: 56,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        width: '100%',
        justifyContent: 'center',
    },
    disabled: {
        opacity: 0.55,
    },
    pressed: {
        opacity: 0.85,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    iconBadge: {
        width: 36,
        height: 36,
        borderRadius: radii.md,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
}));
