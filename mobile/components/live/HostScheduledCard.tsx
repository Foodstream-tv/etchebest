import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

import { MAX_CO_STREAMERS } from './useLiveRoom';

type HostScheduledCardProps = {
    dateLabel: string;
    registeredCount: number;
    onOpenStudio: () => void;
    onCalendar: () => void;
};

/** Host side of a scheduled live: start it from the Studio, add it to the calendar. */
export default function HostScheduledCard({ dateLabel, registeredCount, onOpenStudio, onCalendar }: Readonly<HostScheduledCardProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();

    return (
        <Card style={styles.card} testID="host-scheduled-card">
            <View style={styles.iconBox}>
                <Ionicons name="radio" size={28} color={colors.orangeText} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
                {t('watch.room.hostScheduledTitle')}
            </Text>
            <Text style={styles.desc}>{t('watch.room.hostScheduledDesc', { date: dateLabel })}</Text>
            <Badge tone="soft" label={t('watch.room.spotsLeft', { count: registeredCount, max: MAX_CO_STREAMERS })} />
            <Text style={styles.desc}>{t('watch.room.creatorAccessDesc')}</Text>
            <View style={styles.actions}>
                <Button
                    label={t('watch.room.hostScheduledBtn')}
                    icon={<Ionicons name="radio-outline" size={18} color={colors.onBrand} />}
                    onPress={onOpenStudio}
                    testID="host-open-studio"
                />
                <Button
                    label={t('watch.room.addToCalendar')}
                    variant="secondary"
                    icon={<Ionicons name="calendar-outline" size={18} color={colors.text} />}
                    onPress={onCalendar}
                    testID="host-calendar"
                />
            </View>
        </Card>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    card: {
        padding: 20,
        gap: 12,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: radii.lg,
        backgroundColor: colors.orangeSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
    },
    desc: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 20,
    },
    actions: {
        gap: 10,
    },
}));
