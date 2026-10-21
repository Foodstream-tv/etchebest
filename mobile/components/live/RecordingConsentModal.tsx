import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

type Props = {
    visible: boolean;
    busy?: boolean;
    onAccept: () => void;
    onCancel: () => void;
};

/**
 * A co-streamer appears in the recording of the live and in its public replay: ask for an explicit yes.
 * The box starts unticked and the button stays disabled until it is.
 */
export default function RecordingConsentModal({ visible, busy = false, onAccept, onCancel }: Readonly<Props>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();
    const [agreed, setAgreed] = useState(false);

    // A fresh ask each time: nothing carries over from a previous dialog.
    useEffect(() => {
        if (visible) setAgreed(false);
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onCancel} statusBarTranslucent>
            <View style={styles.scrim}>
                <View style={styles.sheet} accessibilityViewIsModal testID="recording-consent">
                    <View style={styles.iconBox}>
                        <Ionicons name="videocam" size={24} color={colors.orangeText} />
                    </View>
                    <Text style={styles.title} accessibilityRole="header">
                        {t('consent.recording.title')}
                    </Text>
                    <Text style={styles.body}>{t('consent.recording.body')}</Text>

                    <Pressable
                        style={styles.checkRow}
                        onPress={() => setAgreed((value) => !value)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: agreed }}
                        accessibilityLabel={t('consent.recording.checkbox')}
                        testID="recording-consent-checkbox"
                    >
                        <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={24} color={agreed ? colors.orange : colors.muted} />
                        <Text style={styles.checkLabel}>{t('consent.recording.checkbox')}</Text>
                    </Pressable>

                    <Text style={styles.note}>{t('consent.recording.withdraw')}</Text>

                    <View style={styles.actions}>
                        <Button
                            label={busy ? t('consent.recording.busy') : t('consent.recording.confirm')}
                            onPress={onAccept}
                            disabled={!agreed || busy}
                            loading={busy}
                            testID="recording-consent-accept"
                        />
                        <Button label={t('consent.recording.cancel')} variant="secondary" onPress={onCancel} disabled={busy} testID="recording-consent-cancel" />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    scrim: {
        flex: 1,
        backgroundColor: colors.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    sheet: {
        width: '100%',
        maxWidth: 440,
        padding: 20,
        gap: 12,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.cardSolid,
    },
    iconBox: {
        width: 48,
        height: 48,
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
    body: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 20,
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: radii.lg,
        backgroundColor: colors.surface,
        minHeight: 48,
    },
    checkLabel: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
        lineHeight: 19,
    },
    note: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 17,
    },
    actions: {
        gap: 10,
        marginTop: 4,
    },
}));
