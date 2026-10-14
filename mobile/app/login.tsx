import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import AuthLayout from '@/components/auth/AuthLayout';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { blurActiveElementOnWeb, inputRef } from '@/components/auth/helpers';
import FloatingLabelInput from '@/components/FloatingLabelInput';
import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import apiService from '@/services/api';
import { formatBanMessage } from '@/services/session';
import { bodyString, isApiError, isBannedError, isUnverifiedError } from '@/utils/authErrors';
import { completeSignIn, ProfileUnavailableError } from '@/utils/completeSignIn';
import { validateLoginEmail, validateLoginPassword } from '@/utils/validation';

type FocusedField = 'email' | 'password' | null;
type UnverifiedInfo = { userId?: string; email: string };

export default function LoginScreen() {
    const { t, locale } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [obscurePassword, setObscurePassword] = useState(true);
    const [focusedField, setFocusedField] = useState<FocusedField>(null);
    const [loading, setLoading] = useState(false);
    const [googleBusy, setGoogleBusy] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const [unverified, setUnverified] = useState<UnverifiedInfo | null>(null);

    const passwordRef = useRef<TextInput>(null);
    const submittingRef = useRef(false);

    const goToVerify = useCallback(
        (info: UnverifiedInfo) => {
            blurActiveElementOnWeb();
            const params: Record<string, string> = { email: info.email };
            if (info.userId) params.userId = info.userId;
            router.push({ pathname: '/verify', params } as never);
        },
        [router]
    );

    const handleLogin = useCallback(async () => {
        if (submittingRef.current) return;

        // Sign-in only checks the e-mail shape and a non-empty password (web parity):
        // complexity rules must never lock out an existing account.
        const emailCheck = validateLoginEmail(email);
        const passwordCheck = validateLoginPassword(password);

        setEmailError(emailCheck.isValid ? null : t('auth.signin.invalidEmail'));
        setPasswordError(passwordCheck.isValid ? null : t('auth.signin.emptyPassword'));
        setApiError(null);
        setUnverified(null);

        if (!emailCheck.isValid || !passwordCheck.isValid) {
            return;
        }

        submittingRef.current = true;
        setLoading(true);
        try {
            const login = await apiService.login({ email, password });
            if (!login?.token) {
                setApiError(t('auth.signin.serverError'));
                return;
            }

            await completeSignIn(login.token);
            router.replace('/');
        } catch (error) {
            if (isUnverifiedError(error)) {
                const info = {
                    userId: bodyString(error, 'userId'),
                    email: bodyString(error, 'email') ?? email.trim(),
                };
                setUnverified(info);
                setApiError(t('auth.signin.notVerified'));
                goToVerify(info);
            } else if (isBannedError(error)) {
                setApiError(formatBanMessage(bodyString(error, 'bannedUntil'), locale));
            } else if (isApiError(error) && (error.status === 401 || error.status === 400)) {
                // 400: the backend refuses passwords shorter than 8 characters, they can never match an account.
                setApiError(t('auth.signin.invalidCreds'));
            } else if (error instanceof ProfileUnavailableError) {
                setApiError(
                    isBannedError(error.cause)
                        ? formatBanMessage(bodyString(error.cause, 'bannedUntil'), locale)
                        : t('auth.signin.fetchProfileError')
                );
            } else {
                setApiError(t('auth.signin.genericError'));
            }
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
    }, [email, password, goToVerify, locale, router, t]);

    const handleForgotPassword = useCallback(() => {
        blurActiveElementOnWeb();
        router.push('/forgot-password');
    }, [router]);

    const handleRegister = useCallback(() => {
        blurActiveElementOnWeb();
        router.push('/register');
    }, [router]);

    const hero = (
        <View style={styles.hero}>
            <Text style={styles.headline} accessibilityRole="header">
                {t('auth.hero.top')}
                {'\n'}
                {t('auth.hero.middle')}
                {'\n'}
                <Text style={styles.headlineAccent}>{t('auth.hero.accent')}</Text>
            </Text>
            <Text style={styles.heroDescription}>{t('auth.hero.description')}</Text>
        </View>
    );

    return (
        <AuthLayout
            testID="login-screen"
            hero={hero}
            label={t('auth.signin.label')}
            title={t('auth.signin.title')}
            subtitle={t('auth.signin.subtitle')}
            bottomText={t('auth.signin.noAccount')}
            bottomLinkLabel={t('auth.signin.signupLink')}
            onBottomLinkPress={handleRegister}
        >
            <FloatingLabelInput
                label={t('auth.signin.emailPlaceholder')}
                iconName="mail-outline"
                focused={focusedField === 'email'}
                value={email}
                onChangeText={(value) => {
                    setEmail(value);
                    setEmailError(null);
                }}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!loading}
                error={emailError}
            />

            <FloatingLabelInput
                {...inputRef(passwordRef)}
                label={t('auth.signin.passwordPlaceholder')}
                iconName="lock-closed-outline"
                focused={focusedField === 'password'}
                value={password}
                onChangeText={(value) => {
                    setPassword(value);
                    setPasswordError(null);
                }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={obscurePassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                editable={!loading}
                error={passwordError}
                trailingIcon={
                    <Pressable
                        onPress={() => setObscurePassword((value) => !value)}
                        accessibilityRole="button"
                        accessibilityLabel={obscurePassword ? t('auth.password.show') : t('auth.password.hide')}
                        hitSlop={10}
                        style={styles.eyeButton}
                    >
                        <Ionicons
                            name={obscurePassword ? 'eye-off-outline' : 'eye-outline'}
                            size={22}
                            color={colors.muted}
                        />
                    </Pressable>
                }
            />

            <Pressable
                onPress={handleForgotPassword}
                accessibilityRole="link"
                accessibilityLabel={t('auth.signin.forgotPassword')}
                hitSlop={8}
                style={styles.forgotWrap}
            >
                <Text style={styles.forgotText}>{t('auth.signin.forgotPassword')}</Text>
            </Pressable>

            {apiError ? (
                <View style={styles.errorBlock}>
                    <Text style={styles.errorText} accessibilityRole="alert">
                        {apiError}
                    </Text>
                    {unverified ? (
                        <Pressable
                            onPress={() => goToVerify(unverified)}
                            accessibilityRole="link"
                            accessibilityLabel={t('auth.signin.verifyNow')}
                            hitSlop={8}
                            style={styles.verifyLinkWrap}
                        >
                            <Text style={styles.verifyLink}>{t('auth.signin.verifyNow')} →</Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}

            <Button
                label={loading ? t('auth.signin.submitting') : t('auth.signin.submit')}
                onPress={handleLogin}
                loading={loading}
                disabled={googleBusy}
                testID="login-submit"
            />

            <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>{t('auth.signin.or')}</Text>
                <View style={styles.dividerLine} />
            </View>

            <GoogleAuthButton disabled={loading} onBusyChange={setGoogleBusy} />
        </AuthLayout>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    hero: {
        marginBottom: 22,
    },
    headline: {
        color: colors.text,
        fontSize: 32,
        lineHeight: 38,
        fontWeight: '600',
        letterSpacing: -0.8,
    },
    headlineAccent: {
        color: colors.orange,
    },
    heroDescription: {
        marginTop: 12,
        color: colors.muted,
        fontSize: 15,
        lineHeight: 22,
    },
    eyeButton: {
        padding: 4,
        marginLeft: 8,
    },
    forgotWrap: {
        alignSelf: 'flex-end',
        minHeight: 44,
        justifyContent: 'center',
        marginTop: -6,
    },
    forgotText: {
        color: colors.orangeText,
        fontSize: 13,
        fontWeight: '600',
    },
    errorBlock: {
        marginBottom: 12,
        gap: 4,
    },
    errorText: {
        color: colors.danger,
        fontSize: 14,
        fontWeight: '500',
    },
    verifyLinkWrap: {
        minHeight: 44,
        justifyContent: 'center',
    },
    verifyLink: {
        color: colors.orangeText,
        fontSize: 13,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    dividerLabel: {
        color: colors.muted,
        fontSize: 14,
    },
}));
