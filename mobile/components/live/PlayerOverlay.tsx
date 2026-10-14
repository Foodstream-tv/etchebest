import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

import { PlayerStatus } from './playerRetry';

type PlayerOverlayProps = {
    status: PlayerStatus;
    /** Already translated error message (status "error") */
    message?: string | null;
    attempt?: number;
    maxAttempts?: number;
    onRetry?: () => void;
};

/**
 * Loading / "stream not started yet" / error layer drawn over a video surface.
 * Video surfaces stay dark in both themes, hence the white text.
 */
export default function PlayerOverlay({ status, message, attempt = 0, maxAttempts = 0, onRetry }: Readonly<PlayerOverlayProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();

    if (status === 'ready') return null;

    if (status === 'error') {
        return (
            <View style={styles.overlay} testID="player-error">
                <Ionicons name="cloud-offline-outline" size={36} color={colors.onBrand} />
                <Text style={styles.text} accessibilityRole="alert">
                    {message}
                </Text>
                {onRetry ? <Button label={t('common.retry')} variant="secondary" size="sm" onPress={onRetry} testID="player-retry" /> : null}
            </View>
        );
    }

    const label =
        status === 'waiting' ? t('live.player.waiting', { attempt, max: maxAttempts }) : t('live.player.loading');

    return (
        <View style={styles.overlay} testID={status === 'waiting' ? 'player-waiting' : 'player-loading'} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color={colors.orange} />
            <Text style={styles.text}>{label}</Text>
        </View>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    text: {
        color: colors.onBrand,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
}));
