import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

type SheetProps = React.PropsWithChildren<{
    visible: boolean;
    title: string;
    onClose: () => void;
    /** Disables backdrop / close-button dismissal (a request is in flight) */
    locked?: boolean;
    /** Wrap the body in a ScrollView (forms) instead of letting the child manage scrolling (lists) */
    scroll?: boolean;
    testID?: string;
}>;

/** Themed modal card shared by the profile sheets (follow lists, edit profile, password, delete). */
export default function Sheet({ visible, title, onClose, locked = false, scroll = true, children, testID }: Readonly<SheetProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();
    const dismiss = locked ? undefined : onClose;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
            <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <Pressable style={styles.scrim} onPress={dismiss} accessibilityLabel={t('common.close')} accessibilityRole="button" />
                <View style={styles.card} testID={testID} accessibilityViewIsModal>
                    <View style={styles.header}>
                        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
                            {title}
                        </Text>
                        <Pressable
                            onPress={dismiss}
                            disabled={locked}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={t('profile.closeWindowAria')}
                            style={styles.close}
                        >
                            <Ionicons name="close" size={22} color={colors.text} />
                        </Pressable>
                    </View>
                    {scroll ? (
                        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
                            {children}
                        </ScrollView>
                    ) : (
                        children
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    backdrop: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: colors.overlay,
    },
    scrim: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    card: {
        maxHeight: '90%',
        backgroundColor: colors.cardSolid,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        flex: 1,
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
    },
    close: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
    },
    body: {
        padding: 20,
        gap: 4,
    },
}));
