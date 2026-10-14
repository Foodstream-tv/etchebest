import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import Sheet from '@/components/profile/Sheet';
import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

type DeleteAccountSheetProps = {
    visible: boolean;
    loading?: boolean;
    error?: string | null;
    onConfirm: () => void;
    onClose: () => void;
};

/** Explicit confirmation before the irreversible account deletion. */
export default function DeleteAccountSheet({ visible, loading = false, error, onConfirm, onClose }: Readonly<DeleteAccountSheetProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();

    return (
        <Sheet visible={visible} title={t('settings.delete.title')} onClose={onClose} locked={loading} testID="delete-account-sheet">
            <View style={styles.warning}>
                <Ionicons name="warning-outline" size={22} color={colors.danger} />
                <Text style={styles.message}>{t('settings.delete.message')}</Text>
            </View>
            {error ? (
                <Text style={styles.error} accessibilityRole="alert">
                    {error}
                </Text>
            ) : null}
            <View style={styles.actions}>
                <Button label={t('common.cancel')} variant="secondary" onPress={onClose} disabled={loading} style={styles.action} />
                <Button label={t('settings.delete.confirm')} variant="danger" onPress={onConfirm} loading={loading} style={styles.action} testID="delete-account-confirm" />
            </View>
        </Sheet>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    warning: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
        padding: 14,
        borderRadius: radii.lg,
        backgroundColor: colors.dangerSoft,
    },
    message: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    error: {
        color: colors.danger,
        fontSize: 13,
        fontWeight: '500',
        marginTop: 10,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    action: {
        flex: 1,
    },
}));
