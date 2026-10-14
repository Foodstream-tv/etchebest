import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { formatActivityDate } from '@/components/profile/profileUtils';

type ActivityRowProps = {
    text: string;
    createdAt?: string;
};

/** One line of the activity feed (web `ProfileActivityRow`). */
export default function ActivityRow({ text, createdAt }: Readonly<ActivityRowProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { locale } = useI18n();
    const date = formatActivityDate(createdAt, locale);

    return (
        <View style={styles.row} accessibilityRole="text">
            <Ionicons name="notifications-outline" size={18} color={colors.orangeText} />
            <View style={styles.texts}>
                <Text style={styles.text}>{text}</Text>
                {date ? <Text style={styles.date}>{date}</Text> : null}
            </View>
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        borderRadius: radii.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    texts: {
        flex: 1,
        gap: 2,
    },
    text: {
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    date: {
        color: colors.muted,
        fontSize: 12,
    },
}));
