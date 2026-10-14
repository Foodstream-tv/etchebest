import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

import { makeStyles, useTheme } from '@/contexts/ThemeContext';

interface FloatingLabelInputProps extends TextInputProps {
    label: string;
    iconName: React.ComponentProps<typeof Ionicons>['name'];
    focused: boolean;
    onFocus: () => void;
    onBlur: () => void;
    trailingIcon?: React.ReactNode;
    error?: string | null;
    /** Kept for backwards compatibility: both variants now share the web `auth-field` look. */
    variant?: 'default' | 'login';
}

/**
 * Text field with a leading icon: web `auth-field` (rounded-2xl, border black/8 / white/10,
 * orange border + ring on focus, label as placeholder and accessibility label).
 */
const FloatingLabelInput = React.memo(function FloatingLabelInput({
    label,
    iconName,
    focused,
    onFocus,
    onBlur,
    trailingIcon,
    error,
     
    variant: _variant,
    ...rest
}: FloatingLabelInputProps) {
    const styles = useStyles();
    const { colors } = useTheme();

    return (
        <View style={styles.wrapper}>
            <View style={[styles.group, focused && styles.groupFocused, !!error && styles.groupError, rest.multiline && styles.groupMultiline]}>
                <Ionicons
                    name={iconName}
                    size={20}
                    color={error ? colors.danger : focused ? colors.orange : colors.muted}
                    style={styles.icon}
                />
                <TextInput
                    style={[styles.input, rest.multiline && styles.inputMultiline]}
                    placeholder={label}
                    placeholderTextColor={colors.placeholder}
                    accessibilityLabel={label}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    selectionColor={colors.orange}
                    {...rest}
                />
                {trailingIcon}
            </View>
            {!!error && (
                <Text style={styles.error} accessibilityRole="alert">
                    {error}
                </Text>
            )}
        </View>
    );
});

export default FloatingLabelInput;

const useStyles = makeStyles(({ colors, radii }) => ({
    wrapper: {
        marginBottom: 14,
    },
    group: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 58,
        paddingHorizontal: 16,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        width: '100%',
    },
    groupFocused: {
        borderColor: colors.orange,
        boxShadow: `0px 0px 0px 3px ${colors.orangeGlow}`,
    },
    groupError: {
        borderColor: colors.danger,
    },
    groupMultiline: {
        alignItems: 'flex-start',
        paddingTop: 14,
        paddingBottom: 14,
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 17,
        fontWeight: '500',
        color: colors.text,
        paddingVertical: 14,
    },
    inputMultiline: {
        textAlignVertical: 'top',
        minHeight: 80,
        paddingTop: 0,
    },
    error: {
        marginTop: 6,
        marginLeft: 4,
        fontSize: 12,
        fontWeight: '500',
        color: colors.danger,
    },
}));
