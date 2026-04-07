import {Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import { createShadowStyle } from '@/utils/shadow';
import FloatingLabelInput from '../components/FloatingLabelInput';
import config from '../config/env';
import apiService from '../services/api';
import { authService } from '../services/auth';
import { validateEmail, validatePassword } from '../utils/validation';

const isGoogleSignInSupported = Platform.OS !== 'web';

if (isGoogleSignInSupported) {
    GoogleSignin.configure({
        webClientId: config.googleClientId,
        offlineAccess: true, // Demande un serverAuthCode
        forceCodeForRefreshToken: true,
    });
}

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [obscurePassword, setObscurePassword] = useState(true);
    const [rememberMe, setRememberMe] = useState(false);
    const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [socialMessage, setSocialMessage] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);

    const router = useRouter();

    const handleLogin = useCallback(async () => {
        const emailValidation = validateEmail(email);
        const passwordValidation = validatePassword(password);

        setEmailError(emailValidation.isValid ? null : (emailValidation.error ?? 'Email invalide'));
        setPasswordError(passwordValidation.isValid ? null : (passwordValidation.error ?? 'Mot de passe invalide'));
        setApiError(null);

        if (!emailValidation.isValid || !passwordValidation.isValid) {
            return;
        }

        setLoading(true);
        try {
            const response = await apiService.login({ email, password });
            await authService.saveAuth(response.token, response.user);

            // Fetch full profile to enrich stored user with firstName, lastName, description
            try {
                const profile = await apiService.getProfile(response.token);
                await authService.saveAuth(response.token, {
                    id: profile.id,
                    email: profile.email,
                    username: profile.username,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    description: profile.description,
                });
            } catch {
                // Non-critical: basic auth data is already saved
            }

            // Instead of toast.success, we just route since login completes the auth flow
            router.replace('/');
        } catch (error) {
            console.error('Login error:', error instanceof Error ? error.message : 'Unknown error');
            setApiError(error instanceof Error ? error.message : 'Désolé, une erreur inattendue est survenue.');
        } finally {
            setLoading(false);
        }
    }, [email, password, router]);

    // ---- Google Auth Handlers (Native) ----
    const handleGoogleLogin = useCallback(async () => {
        if (!isGoogleSignInSupported) {
            setSocialMessage('Connexion Google non prise en charge sur le web.');
            return;
        }

        setLoading(true);
        setSocialMessage(null);
        setApiError(null);
        try {
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            
            // On récupère l'Access Token pour le backend mobile (`/api/auth/google/mobile`)
            const { accessToken } = await GoogleSignin.getTokens();

            if (accessToken) {
               console.log('[Google Auth] Success! Access Token received. Sending to backend...');
               
               const authRes = await apiService.loginWithGoogle(accessToken);
               await authService.saveAuth(authRes.token, authRes.user);
               router.replace('/');
            } else {
               setSocialMessage("Impossible de récupérer le jeton d'accès Google.");
            }
        } catch (error: any) {
            console.error("Google Signin Error:", error);
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // L'utilisateur a annulé la fenêtre Google
                setSocialMessage("Connexion annulée");
            } else if (error.code === statusCodes.IN_PROGRESS) {
                setSocialMessage("Connexion déjà en cours");
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                setSocialMessage("Google Play Services indisponible sur cet appareil");
            } else {
                setApiError("Erreur inattendue de connexion avec Google.");
            }
        } finally {
            setLoading(false);
        }
    }, [router]);

    const handleAppleLogin = useCallback(() => {
        setSocialMessage('La connexion avec Apple n\'est pas encore disponible');
    }, []);

    const handleFacebookLogin = useCallback(() => {
        setSocialMessage('La connexion avec Facebook n\'est pas encore disponible');
    }, []);

    const blurActiveElementOnWeb = useCallback(() => {
        if (Platform.OS === 'web') {
            const activeElement = document.activeElement as HTMLElement | null;
            activeElement?.blur?.();
        }
    }, []);

    const handleTogglePassword = useCallback(() => setObscurePassword(v => !v), []);
    const handleForgotPassword = useCallback(() => {
        blurActiveElementOnWeb();
        router.push('/forgot-password');
    }, [blurActiveElementOnWeb, router]);
    const handleRegister = useCallback(() => {
        blurActiveElementOnWeb();
        router.push('/register');
    }, [blurActiveElementOnWeb, router]);

    const passwordTrailingIcon = useMemo(() => (
        <TouchableOpacity onPress={handleTogglePassword}>
            <Ionicons
                name={obscurePassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#000"
            />
        </TouchableOpacity>
    ), [obscurePassword, handleTogglePassword]);

    return (
        <View style={styles.background}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.headerImageContainer}>
                        <Image
                            source={require('@/assets/images/food-iphone.jpg')}
                            style={styles.headerImage}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['transparent', '#F5F5F7']}
                            style={styles.headerImageGradient}
                        />
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.subHeading}>Connexion</Text>
                        <Text style={styles.welcomeText}>Bon retour, content de vous revoir !</Text>
                        <View style={styles.formSection}>
                            {!!apiError && (
                                <View style={styles.apiErrorContainer}>
                                    <Ionicons name="warning" size={20} color="#D00000" />
                                    <Text style={styles.apiErrorText}>{apiError}</Text>
                                </View>
                            )}
                            <FloatingLabelInput
                                label="Adresse e-mail"
                                iconName="mail-outline"
                                focused={focusedField === 'email'}
                                value={email}
                                onChangeText={(v) => { setEmail(v); setEmailError(null); }}
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                error={emailError}
                            />
                            <FloatingLabelInput
                                label="Mot de passe"
                                iconName="lock-closed-outline"
                                focused={focusedField === 'password'}
                                value={password}
                                onChangeText={(v) => { setPassword(v); setPasswordError(null); }}
                                onFocus={() => setFocusedField('password')}
                                onBlur={() => setFocusedField(null)}
                                secureTextEntry={obscurePassword}
                                trailingIcon={passwordTrailingIcon}
                                error={passwordError}
                            />

                            <View style={styles.optionsRow}>
                                <TouchableOpacity style={styles.rememberMeContainer} onPress={() => setRememberMe(!rememberMe)}>
                                    <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                                        {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                    <Text style={styles.rememberMeText}>Se souvenir de moi</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleForgotPassword}>
                                    <Text style={styles.linkText}>Mot de passe oublié ?</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
                                <LinearGradient
                                    colors={['#FFA92E', '#FF5D1E']}
                                    start={{ x: 0, y: 0.5 }}
                                    end={{ x: 1, y: 0.5 }}
                                    style={styles.primaryGradient}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>Se connecter</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                            <View style={styles.dividerRow}>
                                <View style={styles.line} />
                                <Text style={styles.dividerLabel}>Ou</Text>
                                <View style={styles.line} />
                            </View>

                            <View style={styles.socialIconsRow}>
                                <TouchableOpacity
                                    style={styles.socialIconButton}
                                    onPress={handleGoogleLogin}
                                    testID="google-login-button"
                                >
                                    <Image
                                        source={require('@/assets/images/google_logo.png')}
                                        style={styles.socialIcon}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.socialIconButton}
                                    onPress={handleAppleLogin}
                                    testID="apple-login-button"
                                >
                                    <Ionicons name="logo-apple" size={30} color="#000" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.socialIconButton}
                                    onPress={handleFacebookLogin}
                                    testID="facebook-login-button"
                                >
                                    <Ionicons name="logo-facebook" size={30} color="#1877F2" />
                                </TouchableOpacity>
                            </View>

                            {!!socialMessage && (
                                <Text style={styles.socialErrorText}>{socialMessage}</Text>
                            )}

                            <View style={styles.footerLinks}>
                                <Text style={styles.footerText}>Vous n&apos;avez pas de compte ?&nbsp;</Text>
                                <TouchableOpacity onPress={handleRegister}>
                                    <Text style={styles.linkHighlight}>Inscrivez-vous</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: '#F5F5F7',
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    headerImageContainer: {
        width: '100%',
        height: 280,
        position: 'relative',
    },
    headerImage: {
        width: '100%',
        height: '100%',
    },
    headerImageGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
    },
    card: {
        marginTop: -60,
        marginHorizontal: 16,
        borderRadius: 32,
        paddingVertical: 48,
        paddingHorizontal: 24,
        backgroundColor: '#fff',
        ...createShadowStyle({
            color: '#000',
            offset: { width: 0, height: 12 },
            opacity: 0.08,
            radius: 24,
            elevation: 8,
        }),
    },
    heading: {
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        color: '#111',
    },
    subHeading: {
        fontSize: 32,
        fontWeight: '800',
        color: '#111',
        marginBottom: 8,
        textAlign: 'center',
    },
    welcomeText: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
    },
    formSection: {
        marginTop: 32,
    },
    apiErrorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFE5E5',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
    },
    apiErrorText: {
        color: '#D00000',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
        flex: 1,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
        paddingHorizontal: 4,
    },
    rememberMeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bcbcbc',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    checkboxActive: {
        backgroundColor: '#FF5D1E',
        borderColor: '#FF5D1E',
    },
    rememberMeText: {
        fontSize: 14,
        color: '#000',
    },
    linkText: {
        textDecorationLine: 'underline',
        color: '#000',
        fontWeight: '600',
        fontSize: 14,
    },
    primaryButton: {
        borderRadius: 16,
        overflow: 'hidden',
        width: '100%',
    },
    primaryGradient: {
        paddingVertical: 16,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
    },
    primaryButtonText: {
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 32,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#121212',
    },
    dividerLabel: {
        marginHorizontal: 12,
        color: '#000',
        fontWeight: '600',
    },
    socialIconsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 24,
    },
    socialIconButton: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e8e8e8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialIcon: {
        width: 24,
        height: 24,
    },
    socialErrorText: {
        color: '#D00000',
        fontSize: 14,
        textAlign: 'center',
        marginTop: -12,
        marginBottom: 24,
        fontWeight: '500',
    },
    footerLinks: {
        marginTop: 32,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        color: '#000',
        fontSize: 14,
    },
    linkHighlight: {
        color: '#D06000',
        fontWeight: '700',
        fontSize: 14,
    },
});