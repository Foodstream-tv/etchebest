import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

import { MAX_CO_STREAMERS } from './useLiveRoom';

export type ReservationMessage = { text: string; isError?: boolean };

type ReservationCardProps = {
    dateLabel: string;
    creatorName?: string;
    registeredCount: number;
    isReserved: boolean;
    isFull: boolean;
    signedIn: boolean;
    /** Which request is in flight, if any (buttons are disabled meanwhile) */
    busy: 'reserve' | 'cancel' | null;
    message: ReservationMessage | null;
    onReserve: () => void;
    onCancel: () => void;
    onCalendar: () => void;
    onSignIn: () => void;
};

/** Viewer side of a scheduled live: reserve / cancel a co-streamer spot, add to calendar. */
export default function ReservationCard({
    dateLabel,
    creatorName,
    registeredCount,
    isReserved,
    isFull,
    signedIn,
    busy,
    message,
    onReserve,
    onCancel,
    onCalendar,
    onSignIn,
}: Readonly<ReservationCardProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();

    const calendarButton = (
        <Button
            label={t('watch.room.addToCalendar')}
            variant="secondary"
            icon={<Ionicons name="calendar-outline" size={18} color={colors.text} />}
            onPress={onCalendar}
            testID="reservation-calendar"
        />
    );

    return (
        <Card style={styles.card} testID="reservation-card">
            <View style={styles.iconBox}>
                <Ionicons name="calendar" size={28} color={colors.orangeText} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
                {t('watch.room.viewerScheduledTitle')}
            </Text>
            <Text style={styles.desc}>
                {t('watch.room.viewerScheduledDesc', {
                    date: dateLabel,
                    creator: creatorName ? ` ${t('common.by', { name: creatorName })}` : '',
                })}
            </Text>

            <Badge
                tone="soft"
                label={isFull && !isReserved ? t('watch.room.full') : t('watch.room.spotsLeft', { count: registeredCount, max: MAX_CO_STREAMERS })}
            />

            {message ? (
                <Text
                    style={[styles.message, { color: message.isError ? colors.danger : colors.success }]}
                    accessibilityRole={message.isError ? 'alert' : undefined}
                    accessibilityLiveRegion="polite"
                    testID="reservation-message"
                >
                    {message.text}
                </Text>
            ) : null}

            <View style={styles.actions}>
                {isReserved ? (
                    <>
                        <Badge tone="soft" label={t('watch.room.reserved')} />
                        {calendarButton}
                        <Button
                            label={busy === 'cancel' ? t('watch.room.cancelling') : t('watch.room.cancelReservation')}
                            variant="danger"
                            size="sm"
                            loading={busy === 'cancel'}
                            disabled={busy !== null}
                            onPress={onCancel}
                            testID="reservation-cancel"
                        />
                    </>
                ) : isFull ? (
                    <>
                        <Text style={styles.full}>{t('watch.room.full')}</Text>
                        {calendarButton}
                    </>
                ) : (
                    <>
                        <Button
                            label={
                                signedIn
                                    ? busy === 'reserve'
                                        ? t('watch.room.reserving')
                                        : t('watch.room.reserve')
                                    : t('watch.room.loginToReserve')
                            }
                            loading={busy === 'reserve'}
                            disabled={busy !== null}
                            icon={<Ionicons name="people-outline" size={18} color={colors.onBrand} />}
                            onPress={signedIn ? onReserve : onSignIn}
                            testID="reservation-reserve"
                        />
                        {calendarButton}
                    </>
                )}
            </View>

            <Text style={styles.note}>{t('watch.room.viewerScheduledNote')}</Text>
        </Card>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    card: {
        padding: 20,
        gap: 12,
        alignItems: 'stretch',
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
    message: {
        fontSize: 13,
        fontWeight: '600',
    },
    actions: {
        gap: 10,
    },
    full: {
        color: colors.muted,
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'center',
    },
    note: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 18,
    },
}));
