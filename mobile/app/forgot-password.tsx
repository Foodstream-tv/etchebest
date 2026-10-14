import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import AuthLayout from '@/components/auth/AuthLayout';
import { blurActiveElementOnWeb } from '@/components/auth/helpers';
import FloatingLabelInput from '@/components/FloatingLabelInput';
import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import apiService from '@/services/api';
import { isApiError } from '@/utils/authErrors';
import { validateLoginEmail } from '@/utils/validation';

export default function ForgotPasswordScreen() {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [focused, setFocused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const submittingRef = useRef(false);

    const handleBack = useCallback(() => {
        blurActiveElementOnWeb();
        router.replace('/login' as never);
    }, [router]);

    const handleSubmit = useCallback(async () => {
        if (submittingRef.current) return;

        if (!validateLoginEmail(email).isValid) {
            setError(t('auth.signin.invalidEmail'));
            return;
        }

        setError(null);
        submittingRef.current = true;
        setLoading(true);
        try {
            // The backend answers the same message whether the account exists or not (no user enumeration).
            await apiService.forgotPassword(email);
            setSent(true);
        } catch (err) {
            setError(isApiError(err) ? t('auth.forgot.errorFailed') : t('auth.forgot.errorGeneric'));
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
    }, [email, t]);

    return (
        <AuthLayout
            testID="forgot-password-screen"
            back={{ label: t('auth.forgot.backToSignin'), onPress: handleBack, testID: 'back-to-login-button' }}
            label={t('auth.forgot.label')}
            title={sent ? t('auth.forgot.titleSent') : t('auth.forgot.title')}
            subtitle={sent ? t('auth.forgot.subtitleSent') : t('auth.forgot.subtitle')}
        >
            {sent ? (
                <View style={styles.sentBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
                    <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
                    <Text style={styles.sentText}>{t('auth.forgot.sentBanner')}</Text>
                </View>
            ) : (
                <>
                    <FloatingLabelInput
                        label={t('auth.signin.emailPlaceholder')}
                        iconName="mail-outline"
                        focused={focused}
                        value={email}
                        onChangeText={(value) => {
                            setEmail(value);
                            if (error) setError(null);
                        }}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        returnKeyType="send"
                        onSubmitEditing={handleSubmit}
                        editable={!loading}
                        error={error}
                    />

                    <Button
                        label={loading ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
                        onPress={handleSubmit}
                        loading={loading}
                        testID="forgot-submit"
                    />
                </>
            )}
        </AuthLayout>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    sentBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.25)',
        backgroundColor: 'rgba(34, 197, 94, 0.10)',
    },
    sentText: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
}));
