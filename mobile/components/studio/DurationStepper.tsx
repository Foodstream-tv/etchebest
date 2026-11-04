import React from 'react';
import { Text, View } from 'react-native';

import { Panel } from '@/components/studio/primitives';
import StepperShell from '@/components/studio/StepperShell';
import Chip from '@/components/ui/Chip';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';
import { DURATION_MAX, DURATION_MIN, DURATION_PRESETS, DURATION_STEP } from '@/hooks/useStudioForm';

/** Planned duration (web range slider, 10-180 min by 5): big -/+ buttons as tall as the value field, plus the usual presets. */
export default function DurationStepper({ minutes, onChange }: Readonly<{ minutes: number; onChange: (minutes: number) => void }>) {
    const { t } = useI18n();
    const styles = useStyles();
    const label = t('studio.broadcast.durationAria');
    return (
        <Panel>
            <Text style={styles.title}>{t('studio.broadcast.plannedDuration')}</Text>
            <StepperShell
                value={minutes}
                onDecrement={() => onChange(minutes - DURATION_STEP)}
                onIncrement={() => onChange(minutes + DURATION_STEP)}
                decrementDisabled={minutes <= DURATION_MIN}
                incrementDisabled={minutes >= DURATION_MAX}
                decrementLabel={`${t('common.decrease')} – ${label}`}
                incrementLabel={`${t('common.increase')} – ${label}`}
                decrementTestID="duration-minus"
                incrementTestID="duration-plus"
            >
                <Text style={styles.value} testID="duration-value" accessibilityLiveRegion="polite">{`${minutes} min`}</Text>
            </StepperShell>
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
