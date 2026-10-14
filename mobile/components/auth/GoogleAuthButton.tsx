import { makeRedirectUri } from 'expo-auth-session';
import * as GoogleAuth from 'expo-auth-session/providers/google';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';

import SocialButton from '@/components/SocialButton';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';
import appConfig from '@/config/env';
import apiService from '@/services/api';
import { formatBanMessage } from '@/services/session';
import { bodyString, isBannedError } from '@/utils/authErrors';
import { completeSignIn, ProfileUnavailableError } from '@/utils/completeSignIn';

const isExpoGo =
    Platform.OS !== 'web' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isNativeGoogleSignInSupported = Platform.OS !== 'web' && !isExpoGo;
// Public OAuth client ids (not secrets): safe to ship in the bundle.
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

type Tone = 'info' | 'error';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

/** Lazy `require`: the native module only exists in dev-client / production builds (not Expo Go, not web). */
function loadGoogleSignin(): GoogleSigninModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-google-signin/google-signin') as GoogleSigninModule;
}

type GoogleAuthButtonProps = {
    disabled?: boolean;
    /** Lets the parent disable its own submit button while Google sign-in is running. */
    onBusyChange?: (busy: boolean) => void;
    testID?: string;
};

/** "Continue with Google": web (expo-auth-session) and native (google-signin) flows. */
export default function GoogleAuthButton({
    disabled = false,
    onBusyChange,
    testID = 'google-login-button',
}: Readonly<GoogleAuthButtonProps>) {
    const { t, locale } = useI18n();
    const router = useRouter();
    const styles = useStyles();

    const busyRef = useRef(false);
    const mountedRef = useRef(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const [googleAuthRequest, , promptGoogleAuth] = GoogleAuth.useAuthRequest({
        clientId: googleWebClientId || undefined,
        webClientId: googleWebClientId || undefined,
        androidClientId: isNativeGoogleSignInSupported ? googleAndroidClientId || undefined : undefined,
        iosClientId: isNativeGoogleSignInSupported ? googleIosClientId || undefined : undefined,
        redirectUri: googleRedirectUri || undefined,
        responseType: 'token',
        scopes: ['openid', 'profile', 'email'],
    });

    const show = useCallback((text: string, tone: Tone) => {
        if (mountedRef.current) setMessage({ text, tone });
    }, []);

    /** Exchanges the Google access token for an app session. */
    const completeGoogleLogin = useCallback(
        async (accessToken: string) => {
            const authRes = await apiService.loginWithGoogle(accessToken);
            if (!authRes?.token) {
                show(t('auth.signin.serverError'), 'error');
                return;
            }
            await completeSignIn(authRes.token);
            router.replace('/');
        },
        [router, show, t]
    );

    const signInWithGoogleOnWeb = useCallback(async () => {
        if (!googleWebClientId) {
            show(t('auth.google.notConfigured'), 'error');
            return;
        }
        if (!googleAuthRequest) {
            show(t('auth.google.promptUnavailable'), 'info');
            return;
        }

        const result = await promptGoogleAuth();
        if (result.type === 'error') {
            show(t('auth.google.unknown'), 'error');
            return;
        }
        if (result.type !== 'success') {
            show(t('auth.google.cancelled'), 'info');
            return;
        }

        const fromAuthentication = 'authentication' in result ? result.authentication?.accessToken : null;
        const fromParams =
            'params' in result && typeof result.params?.access_token === 'string' ? result.params.access_token : null;
        const accessToken = fromAuthentication ?? fromParams;

        if (!accessToken) {
            show(t('auth.google.tokenMissing'), 'error');
            return;
        }
        await completeGoogleLogin(accessToken);
    }, [completeGoogleLogin, googleAuthRequest, promptGoogleAuth, show, t]);

    const signInWithGoogleOnNative = useCallback(async () => {
        let nativeModule: GoogleSigninModule;
        try {
            nativeModule = loadGoogleSignin();
        } catch {
            show(t('auth.google.notSupported'), 'error');
            return;
        }

        const { GoogleSignin } = nativeModule;
        GoogleSignin.configure({ webClientId: googleWebClientId });

        await GoogleSignin.hasPlayServices();
        await GoogleSignin.signIn();
        const { accessToken } = await GoogleSignin.getTokens();

        if (!accessToken) {
            show(t('auth.google.tokenMissing'), 'error');
            return;
        }
        await completeGoogleLogin(accessToken);
    }, [completeGoogleLogin, show, t]);

    const reportFailure = useCallback(
        async (error: unknown) => {
            // Never log the raw error: it can embed tokens or the backend payload.
            const code = (error as { code?: unknown } | null)?.code;
            console.warn('Google sign-in failed', typeof code === 'string' || typeof code === 'number' ? code : 'unknown');

            if (isBannedError(error)) {
                show(formatBanMessage(bodyString(error, 'bannedUntil'), locale), 'error');
                return;
            }
            if (error instanceof ProfileUnavailableError) {
                show(
                    isBannedError(error.cause)
                        ? formatBanMessage(bodyString(error.cause, 'bannedUntil'), locale)
                        : t('auth.signin.fetchProfileError'),
                    'error'
                );
                return;
            }

            if (isNativeGoogleSignInSupported && code !== undefined) {
                try {
                    const { statusCodes } = loadGoogleSignin();
                    if (code === statusCodes.SIGN_IN_CANCELLED) {
                        show(t('auth.google.cancelled'), 'info');
                        return;
                    }
                    if (code === statusCodes.IN_PROGRESS) {
                        show(t('auth.google.inProgress'), 'info');
                        return;
                    }
                    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                        show(t('auth.google.playServices'), 'error');
                        return;
                    }
                } catch {
                    // fall through to the generic message
                }
            }

            const type = (error as { type?: unknown } | null)?.type;
            if (type === 'cancel' || type === 'dismiss') {
                show(t('auth.google.cancelled'), 'info');
                return;
            }
            show(t('auth.google.unknown'), 'error');
        },
        [locale, show, t]
    );

    const handlePress = useCallback(async () => {
        if (busyRef.current) return; // already running (double tap / in progress)
        busyRef.current = true;
        setBusy(true);
        onBusyChange?.(true);
        setMessage(null);

        try {
            if (isExpoGo) {
                show(t('auth.google.expoGo'), 'info');
            } else if (Platform.OS === 'web') {
                await signInWithGoogleOnWeb();
            } else {
                await signInWithGoogleOnNative();
            }
        } catch (error) {
            await reportFailure(error);
        } finally {
            busyRef.current = false;
            if (mountedRef.current) setBusy(false);
            onBusyChange?.(false);
        }
    }, [onBusyChange, reportFailure, show, signInWithGoogleOnNative, signInWithGoogleOnWeb, t]);

    return (
        <View>
            <SocialButton
                label={t('auth.signin.google')}
                onPress={handlePress}
                disabled={disabled || busy}
                testID={testID}
                icon={<Image source={require('@/assets/images/google_logo.png')} style={styles.icon} resizeMode="contain" />}
            />
            {message ? (
                <Text
                    accessibilityRole="alert"
                    style={[styles.message, message.tone === 'error' ? styles.error : styles.info]}
                >
                    {message.text}
                </Text>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    icon: {
        width: 22,
        height: 22,
    },
    message: {
        marginTop: 10,
        textAlign: 'center',
        fontSize: 13,
    },
    error: {
        color: colors.danger,
        fontWeight: '500',
    },
    info: {
        color: colors.muted,
    },
}));
