import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

type Props = {
    date: string;
    time: string;
    onChange: (next: { date?: string; time?: string }) => void;
    invalid?: boolean;
};

/** Web build: the browser's own date and time inputs (the native picker package has no web implementation). */
export default function DateTimeFields({ date, time, onChange, invalid }: Readonly<Props>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();

    const field = (kind: 'date' | 'time') => (
        <View style={styles.col} key={kind}>
            <Text style={styles.label}>{t(kind === 'date' ? 'studio.broadcast.dateField' : 'studio.broadcast.timeField')}</Text>
            <View style={[styles.field, invalid && styles.fieldInvalid]}>
                <Ionicons name={kind === 'date' ? 'calendar-outline' : 'time-outline'} size={20} color={colors.muted} />
                {/* react-native-web renders DOM elements as-is */}
                {React.createElement('input', {
                    type: kind,
                    value: kind === 'date' ? date : time,
                    'aria-label': t(kind === 'date' ? 'studio.broadcast.dateAria' : 'studio.broadcast.timeAria'),
                    'data-testid': `schedule-${kind}`,
                    onChange: (e: { target: { value: string } }) => onChange(kind === 'date' ? { date: e.target.value } : { time: e.target.value }),
                    style: { flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: colors.text, fontSize: 15, outline: 'none', fontFamily: 'inherit' },
                })}
            </View>
        </View>
    );

    return (
        <View style={styles.row}>
            {field('date')}
            {field('time')}
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    row: { flexDirection: 'row', gap: 12 },
    col: { flex: 1, gap: 8 },
    label: { color: colors.text, fontSize: 15, fontWeight: '700' },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 52,
        paddingHorizontal: 14,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    fieldInvalid: { borderColor: colors.danger },
}));
