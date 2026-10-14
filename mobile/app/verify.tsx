import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import AuthLayout from '@/components/auth/AuthLayout';
import { blurActiveElementOnWeb } from '@/components/auth/helpers';
import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import apiService from '@/services/api';
import { formatBanMessage } from '@/services/session';
import { bodyString, isApiError, isBannedError } from '@/utils/authErrors';
import { completeSignIn, ProfileUnavailableError } from '@/utils/completeSignIn';

const CODE_LENGTH = 6;
const RESEND_DELAY_SECONDS = 60;
const REDIRECT_DELAY_MS = 1200;

type Param = string | string[] | undefined;

const firstParam = (value: Param): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, CODE_LENGTH);

/** `john.doe@mail.com` -> `j***e@mail.com` (same masking as the web verify page). A server-masked target is kept as is. */
function maskTarget(target: string): string {
    if (!target.includes('@') || target.includes('*')) return target;
    const [name, domain] = target.split('@');
    if (name.length <= 2) return `${name.slice(0, 1)}***@${domain}`;
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export default function VerifyScreen() {
    const { t, locale } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams<{ userId?: Param; email?: Param; devCode?: Param }>();

    const userId = firstParam(params?.userId);
    const email = firstParam(params?.email);
    const initialDevCode = digitsOnly(firstParam(params?.devCode));
    const hasAccount = Boolean(userId || email);

    const [targetDisplay, setTargetDisplay] = useState(email);
    const [code, setCode] = useState(initialDevCode);
    const [devCode, setDevCode] = useState(initialDevCode);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(hasAccount ? null : t('auth.verify.missingAccount'));
    const [notice, setNotice] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [countdown, setCountdown] = useState(RESEND_DELAY_SECONDS);
    const [focused, setFocused] = useState(false);

    const submittingRef = useRef(false);
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Resend countdown: one interval while counting, always cleared on unmount.
    const counting = countdown > 0;
    useEffect(() => {
        if (!counting) return;
        const id = setInterval(() => {
            setCountdown((current) => Math.max(0, current - 1));
        }, 1000);
        return () => clearInterval(id);
    }, [counting]);

    useEffect(
        () => () => {
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        },
        []
    );

    const maskedTarget = useMemo(
        () => (targetDisplay ? maskTarget(targetDisplay) : t('auth.verify.fallbackTarget')),
        [targetDisplay, t]
    );

    const redirectLater = useCallback(
        (path: string) => {
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
            redirectTimerRef.current = setTimeout(() => {
                router.replace(path as never);
            }, REDIRECT_DELAY_MS);
        },
        [router]
    );

    const describeVerifyError = useCallback(
        (err: unknown): string => {
            if (err instanceof ProfileUnavailableError) {
                return isBannedError(err.cause)
                    ? formatBanMessage(bodyString(err.cause, 'bannedUntil'), locale)
                    : t('auth.signin.fetchProfileError');
            }
            if (isBannedError(err)) {
                return formatBanMessage(bodyString(err, 'bannedUntil'), locale);
            }
            if (isApiError(err)) {
                if (err.status === 429) return t('auth.verify.errorTooMany');
                if (err.status === 404) return t('auth.verify.missingAccount');
                if (err.status === 400) {
                    const message = (bodyString(err, 'error') ?? '').toLowerCase();
                    return message.includes('required') ? t('auth.verify.missingAccount') : t('auth.verify.errorInvalidCode');
                }
            }
            return t('auth.verify.errorGeneric');
        },
        [locale, t]
    );

    const handleVerify = useCallback(
        async (codeToVerify?: string) => {
            if (submittingRef.current || success) return;

            const value = (codeToVerify ?? code).trim();
            if (value.length !== CODE_LENGTH) {
                setError(t('auth.verify.errorInvalidCode'));
                return;
            }
            if (!hasAccount) {
                setError(t('auth.verify.missingAccount'));
                return;
            }

            submittingRef.current = true;
            setLoading(true);
            setError(null);
            try {
                const response = await apiService.verifyAccount({
                    userId: userId || undefined,
                    email: email || undefined,
                    code: value,
                });

                if (response?.token) {
                    // Token -> profile -> persisted session, then the success view, then the app.
                    await completeSignIn(response.token);
                    setSuccess(true);
                    redirectLater('/');
                } else {
                    setSuccess(true);
                    redirectLater('/login');
                }
            } catch (err) {
                setError(describeVerifyError(err));
            } finally {
                submittingRef.current = false;
                setLoading(false);
            }
        },
        [code, describeVerifyError, email, hasAccount, redirectLater, success, t, userId]
    );

    const handleResend = useCallback(async () => {
        if (resending || countdown > 0 || !hasAccount) return;

        setResending(true);
        setError(null);
        setNotice(null);
        try {
            const response = await apiService.resendVerificationCode({
                userId: userId || undefined,
                email: email || undefined,
            });
            if (response?.target) setTargetDisplay(response.target);
            if (response?.devCode) {
                const next = digitsOnly(response.devCode);
                setDevCode(next);
                setCode(next);
            }
            setNotice(t('auth.verify.resendSuccess'));
            setCountdown(RESEND_DELAY_SECONDS);
        } catch (err) {
            if (isApiError(err) && err.status === 429) {
                const retry = Number(err.body?.retryAfterSec);
                const seconds = Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : RESEND_DELAY_SECONDS;
                setCountdown(seconds);
                setError(t('auth.verify.resendTooSoon', { seconds }));
            } else if (isApiError(err) && err.status === 400 && (bodyString(err, 'error') ?? '').includes('already verified')) {
                setError(t('auth.verify.alreadyVerified'));
            } else if (isApiError(err) && err.status === 404) {
                setError(t('auth.verify.missingAccount'));
            } else {
                setError(t('auth.verify.errorGeneric'));
            }
        } finally {
            setResending(false);
        }
    }, [countdown, email, hasAccount, resending, t, userId]);

    const handleCodeChange = useCallback(
        (value: string) => {
            const digits = digitsOnly(value);
            setCode(digits);
            setError(null);
            setNotice(null);

            // Auto-submit as soon as the 6th digit is typed / pasted / auto-filled.
            if (digits.length === CODE_LENGTH) {
                void handleVerify(digits);
            }
        },
        [handleVerify]
    );

    const handleBackToLogin = useCallback(() => {
        blurActiveElementOnWeb();
        router.replace('/login' as never);
    }, [router]);

    if (success) {
        return (
            <AuthLayout
                testID="verify-screen"
                label={t('auth.verify.label')}
                title={t('auth.verify.title')}
                subtitle={t('auth.verify.successSubtitle')}
            >
                <View style={styles.successWrap} accessibilityRole="alert" accessibilityLiveRegion="polite">
                    <View style={styles.successIcon}>
                        <Ionicons name="checkmark-circle" size={44} color={colors.success} />
                    </View>
                    <Text style={styles.successText}>{t('auth.verify.successBody')}</Text>
                </View>
            </AuthLayout>
        );
    }

    const canSubmit = code.length === CODE_LENGTH && hasAccount;

    return (
        <AuthLayout
            testID="verify-screen"
            label={t('auth.verify.label')}
            title={t('auth.verify.title')}
            subtitle={t('auth.verify.subtitle', { target: maskedTarget })}
        >
            <View style={styles.targetBadge}>
                <Ionicons name="mail-outline" size={18} color={colors.orange} />
                <Text style={styles.targetText}>
                    {t('auth.verify.sentTo')} <Text style={styles.targetStrong}>{maskedTarget}</Text>
                </Text>
            </View>

            <Text style={styles.codeLabel}>{t('auth.verify.codeLabel')}</Text>
            <TextInput
                testID="verify-code-input"
                value={code}
                onChangeText={handleCodeChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={() => handleVerify()}
                style={[styles.codeInput, focused && styles.codeInputFocused, !!error && styles.codeInputError]}
                placeholder={t('auth.verify.codePlaceholder')}
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={CODE_LENGTH}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                selectionColor={colors.orange}
                editable={!loading}
                accessibilityLabel={t('auth.verify.codeLabel')}
                accessibilityHint={t('auth.verify.codeHint')}
            />

            {devCode ? (
                <View style={styles.devBox} testID="verify-dev-code">
                    <Text style={styles.devText}>{t('auth.verify.devNotice', { code: devCode })}</Text>
                    <Pressable
                        onPress={() => {
                            setCode(devCode);
                            void handleVerify(devCode);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('auth.verify.devFill')}
                        hitSlop={8}
                        style={styles.devButton}
                    >
                        <Text style={styles.devLink}>{t('auth.verify.devFill')}</Text>
                    </Pressable>
                </View>
            ) : null}

            {notice ? (
                <Text style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
                    {notice}
                </Text>
            ) : null}

            {error ? (
                <Text style={styles.error} accessibilityRole="alert">
                    {error}
                </Text>
            ) : null}

            <Button
                label={loading ? t('auth.verify.submitting') : t('auth.verify.submit')}
                onPress={() => handleVerify()}
                loading={loading}
                disabled={!canSubmit}
                testID="verify-submit"
            />

            <View style={styles.footer}>
                <Pressable
                    onPress={handleBackToLogin}
                    accessibilityRole="link"
                    accessibilityLabel={t('auth.verify.backToSignin')}
                    testID="verify-back"
                    hitSlop={8}
                    style={styles.backLink}
                >
                    <Ionicons name="arrow-back" size={16} color={colors.muted} />
                    <Text style={styles.backText}>{t('auth.verify.backToSignin')}</Text>
                </Pressable>

                <Button
                    variant="ghost"
                    size="sm"
                    label={countdown > 0 ? t('auth.verify.resendWait', { seconds: countdown }) : t('auth.verify.resend')}
                    accessibilityLabel={t('auth.verify.resendAria')}
                    onPress={handleResend}
                    loading={resending}
                    disabled={countdown > 0 || !hasAccount}
                    testID="verify-resend"
                    style={styles.resend}
                />
            </View>
        </AuthLayout>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    targetBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        marginBottom: 18,
    },
    targetText: {
        flex: 1,
        color: colors.muted,
        fontSize: 13,
    },
    targetStrong: {
        color: colors.text,
        fontWeight: '600',
    },
    codeLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    codeInput: {
        minHeight: 64,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        color: colors.text,
        textAlign: 'center',
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 14,
    },
    codeInputFocused: {
        borderColor: colors.orange,
        boxShadow: `0px 0px 0px 3px ${colors.orangeGlow}`,
    },
    codeInputError: {
        borderColor: colors.danger,
    },
    devBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: 12,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.warning,
        backgroundColor: colors.orangeSoft,
        marginBottom: 14,
    },
    devText: {
        flex: 1,
        color: colors.warning,
        fontSize: 12,
    },
    devButton: {
        minHeight: 44,
        justifyContent: 'center',
    },
    devLink: {
        color: colors.warning,
        fontSize: 12,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    notice: {
        color: colors.success,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 12,
    },
    error: {
        color: colors.danger,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 12,
    },
    footer: {
        marginTop: 18,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    backLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
        flexShrink: 1,
    },
    backText: {
        color: colors.muted,
        fontSize: 13,
        flexShrink: 1,
    },
    resend: {
        flexShrink: 0,
    },
    successWrap: {
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
    },
    successIcon: {
        width: 72,
        height: 72,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.orangeSoft,
    },
    successText: {
        color: colors.muted,
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 21,
    },
}));
