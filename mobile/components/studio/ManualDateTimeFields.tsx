import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { Notice, StudioInput } from '@/components/studio/primitives';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { parseSchedule } from '@/utils/studioSchedule';

type Props = {
    date: string;
    time: string;
    onChange: (next: { date?: string; time?: string }) => void;
    invalid?: boolean;
};

/** Typed "YYYY-MM-DD" and "HH:mm": used when the system pickers are not in this app build. */
export default function ManualDateTimeFields({ date, time, onChange, invalid }: Readonly<Props>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const typedButWrong = (date !== '' || time !== '') && parseSchedule(date, time) === null;

    return (
        <View style={styles.stack} testID="manual-datetime">
            <View style={styles.row}>
                <View style={styles.col}>
                    <Text style={styles.label}>{t('studio.broadcast.dateField')}</Text>
                    <View style={styles.field}>
                        <Ionicons name="calendar-outline" size={20} color={colors.muted} />
                        <StudioInput
                            style={styles.input}
                            value={date}
                            onChangeText={(value) => onChange({ date: value.trim() })}
                            placeholder="2030-05-12"
                            accessibilityLabel={t('studio.broadcast.dateAria')}
                            keyboardType="numbers-and-punctuation"
                            maxLength={10}
                            invalid={invalid || typedButWrong}
                            testID="schedule-date"
                        />
                    </View>
                </View>
                <View style={styles.col}>
                    <Text style={styles.label}>{t('studio.broadcast.timeField')}</Text>
                    <View style={styles.field}>
                        <Ionicons name="time-outline" size={20} color={colors.muted} />
                        <StudioInput
                            style={styles.input}
                            value={time}
                            onChangeText={(value) => onChange({ time: value.trim() })}
                            placeholder="18:30"
                            accessibilityLabel={t('studio.broadcast.timeAria')}
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                            invalid={invalid || typedButWrong}
                            testID="schedule-time"
                        />
                    </View>
                </View>
            </View>
            <Notice tone="info" testID="manual-datetime-hint">
                {t('studio.go.dateManualHint')}
            </Notice>
        </View>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    stack: { gap: 8 },
    row: { flexDirection: 'row', gap: 12 },
    col: { flex: 1, gap: 8, minWidth: 0 },
    label: { color: colors.text, fontSize: 15, fontWeight: '700' },
    field: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: { flex: 1, minWidth: 0 },
}));
