import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { makeStyles } from '@/contexts/ThemeContext';

type CardProps = React.PropsWithChildren<{
    style?: StyleProp<ViewStyle>;
    /** Smaller radius (rows, inputs) instead of the 28px web card radius */
    compact?: boolean;
    testID?: string;
}>;

/** Web `rounded-[28px] border bg-white/72 dark:bg-[#120b05]/60` block. */
export default function Card({ children, style, compact = false, testID }: Readonly<CardProps>) {
    const styles = useStyles();
    return (
        <View testID={testID} style={[styles.card, compact && styles.compact, style]}>
            {children}
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    card: {
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radii.card,
        overflow: 'hidden',
    },
    compact: {
        borderRadius: radii.lg,
    },
}));
