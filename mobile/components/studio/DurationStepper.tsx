import React from 'react';
import { Text, View } from 'react-native';

import { IconButton, Panel } from '@/components/studio/primitives';
import Chip from '@/components/ui/Chip';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';
import { DURATION_MAX, DURATION_MIN, DURATION_PRESETS, DURATION_STEP } from '@/hooks/useStudioForm';

/** Planned duration (web range slider, 10-180 min by 5): -/+ buttons and the usual presets, no extra native module. */
export default function DurationStepper({ minutes, onChange }: Readonly<{ minutes: number; onChange: (minutes: number) => void }>) {
    const { t } = useI18n();
    const styles = useStyles();
    return (
        <Panel>
            <Text style={styles.title}>{t('studio.broadcast.plannedDuration')}</Text>
            <View style={styles.row}>
                <IconButton icon="remove" label={t('studio.broadcast.durationAria')} onPress={() => onChange(minutes - DURATION_STEP)} disabled={minutes <= DURATION_MIN} testID="duration-minus" />
                <Text style={styles.value} testID="duration-value" accessibilityLiveRegion="polite">{`${minutes} min`}</Text>
                <IconButton icon="add" label={t('studio.broadcast.durationAria')} onPress={() => onChange(minutes + DURATION_STEP)} disabled={minutes >= DURATION_MAX} testID="duration-plus" />
            </View>
            <View style={styles.presets}>
                {DURATION_PRESETS.map((preset) => (
                    <Chip key={preset} label={`${preset} min`} active={minutes === preset} onPress={() => onChange(preset)} testID={`duration-${preset}`} />
                ))}
            </View>
        </Panel>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    title: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    value: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '800',
    },
    presets: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
}));
