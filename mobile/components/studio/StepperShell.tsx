import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Bump } from '@/components/studio/motion';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

export const STEPPER_SIZE = 52;

function StepButton({
    icon,
    label,
    onPress,
    disabled,
    testID,
}: Readonly<{ icon: 'remove' | 'add'; label: string; onPress: () => void; disabled?: boolean; testID?: string }>) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: !!disabled }}
            hitSlop={4}
            testID={testID}
            style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}
        >
            <Ionicons name={icon} size={26} color={colors.orange} />
        </Pressable>
    );
}

type Props = {
    /** The field in the middle (a number input or a read-only value), as tall as the buttons. */
    children: React.ReactNode;
    /** Changes whenever the value does: the field gives a small bump. */
    value: number;
    /** False when the field is an input being typed in: it then bumps only on the - / + presses. */
    bumpOnChange?: boolean;
    onDecrement: () => void;
    onIncrement: () => void;
    decrementDisabled?: boolean;
    incrementDisabled?: boolean;
    decrementLabel: string;
    incrementLabel: string;
    decrementTestID?: string;
    incrementTestID?: string;
};

/** Full-width "- [ field ] +" control: the buttons are exactly as big as the field between them. */
export default function StepperShell({
    children,
    value,
    bumpOnChange = true,
    onDecrement,
    onIncrement,
    decrementDisabled,
    incrementDisabled,
    decrementLabel,
    incrementLabel,
    decrementTestID,
    incrementTestID,
}: Readonly<Props>) {
    const styles = useStyles();
    const [taps, setTaps] = useState(0);
    const press = (action: () => void) => () => {
        setTaps((n) => n + 1);
        action();
    };
    return (
        <View style={styles.row}>
            <StepButton icon="remove" label={decrementLabel} onPress={press(onDecrement)} disabled={decrementDisabled} testID={decrementTestID} />
            <Bump trigger={bumpOnChange ? value : taps} style={styles.fieldWrap}>
                <View style={styles.field}>{children}</View>
            </Bump>
            <StepButton icon="add" label={incrementLabel} onPress={press(onIncrement)} disabled={incrementDisabled} testID={incrementTestID} />
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    button: {
        width: STEPPER_SIZE,
        height: STEPPER_SIZE,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.orangeGlow,
        backgroundColor: colors.orangeSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabled: { opacity: 0.4 },
    pressed: { transform: [{ scale: 0.92 }] },
    fieldWrap: {
        flex: 1,
        minWidth: 0,
    },
    field: {
        minHeight: STEPPER_SIZE,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 12,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.cardSolid,
    },
}));
