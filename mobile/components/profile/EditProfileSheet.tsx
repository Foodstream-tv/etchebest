import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import Field from '@/components/profile/Field';
import Sheet from '@/components/profile/Sheet';
import { BIO_MAX, ProfileFormErrors, ProfileFormValues, profileErrorMessage, validateProfileForm } from '@/components/profile/profileValidation';
import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';

type EditProfileSheetProps = {
    visible: boolean;
    initialValues: ProfileFormValues;
    /** Must reject on failure (the sheet shows a message) and resolve once saved */
    onSubmit: (values: ProfileFormValues) => Promise<void>;
    onClose: () => void;
};

/** Edit-profile form (web edit modal): validates, blocks double submit, shows API errors. */
export default function EditProfileSheet({ visible, initialValues, onSubmit, onClose }: Readonly<EditProfileSheetProps>) {
    const styles = useStyles();
    const { t } = useI18n();
    const [values, setValues] = useState<ProfileFormValues>(initialValues);
    const [errors, setErrors] = useState<ProfileFormErrors>({});
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

    // Reset the form from the latest profile every time the sheet opens.
    useEffect(() => {
        if (visible) {
            setValues(initialValues);
            setErrors({});
            setFormError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const setField = useCallback((field: keyof ProfileFormValues, value: string) => {
        setValues((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    }, []);

    const handleSubmit = useCallback(async () => {
        if (submitting.current) return;
        const validation = validateProfileForm(values, t);
        if (Object.values(validation).some(Boolean)) {
            setErrors(validation);
            return;
        }
        submitting.current = true;
        setSaving(true);
        setFormError(null);
        try {
            await onSubmit(values);
        } catch (error) {
            if (mounted.current) setFormError(profileErrorMessage(error, t));
        } finally {
            submitting.current = false;
            if (mounted.current) setSaving(false);
        }
    }, [onSubmit, t, values]);

    return (
        <Sheet visible={visible} title={t('profile.edit.modalTitle')} onClose={onClose} locked={saving} testID="edit-profile-sheet">
            <Field label={t('profile.edit.firstName')} iconName="person-outline" value={values.firstName} onChangeText={(v) => setField('firstName', v)} error={errors.firstName} autoCapitalize="words" autoComplete="given-name" />
            <Field label={t('profile.edit.lastName')} iconName="person-outline" value={values.lastName} onChangeText={(v) => setField('lastName', v)} error={errors.lastName} autoCapitalize="words" autoComplete="family-name" />
            <Field label={t('profile.edit.username')} iconName="at-outline" value={values.username} onChangeText={(v) => setField('username', v)} error={errors.username} autoCapitalize="none" autoCorrect={false} autoComplete="username" />
            <Field label={t('profile.edit.email')} iconName="mail-outline" value={values.email} onChangeText={(v) => setField('email', v)} error={errors.email} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
            <Field label={t('profile.edit.bio')} iconName="create-outline" value={values.description} onChangeText={(v) => setField('description', v)} error={errors.description} multiline maxLength={BIO_MAX + 50} />

            {formError ? (
                <Text style={styles.error} accessibilityRole="alert">
                    {formError}
                </Text>
            ) : null}

            <View style={styles.actions}>
                <Button label={t('common.cancel')} variant="secondary" onPress={onClose} disabled={saving} style={styles.action} />
                <Button label={t('common.save')} onPress={handleSubmit} loading={saving} style={styles.action} testID="edit-profile-save" />
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
