import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import Field from '@/components/profile/Field';
import Sheet from '@/components/profile/Sheet';
import { PasswordFormErrors, passwordErrorMessage, validatePasswordForm } from '@/components/profile/profileValidation';
import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';

type ChangePasswordSheetProps = {
    visible: boolean;
    /** Resolves once the password is changed, rejects (ApiError) otherwise */
    onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
    onClose: () => void;
};

/** Password change form: current / new / confirm, validated like `PATCH /users/me/password`. */
export default function ChangePasswordSheet({ visible, onSubmit, onClose }: Readonly<ChangePasswordSheetProps>) {
    const styles = useStyles();
    const { t } = useI18n();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [errors, setErrors] = useState<PasswordFormErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const submitting = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    // Never keep passwords in memory once the sheet is closed.
    useEffect(() => {
        if (!visible) {
            setCurrent('');
            setNext('');
            setConfirm('');
            setErrors({});
            setFormError(null);
        }
    }, [visible]);

    const handleSubmit = useCallback(async () => {
        if (submitting.current) return;
        const validation = validatePasswordForm({ current, next, confirm }, t);
        if (Object.values(validation).some(Boolean)) {
            setErrors(validation);
            setFormError(null);
            return;
        }
        submitting.current = true;
        setSaving(true);
        setErrors({});
        setFormError(null);
        try {
            await onSubmit(current, next);
        } catch (error) {
            if (mounted.current) setFormError(passwordErrorMessage(error, t));
        } finally {
            submitting.current = false;
            if (mounted.current) setSaving(false);
        }
    }, [confirm, current, next, onSubmit, t]);

    return (
        <Sheet visible={visible} title={t('settings.password.title')} onClose={onClose} locked={saving} testID="password-sheet">
            <Field label={t('settings.password.current')} iconName="lock-closed-outline" value={current} onChangeText={setCurrent} error={errors.current} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" />
            <Field label={t('settings.password.new')} iconName="key-outline" value={next} onChangeText={setNext} error={errors.next} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
            <Field label={t('settings.password.confirm')} iconName="key-outline" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />

            {formError ? (
                <Text style={styles.error} accessibilityRole="alert">
                    {formError}
                </Text>
            ) : null}

            <View style={styles.actions}>
                <Button label={t('common.cancel')} variant="secondary" onPress={onClose} disabled={saving} style={styles.action} />
                <Button label={t('common.save')} onPress={handleSubmit} loading={saving} style={styles.action} testID="password-save" />
            </View>
        </Sheet>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    error: {
        color: colors.danger,
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 8,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    action: {
        flex: 1,
    },
}));
