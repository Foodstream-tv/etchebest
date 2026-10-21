import React from 'react';
import { Switch, Text, View } from 'react-native';

import DateTimeFields from '@/components/studio/DateTimeFields';
import DurationStepper from '@/components/studio/DurationStepper';
import { FieldLabel, Notice } from '@/components/studio/primitives';
import ThumbnailPicker from '@/components/studio/ThumbnailPicker';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { type StudioForm } from '@/hooks/useStudioForm';

type Props = {
    form: StudioForm;
    onChange: (patch: Partial<StudioForm>) => void;
    onDuration: (minutes: number) => void;
    /** Only flagged once the user tried to schedule: the slot must be in the future. */
    scheduleInvalid: boolean;
    busy: boolean;
};

/** Step 3: thumbnail, date and time, planned duration. */
export default function StepMedia({ form, onChange, onDuration, scheduleInvalid, busy }: Readonly<Props>) {
    const { t } = useI18n();
    const styles = useStyles();
    const { colors } = useTheme();

    return (
        <View style={styles.stack}>
            <View style={styles.field}>
                <FieldLabel label={t('studio.broadcast.thumbnail')} />
                <ThumbnailPicker
                    image={form.image}
                    imageUrl={form.imageUrl}
                    onPick={(image) => onChange({ image, imageUrl: '' })}
                    onClear={() => onChange({ image: null })}
                    onUrlChange={(imageUrl) => onChange(imageUrl.trim() ? { imageUrl, image: null } : { imageUrl })}
                    disabled={busy}
                />
            </View>

            <View style={styles.field}>
                <DateTimeFields date={form.date} time={form.time} onChange={(next) => onChange(next)} invalid={scheduleInvalid} />
                {scheduleInvalid ? <Notice tone="error" testID="schedule-invalid">{t('studio.go.scheduleInPast')}</Notice> : null}
            </View>

            <View style={styles.field}>
                <FieldLabel label={t('studio.broadcast.durationField')} />
                <DurationStepper minutes={form.durationMinutes} onChange={onDuration} />
            </View>

            <View style={styles.replayRow}>
                <View style={styles.replayText}>
                    <Text style={styles.replayLabel}>{t('studio.broadcast.replayLabel')}</Text>
                    <Text style={styles.replayHint}>{t(form.recordReplay ? 'studio.broadcast.replayOn' : 'studio.broadcast.replayOff')}</Text>
                </View>
                <Switch
                    value={form.recordReplay}
                    onValueChange={(recordReplay) => onChange({ recordReplay })}
                    disabled={busy}
                    trackColor={{ true: colors.orange, false: colors.border }}
                    accessibilityLabel={t('studio.broadcast.replayLabel')}
                    testID="studio-record-replay"
                />
            </View>
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    stack: {
        gap: 18,
    },
    field: {
        gap: 8,
    },
    replayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
    },
    replayText: {
        flex: 1,
        gap: 2,
    },
    replayLabel: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    replayHint: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 17,
    },
}));
