import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { haptics } from '@/utils/haptics';

type Props = {
    title: string;
    detail?: string;
    checked: boolean;
    onToggle: () => void;
    testID?: string;
};

/** A big tappable row with a checkbox: ingredients and steps are ticked with a thumb, from a distance. */
export default function CheckRow({ title, detail, checked, onToggle, testID }: Readonly<Props>) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={() => {
                haptics.tap();
                onToggle();
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={detail ? `${title}, ${detail}` : title}
            style={({ pressed }) => [styles.row, checked && styles.rowChecked, pressed && styles.pressed]}
            testID={testID}
        >
            <View style={[styles.box, checked && styles.boxChecked]}>{checked ? <Ionicons name="checkmark" size={20} color={colors.onBrand} /> : null}</View>
            <View style={styles.texts}>
                <Text style={[styles.title, checked && styles.titleChecked]}>{title}</Text>
                {detail ? <Text style={[styles.detail, checked && styles.detailChecked]}>{detail}</Text> : null}
            </View>
        </Pressable>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 60,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    rowChecked: {
        borderColor: colors.orangeGlow,
        backgroundColor: colors.orangeSoft,
    },
    pressed: {
        opacity: 0.8,
    },
    box: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: colors.placeholder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    boxChecked: {
        borderColor: colors.orange,
        backgroundColor: colors.orange,
    },
    texts: {
        flex: 1,
        gap: 2,
    },
    title: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
        lineHeight: 23,
    },
    titleChecked: {
        color: colors.muted,
        textDecorationLine: 'line-through',
    },
    detail: {
        color: colors.muted,
        fontSize: 15,
        lineHeight: 21,
    },
    detailChecked: {
        textDecorationLine: 'line-through',
    },
}));
