import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/contexts/ThemeContext';

/** Bordered inner block of a Studio card (web `rounded-2xl border bg-white/80 p-3|4`). */
export function Panel({ children, style, testID }: Readonly<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }>) {
    const styles = useStyles();
    return (
        <View style={[styles.panel, style]} testID={testID}>
            {children}
        </View>
    );
}

/** Label above a field (web `Field`), with an optional right-aligned counter/hint. */
export function FieldLabel({ label, hint, hintTone }: Readonly<{ label: string; hint?: string; hintTone?: 'muted' | 'warn' | 'danger' }>) {
    const styles = useStyles();
    return (
        <View style={styles.labelRow}>
            <Text style={styles.label}>{label}</Text>
            {hint ? <Text style={[styles.hint, hintTone === 'warn' && styles.hintWarn, hintTone === 'danger' && styles.hintDanger]}>{hint}</Text> : null}
        </View>
    );
}

/** Plain bordered text input (compact rows: add an ingredient, a step…). */
export const StudioInput = React.forwardRef<TextInput, TextInputProps & { invalid?: boolean }>(function StudioInput(
    { style, invalid, accessibilityLabel, placeholder, ...rest },
    ref
) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <TextInput
            ref={ref}
            style={[styles.input, invalid && styles.inputInvalid, rest.multiline && styles.inputMultiline, style]}
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.orange}
            accessibilityLabel={accessibilityLabel ?? placeholder}
            placeholder={placeholder}
            {...rest}
        />
    );
});

/** Round 40 px icon button (add "+" / remove "x"), 44 px touch target through hitSlop. */
export function IconButton({
    icon,
    label,
    onPress,
    tone = 'brand',
    disabled,
    testID,
}: Readonly<{
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress: () => void;
    tone?: 'brand' | 'quiet' | 'danger';
    disabled?: boolean;
    testID?: string;
}>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const color = tone === 'brand' ? colors.onBrand : tone === 'danger' ? colors.danger : colors.muted;
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={8}
            testID={testID}
            style={({ pressed }) => [
                styles.iconButton,
                tone === 'brand' ? styles.iconButtonBrand : styles.iconButtonQuiet,
                disabled && styles.disabled,
                pressed && styles.pressed,
            ]}
        >
            <Ionicons name={icon} size={tone === 'brand' ? 20 : 18} color={color} />
        </Pressable>
    );
}

/** Message under a field: error (red), warning (amber) or success (green). */
export function Notice({ tone, children, testID }: Readonly<{ tone: 'error' | 'warning' | 'success' | 'info'; children: React.ReactNode; testID?: string }>) {
    const styles = useStyles();
    return (
        <Text
            accessibilityRole={tone === 'error' || tone === 'warning' ? 'alert' : undefined}
            style={[styles.notice, tone === 'error' && styles.noticeError, tone === 'warning' && styles.noticeWarn, tone === 'success' && styles.noticeSuccess, tone === 'info' && styles.noticeInfo]}
            testID={testID}
        >
            {children}
        </Text>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    panel: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: 14,
        gap: 10,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    label: {
        flexShrink: 1,
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    hint: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
    },
    hintWarn: { color: colors.warning },
    hintDanger: { color: colors.danger, fontWeight: '800' },
    input: {
        minHeight: 44,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.cardSolid,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.text,
        fontSize: 15,
    },
    inputInvalid: { borderColor: colors.danger },
    inputMultiline: {
        minHeight: 120,
        textAlignVertical: 'top',
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconButtonBrand: { backgroundColor: colors.orange },
    iconButtonQuiet: { backgroundColor: 'transparent', width: 32, height: 32 },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.75 },
    notice: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
    },
    noticeError: { color: colors.danger },
    noticeWarn: { color: colors.warning },
    noticeSuccess: { color: colors.success },
    noticeInfo: { color: colors.muted, fontWeight: '500' },
}));
