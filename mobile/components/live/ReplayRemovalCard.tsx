import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { removeReplay } from '@/services/lives';
import { ApiError } from '@/services/http';
import { confirmAction } from '@/utils/confirm';

type Props = {
    roomId: string;
    /** Called once the replay is gone, so the screen can reload the live. */
    onRemoved: () => void;
};

/**
 * The host and everyone who took part in the live can withdraw its replay. A stranger gets a clear
 * answer instead of a silent failure.
 */
export default function ReplayRemovalCard({ roomId, onRemoved }: Readonly<Props>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const run = async () => {
        setBusy(true);
        setMessage(null);
        try {
            await removeReplay(roomId);
            setMessage({ text: t('replays.removal.done'), isError: false });
            onRemoved();
        } catch (err) {
            const forbidden = err instanceof ApiError && err.status === 403;
            setMessage({ text: t(forbidden ? 'replays.removal.forbidden' : 'replays.removal.failed'), isError: true });
        } finally {
            setBusy(false);
        }
    };

    const onPress = () =>
        confirmAction({
            title: t('replays.removal.title'),
            message: t('replays.removal.confirm'),
            confirmLabel: t('replays.removal.button'),
            cancelLabel: t('common.cancel'),
            destructive: true,
            onConfirm: () => void run(),
        });

    return (
        <Card style={styles.card} testID="replay-removal">
            <View style={styles.head}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.orangeText} />
                <Text style={styles.title} accessibilityRole="header">
                    {t('replays.removal.title')}
                </Text>
            </View>
            <Text style={styles.body}>{t('replays.removal.body')}</Text>
            {message ? (
                <Text
                    style={[styles.message, { color: message.isError ? colors.danger : colors.success }]}
                    accessibilityRole={message.isError ? 'alert' : undefined}
                    accessibilityLiveRegion="polite"
                >
                    {message.text}
                </Text>
            ) : null}
            <Button
                label={busy ? t('replays.removal.busy') : t('replays.removal.button')}
                variant="danger"
                size="sm"
                loading={busy}
                disabled={busy}
                onPress={onPress}
                testID="replay-removal-button"
            />
        </Card>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    card: {
        padding: 16,
        gap: 10,
    },
    head: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        flex: 1,
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    body: {
        color: colors.muted,
        fontSize: 13,
        lineHeight: 18,
    },
    message: {
        fontSize: 13,
        fontWeight: '600',
    },
}));
