import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as GoogleAuth from 'expo-auth-session/providers/google';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

import { brandHeadlineFont, brandTheme } from '@/constants/brandTheme';
import { LanguageProvider, useI18n } from '@/contexts/LanguageContext';
import { createShadowStyle } from '@/utils/shadow';
import appConfig from '../config/env';
import apiService from '../services/api';
import { authService } from '../services/auth';
import { validateEmail, validatePassword } from '../utils/validation';

const isExpoGo =
    Platform.OS !== 'web' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isNativeGoogleSignInSupported = Platform.OS !== 'web' && !isExpoGo;
const googleWebClientId = appConfig.googleClientId;
const googleAndroidClientId = appConfig.googleAndroidClientId || googleWebClientId;
const googleIosClientId = appConfig.googleIosClientId || googleWebClientId;
const configuredGoogleRedirectUri = appConfig.googleRedirectUri.trim().replace(/\/+$/, '');
const defaultGoogleWebRedirectUri =
    Platform.OS === 'web' && globalThis.window !== undefined ? globalThis.window.location.origin : '';
const defaultGoogleNativeRedirectUri =
    Platform.OS === 'web' ? '' : makeRedirectUri({ scheme: 'foodstream', path: 'oauthredirect' });
const googleRedirectUri =
    Platform.OS === 'web'
        ? configuredGoogleRedirectUri || defaultGoogleWebRedirectUri
        : defaultGoogleNativeRedirectUri;

WebBrowser.maybeCompleteAuthSession();

type LoginCopy = {
    invalidEmail: string;
    invalidPassword: string;
    unknownError: string;
    googleNotSupported: string;
    googleExpoGoUnsupported: string;
    googleNotConfigured: string;
    googlePromptUnavailable: string;
    googleTokenMissing: string;
    googleCancelled: string;
    googleInProgress: string;
    googlePlayServicesMissing: string;
    googleUnknown: string;
    appleUnavailable: string;
    headlineTop: string;
    headlineMiddle: string;
    headlineAccent: string;
    heroDescription: string;
    sectionLabel: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    loginButton: string;
    divider: string;
    continueGoogle: string;
    continueApple: string;
    forgotPassword: string;
    noAccount: string;
    register: string;
};

const LOGIN_COPY: Record<'fr' | 'en', LoginCopy> = {
    fr: {
        invalidEmail: 'Email invalide',
        invalidPassword: 'Mot de passe invalide',
        unknownError: 'Desole, une erreur inattendue est survenue.',
        googleNotSupported: 'Connexion Google indisponible sur cet appareil.',
        googleExpoGoUnsupported: 'Connexion Google non disponible dans Expo Go. Utilisez le web ou un build de developpement.',
        googleNotConfigured: 'Configuration Google manquante. Verifiez EXPO_PUBLIC_GOOGLE_CLIENT_ID.',
        googlePromptUnavailable: 'Connexion Google indisponible pour le moment. Reessayez.',
        googleTokenMissing: "Impossible de recuperer le jeton d'acces Google.",
        googleCancelled: 'Connexion annulee',
        googleInProgress: 'Connexion deja en cours',
        googlePlayServicesMissing: 'Google Play Services indisponible sur cet appareil',
        googleUnknown: 'Erreur inattendue de connexion avec Google.',
        appleUnavailable: "La connexion avec Apple n'est pas encore disponible",
        headlineTop: 'Cuisinez en live.',
        headlineMiddle: 'Apprenez avec les',
        headlineAccent: 'meilleurs chefs.',
        heroDescription: 'Lives culinaires, masterclass privees et une communaute qui cuisine ensemble.',
        sectionLabel: 'CONNEXION',
        emailPlaceholder: 'Adresse e-mail',
        passwordPlaceholder: 'Mot de passe',
        loginButton: 'Se connecter',
        divider: 'Ou',
        continueGoogle: 'Continuer avec Google',
        continueApple: 'Continuer avec Apple',
        forgotPassword: 'Mot de passe oublie ?',
        noAccount: "Vous n'avez pas de compte ? ",
        register: 'Inscrivez-vous',
    },
    en: {
        invalidEmail: 'Invalid email',
        invalidPassword: 'Invalid password',
        unknownError: 'Sorry, an unexpected error occurred.',
        googleNotSupported: 'Google sign-in is unavailable on this device.',
        googleExpoGoUnsupported: 'Google sign-in is not available in Expo Go. Use web or a development build.',
        googleNotConfigured: 'Google OAuth is not configured. Check EXPO_PUBLIC_GOOGLE_CLIENT_ID.',
        googlePromptUnavailable: 'Google sign-in is not ready yet. Please try again.',
        googleTokenMissing: 'Unable to retrieve Google access token.',
        googleCancelled: 'Sign in cancelled',
        googleInProgress: 'Sign in already in progress',
        googlePlayServicesMissing: 'Google Play Services unavailable on this device',
        googleUnknown: 'Unexpected Google sign-in error.',
        appleUnavailable: 'Apple sign-in is not available yet',
        headlineTop: 'Cook live.',
        headlineMiddle: 'Learn from the',
        headlineAccent: 'best chefs.',
        heroDescription: 'Live cooking sessions, private masterclasses, and a community that cooks together.',
        sectionLabel: 'SIGN IN',
        emailPlaceholder: 'Email address',
        passwordPlaceholder: 'Password',
        loginButton: 'Sign in',
        divider: 'Or',
        continueGoogle: 'Continue with Google',
        continueApple: 'Continue with Apple',
        forgotPassword: 'Forgot password?',
        noAccount: "Don't have an account? ",
        register: 'Sign up',
    },
};

export default function LoginScreen() {
    return (
        <LanguageProvider>
            <LoginScreenContent />
        </LanguageProvider>
    );
}

function LoginScreenContent() {
    const { locale } = useI18n();
    const copy = LOGIN_COPY[locale];
    const { height } = useWindowDimensions();
    const useCompactHero = height < 830;

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [obscurePassword, setObscurePassword] = useState(true);
    const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [socialMessage, setSocialMessage] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);

    const router = useRouter();
    const [googleAuthRequest, , promptGoogleAuth] = GoogleAuth.useAuthRequest({
        clientId: googleWebClientId || undefined,
        webClientId: googleWebClientId || undefined,
        androidClientId: isNativeGoogleSignInSupported ? googleAndroidClientId || undefined : undefined,
        iosClientId: isNativeGoogleSignInSupported ? googleIosClientId || undefined : undefined,
        redirectUri: googleRedirectUri || undefined,
        responseType: 'token',
        scopes: ['openid', 'profile', 'email'],
    });

    const handleLogin = useCallback(async () => {
        const emailValidation = validateEmail(email);
        const passwordValidation = validatePassword(password);

        setEmailError(emailValidation.isValid ? null : (emailValidation.error ?? copy.invalidEmail));
        setPasswordError(passwordValidation.isValid ? null : (passwordValidation.error ?? copy.invalidPassword));
        setApiError(null);

        if (!emailValidation.isValid || !passwordValidation.isValid) {
            return;
        }

        setLoading(true);
        try {
            const response = await apiService.login({ email, password });
            await authService.saveAuth(response.token, response.user);

            try {
                const profile = await apiService.getProfile(response.token);
                await authService.saveAuth(response.token, {
                    id: profile.id,
                    email: profile.email,
                    username: profile.username,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    description: profile.description,
                } as any);
            } catch {
                // Keep the basic auth payload if profile enrichment fails.
            }

            router.replace('/');
        } catch (error) {
            console.error('Login error:', error instanceof Error ? error.message : 'Unknown error');
            setApiError(error instanceof Error ? error.message : copy.unknownError);
        } finally {
            setLoading(false);
        }
    }, [email, password, router, copy]);

    const completeGoogleLogin = useCallback(
        async (accessToken: string) => {
            const authRes = await apiService.loginWithGoogle(accessToken);
            await authService.saveAuth(authRes.token, authRes.user);

            try {
                const profile = await apiService.getProfile(authRes.token);
                await authService.saveAuth(authRes.token, {
                    id: profile.id,
                    email: profile.email,
                    username: profile.username,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    description: profile.description,
                } as any);
            } catch {
                // Keep the basic auth payload if profile enrichment fails.
            }

            router.replace('/');
        },
        [router]
    );

    const handleWebGoogleLogin = useCallback(async () => {
        if (!googleWebClientId) {
            setSocialMessage(copy.googleNotConfigured);
            return;
        }

        if (!googleAuthRequest) {
            setSocialMessage(copy.googlePromptUnavailable);
            return;
        }

        const webAuthResult = await promptGoogleAuth();

        if (webAuthResult.type !== 'success') {
            setSocialMessage(copy.googleCancelled);
            return;
        }

        const accessTokenFromAuthentication =
            'authentication' in webAuthResult ? webAuthResult.authentication?.accessToken : null;
        const accessTokenFromParams =
            'params' in webAuthResult && typeof webAuthResult.params?.access_token === 'string'
                ? webAuthResult.params.access_token
                : null;
        const accessToken = accessTokenFromAuthentication ?? accessTokenFromParams;

        if (!accessToken) {
            setSocialMessage(copy.googleTokenMissing);
            return;
        }

        await completeGoogleLogin(accessToken);
    }, [completeGoogleLogin, copy, googleAuthRequest, promptGoogleAuth]);

    const handleNativeGoogleLogin = useCallback(async () => {
        if (!isNativeGoogleSignInSupported) {
            setSocialMessage(copy.googleNotSupported);
            return;
        }

        let nativeGoogleModule: typeof import('@react-native-google-signin/google-signin');
        try {
            nativeGoogleModule = await import('@react-native-google-signin/google-signin');
        } catch {
            setSocialMessage(copy.googleNotSupported);
            return;
        }

        const { GoogleSignin } = nativeGoogleModule;

        GoogleSignin.configure({
            webClientId: googleWebClientId,
            offlineAccess: true,
            forceCodeForRefreshToken: true,
        });

        await GoogleSignin.hasPlayServices();
        await GoogleSignin.signIn();
        const { accessToken } = await GoogleSignin.getTokens();

        if (!accessToken) {
            setSocialMessage(copy.googleTokenMissing);
            return;
        }

        await completeGoogleLogin(accessToken);
    }, [completeGoogleLogin, copy]);

    const handleGoogleLoginError = useCallback(
        async (error: any) => {
            console.error('Google Signin Error:', error);

            if (isNativeGoogleSignInSupported) {
                const nativeGoogleStatusCodes = (await import('@react-native-google-signin/google-signin')).statusCodes;

                if (nativeGoogleStatusCodes && error.code === nativeGoogleStatusCodes.SIGN_IN_CANCELLED) {
                    setSocialMessage(copy.googleCancelled);
                } else if (nativeGoogleStatusCodes && error.code === nativeGoogleStatusCodes.IN_PROGRESS) {
                    setSocialMessage(copy.googleInProgress);
                } else if (nativeGoogleStatusCodes && error.code === nativeGoogleStatusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                    setSocialMessage(copy.googlePlayServicesMissing);
                } else {
                    setApiError(copy.googleUnknown);
                }
                return;
            }

            if (error?.type === 'cancel' || error?.type === 'dismiss') {
                setSocialMessage(copy.googleCancelled);
                return;
            }

            setApiError(copy.googleUnknown);
        },
        [copy]
    );

    const handleGoogleLogin = useCallback(async () => {
        setLoading(true);
        setSocialMessage(null);
        setApiError(null);

        try {
            if (isExpoGo) {
                setSocialMessage(copy.googleExpoGoUnsupported);
                return;
            }

            if (Platform.OS === 'web') {
                await handleWebGoogleLogin();
                return;
            }

            await handleNativeGoogleLogin();
        } catch (error: any) {
            await handleGoogleLoginError(error);
        } finally {
            setLoading(false);
        }
    }, [copy, handleGoogleLoginError, handleNativeGoogleLogin, handleWebGoogleLogin]);

    const handleAppleLogin = useCallback(() => {
        setSocialMessage(copy.appleUnavailable);
    }, [copy]);

    const blurActiveElementOnWeb = useCallback(() => {
        if (Platform.OS === 'web') {
            const activeElement = document.activeElement as HTMLElement | null;
            activeElement?.blur?.();
        }
    }, []);

    const handleTogglePassword = useCallback(() => {
        setObscurePassword((prev) => !prev);
    }, []);

    const handleForgotPassword = useCallback(() => {
        blurActiveElementOnWeb();
        router.push('/forgot-password');
    }, [blurActiveElementOnWeb, router]);

    const handleRegister = useCallback(() => {
        blurActiveElementOnWeb();
        router.push('/register');
    }, [blurActiveElementOnWeb, router]);

    return (
        <View style={styles.screen}>
            <LinearGradient
                colors={['#0A0503', '#070302', '#050201']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.backgroundGradient}
            />

            <View style={styles.orbLayer}>
                <LinearGradient
                    colors={['rgba(255, 122, 26, 0.28)', 'rgba(255, 122, 26, 0.03)']}
                    style={[styles.orb, styles.orbTopRight]}
                />
                <LinearGradient
                    colors={['rgba(255, 122, 26, 0.2)', 'rgba(255, 122, 26, 0.03)']}
                    style={[styles.orb, styles.orbMidLeft]}
                />
                <LinearGradient
                    colors={['rgba(255, 122, 26, 0.24)', 'rgba(255, 122, 26, 0.03)']}
                    style={[styles.orb, styles.orbBottomLeft]}
                />
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, useCompactHero && styles.scrollContentCompact]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.heroSection, useCompactHero && styles.heroSectionCompact]}>
                    <View style={[styles.brandRow, useCompactHero && styles.brandRowCompact]}>
                        <Image source={require('@/assets/images/logo.png')} style={[styles.brandLogo, useCompactHero && styles.brandLogoCompact]} resizeMode="cover" />
                        <Text style={[styles.brandTitle, useCompactHero && styles.brandTitleCompact]}>
                            foodstream
                            <Text style={styles.brandTitleAccent}>.tv</Text>
                        </Text>
                    </View>

                    <Text style={[styles.heroHeadline, useCompactHero && styles.heroHeadlineCompact]}>
                        {copy.headlineTop}{"\n"}
                        {copy.headlineMiddle}{"\n"}
                        <Text style={styles.heroHeadlineAccent}>{copy.headlineAccent}</Text>
                    </Text>

                    <Text style={[styles.heroDescription, useCompactHero && styles.heroDescriptionCompact]}>
                        {copy.heroDescription}
                    </Text>
                </View>

                <View style={[styles.card, useCompactHero && styles.cardCompact]}>
                    <Text style={styles.sectionLabel}>{copy.sectionLabel}</Text>

                    {!!apiError && (
                        <View style={styles.apiErrorContainer}>
                            <Ionicons name="warning" size={18} color="#F6A5A5" />
                            <Text style={styles.apiErrorText}>{apiError}</Text>
                        </View>
                    )}

                    <View style={styles.inputWrapper}>
                        <View style={[styles.inputField, focusedField === 'email' && styles.inputFieldFocused, !!emailError && styles.inputFieldError]}>
                            <Ionicons name="mail-outline" size={22} color="rgba(250, 244, 234, 0.56)" style={styles.inputLeadingIcon} />
                            <TextInput
                                value={email}
                                onChangeText={(value) => {
                                    setEmail(value);
                                    setEmailError(null);
                                }}
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                                style={styles.inputText}
                                placeholder={copy.emailPlaceholder}
                                placeholderTextColor="rgba(250, 244, 234, 0.4)"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardAppearance="dark"
                                textContentType="emailAddress"
                            />
                        </View>
                        {!!emailError && <Text style={styles.inputErrorText}>{emailError}</Text>}
                    </View>

                    <View style={styles.inputWrapper}>
                        <View style={[styles.inputField, focusedField === 'password' && styles.inputFieldFocused, !!passwordError && styles.inputFieldError]}>
                            <Ionicons name="lock-closed-outline" size={22} color="rgba(250, 244, 234, 0.56)" style={styles.inputLeadingIcon} />
                            <TextInput
                                value={password}
                                onChangeText={(value) => {
                                    setPassword(value);
                                    setPasswordError(null);
                                }}
                                onFocus={() => setFocusedField('password')}
                                onBlur={() => setFocusedField(null)}
                                style={styles.inputText}
                                placeholder={copy.passwordPlaceholder}
                                placeholderTextColor="rgba(250, 244, 234, 0.4)"
                                secureTextEntry={obscurePassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardAppearance="dark"
                                textContentType="password"
                            />
                            <TouchableOpacity onPress={handleTogglePassword} style={styles.eyeButton}>
                                <Ionicons
                                    name={obscurePassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={22}
                                    color="rgba(250, 244, 234, 0.56)"
                                />
                            </TouchableOpacity>
                        </View>
                        {!!passwordError && <Text style={styles.inputErrorText}>{passwordError}</Text>}
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={brandTheme.gradients.primary}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.primaryButtonGradient}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF7EF" />
                            ) : (
                                <Text style={styles.primaryButtonText}>{copy.loginButton}</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerLabel}>{copy.divider}</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                        style={styles.socialButton}
                        onPress={handleGoogleLogin}
                        testID="google-login-button"
                    >
                        <View style={styles.socialButtonContent}>
                            <View style={styles.socialIconBadge}>
                                <Image source={require('@/assets/images/google_logo.png')} style={styles.googleIcon} resizeMode="contain" />
                            </View>
                            <Text style={styles.socialText}>{copy.continueGoogle}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.socialButton}
                        onPress={handleAppleLogin}
                        testID="apple-login-button"
                    >
                        <View style={styles.socialButtonContent}>
                            <View style={styles.socialIconBadge}>
                                <Ionicons name="logo-apple" size={24} color="#F4EDE3" />
                            </View>
                            <Text style={styles.socialText}>{copy.continueApple}</Text>
                        </View>
                    </TouchableOpacity>

                    {!!socialMessage && <Text style={styles.socialMessage}>{socialMessage}</Text>}

                    <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordWrap}>
                        <Text style={styles.forgotPasswordText}>{copy.forgotPassword}</Text>
                    </TouchableOpacity>

                    <View style={styles.footerRow}>
                        <Text style={styles.footerText}>{copy.noAccount}</Text>
                        <TouchableOpacity onPress={handleRegister}>
                            <Text style={styles.footerLink}>{copy.register}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#050201',
    },
    backgroundGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    orbLayer: {
        ...StyleSheet.absoluteFillObject,
        pointerEvents: 'none',
    },
    orb: {
        position: 'absolute',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255, 122, 26, 0.14)',
    },
    orbTopRight: {
        width: 360,
        height: 360,
        top: -92,
        right: -112,
    },
    orbMidLeft: {
        width: 112,
        height: 112,
        top: 156,
        left: 18,
    },
    orbBottomLeft: {
        width: 254,
        height: 254,
        bottom: 34,
        left: -140,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 18,
        paddingTop: Platform.OS === 'ios' ? 54 : 36,
        paddingBottom: 26,
    },
    scrollContentCompact: {
        paddingTop: Platform.OS === 'ios' ? 42 : 28,
        paddingBottom: 18,
    },
    heroSection: {
        marginBottom: 20,
        paddingHorizontal: 0,
    },
    heroSectionCompact: {
        marginBottom: 12,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
    },
    brandRowCompact: {
        marginBottom: 12,
    },
    brandLogo: {
        width: 46,
        height: 46,
        borderRadius: 999,
        marginRight: 12,
    },
    brandLogoCompact: {
        width: 40,
        height: 40,
        marginRight: 10,
    },
    brandTitle: {
        color: '#F5EFE8',
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    brandTitleCompact: {
        fontSize: 20,
    },
    brandTitleAccent: {
        color: '#FF7A1A',
    },
    heroHeadline: {
        color: '#F8F1E9',
        fontSize: 34,
        lineHeight: 46,
        fontFamily: brandHeadlineFont,
        fontWeight: '700',
    },
    heroHeadlineCompact: {
        fontSize: 28,
        lineHeight: 36,
    },
    heroHeadlineAccent: {
        color: '#FF7A1A',
        fontStyle: 'italic',
    },
    heroDescription: {
        marginTop: 18,
        color: 'rgba(248, 241, 233, 0.48)',
        fontSize: 15,
        lineHeight: 22,
        maxWidth: 352,
    },
    heroDescriptionCompact: {
        marginTop: 12,
        fontSize: 14,
        lineHeight: 20,
    },
    card: {
        marginTop: 4,
        borderRadius: 34,
        backgroundColor: 'rgba(19, 12, 9, 0.93)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 24,
        ...createShadowStyle({
            color: '#000000',
            offset: { width: 0, height: 20 },
            opacity: 0.34,
            radius: 28,
            elevation: 16,
        }),
    },
    cardCompact: {
        marginTop: 0,
    },
    sectionLabel: {
        color: 'rgba(248, 241, 233, 0.58)',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 3.2,
        marginBottom: 16,
    },
    apiErrorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(145, 33, 33, 0.28)',
        borderWidth: 1,
        borderColor: 'rgba(255, 125, 125, 0.4)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        marginBottom: 12,
    },
    apiErrorText: {
        color: '#F7C0C0',
        fontSize: 13,
        marginLeft: 8,
        flex: 1,
    },
    inputWrapper: {
        marginBottom: 14,
    },
    inputField: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.13)',
        backgroundColor: 'rgba(255, 255, 255, 0.047)',
        borderRadius: 24,
        minHeight: 60,
        paddingHorizontal: 16,
    },
    inputFieldFocused: {
        borderColor: '#FF8B21',
    },
    inputFieldError: {
        borderColor: '#EB8F8F',
    },
    inputLeadingIcon: {
        marginRight: 14,
    },
    inputText: {
        flex: 1,
        color: '#F8F1E9',
        fontSize: 17,
        paddingVertical: 14,
    },
    eyeButton: {
        padding: 4,
        marginLeft: 10,
    },
    inputErrorText: {
        marginTop: 6,
        marginLeft: 4,
        color: '#F2A1A1',
        fontSize: 12,
        fontWeight: '500',
    },
    primaryButton: {
        borderRadius: 22,
        overflow: 'hidden',
        marginTop: 10,
    },
    primaryButtonDisabled: {
        opacity: 0.8,
    },
    primaryButtonGradient: {
        minHeight: 58,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFF8EF',
        fontSize: 17,
        fontWeight: '800',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.11)',
    },
    dividerLabel: {
        marginHorizontal: 12,
        color: 'rgba(248, 241, 233, 0.56)',
        fontSize: 14,
        fontWeight: '700',
    },
    socialButton: {
        borderRadius: 22,
        paddingVertical: 14,
        paddingHorizontal: 14,
        marginBottom: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.048)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.13)',
        width: '100%',
    },
    socialButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    socialIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 11,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    googleIcon: {
        width: 22,
        height: 22,
    },
    socialText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: '#F8F1E9',
        marginLeft: 16,
    },
    socialMessage: {
        color: '#F2A1A1',
        textAlign: 'center',
        fontSize: 13,
        marginTop: -2,
        marginBottom: 8,
    },
    forgotPasswordWrap: {
        alignSelf: 'center',
        marginTop: 6,
    },
    forgotPasswordText: {
        color: '#F7EFE6',
        textDecorationLine: 'underline',
        fontSize: 16,
        fontWeight: '700',
    },
    footerRow: {
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        color: 'rgba(248, 241, 233, 0.56)',
        fontSize: 15,
    },
    footerLink: {
        color: '#FF7A1A',
        fontSize: 15,
        fontWeight: '800',
    },
});
