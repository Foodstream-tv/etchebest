import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { parseSchedule, toDateString, toTimeString } from '@/utils/studioSchedule';

type Props = {
    /** "YYYY-MM-DD" and "HH:mm", the web input formats. */
    date: string;
    time: string;
    onChange: (next: { date?: string; time?: string }) => void;
    /** Shown under the fields (the slot is in the past). */
    invalid?: boolean;
};

type Kind = 'date' | 'time';

/** Date and time of the schedule: system pickers on device, native inputs on web. */
export default function DateTimeFields({ date, time, onChange, invalid }: Readonly<Props>) {
    const { t, locale } = useI18n();
    const { colors, scheme } = useTheme();
    const styles = useStyles();

    const current = parseSchedule(date, time) ?? new Date();
    const intl = locale === 'en' ? 'en-GB' : 'fr-FR';

    const labelOf = (kind: Kind) =>
        kind === 'date'
            ? parseSchedule(date, time)?.toLocaleDateString(intl, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) ?? date
            : time;

    const apply = (kind: Kind, picked: Date) =>
        onChange(kind === 'date' ? { date: toDateString(picked) } : { time: toTimeString(picked) });

    const openAndroid = (kind: Kind) =>
        DateTimePickerAndroid.open({
            value: current,
            mode: kind,
            is24Hour: true,
            minimumDate: kind === 'date' ? new Date() : undefined,
            onChange: (event, picked) => {
                if (event.type === 'set' && picked) apply(kind, picked);
            },
        });

    const field = (kind: Kind) => {
        const icon = kind === 'date' ? 'calendar-outline' : 'time-outline';
        const label = t(kind === 'date' ? 'studio.broadcast.dateField' : 'studio.broadcast.timeField');
        const aria = t(kind === 'date' ? 'studio.broadcast.dateAria' : 'studio.broadcast.timeAria');

        let control: React.ReactNode;
        if (Platform.OS === 'ios') {
            control = (
                <DateTimePicker
                    value={current}
                    mode={kind}
                    display="compact"
                    themeVariant={scheme}
                    accentColor={colors.orange}
                    minimumDate={kind === 'date' ? new Date() : undefined}
                    onChange={(_, picked) => picked && apply(kind, picked)}
                    accessibilityLabel={aria}
                    testID={`schedule-${kind}`}
                />
            );
        } else {
            control = <Text style={styles.value}>{labelOf(kind)}</Text>;
        }

        const content = (
            <View style={[styles.field, invalid && styles.fieldInvalid]}>
                <Ionicons name={icon} size={20} color={colors.muted} />
                {control}
            </View>
        );

        return (
            <View style={styles.col} key={kind}>
                <Text style={styles.label}>{label}</Text>
                {Platform.OS === 'android' ? (
                    <Pressable onPress={() => openAndroid(kind)} accessibilityRole="button" accessibilityLabel={`${aria}: ${labelOf(kind)}`} testID={`schedule-${kind}`}>
                        {content}
                    </Pressable>
                ) : (
                    content
                )}
            </View>
        );
    };

    return (
        <View style={styles.row}>
            {field('date')}
            {field('time')}
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    // Stacked: the iOS compact picker (~130 px wide) does not fit beside its neighbour on a phone.
    row: {
        gap: 14,
    },
    col: {
        gap: 8,
    },
    label: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        minHeight: 52,
        paddingHorizontal: 14,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    fieldInvalid: {
        borderColor: colors.danger,
    },
    value: {
        flex: 1,
        color: colors.text,
        fontSize: 15,
        fontWeight: '500',
    },
}));
