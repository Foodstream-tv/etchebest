import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ToastManager, { Toast } from 'toastify-react-native';
import FloatingLabelInput from '../components/FloatingLabelInput';
import SocialButton from '../components/SocialButton';
import apiService from '../services/api';
import { authService } from '../services/auth';
import { toast } from '../utils/toast';
import { validateEmail, validatePassword } from '../utils/validation';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [obscurePassword, setObscurePassword] = useState(true);
    const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const router = useRouter();

    const handleLogin = useCallback(async () => {
        const emailValidation = validateEmail(email);
        const passwordValidation = validatePassword(password);

        setEmailError(emailValidation.isValid ? null : (emailValidation.error ?? 'Email invalide'));
        setPasswordError(passwordValidation.isValid ? null : (passwordValidation.error ?? 'Mot de passe invalide'));

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

            toast.success('Connexion réussie !');
            router.replace('/');
        } catch (error) {
            console.error('Login error:', error instanceof Error ? error.message : 'Unknown error');
            toast.error(error instanceof Error ? error.message : 'Erreur de connexion');
        } finally {
            setLoading(false);
        }
    }, [email, password, router]);

    const handleGoogleLogin = useCallback(() => {
        Toast.show({
            text1: 'Tentative de connexion avec Google',
            position: 'bottom',
            icon: <Ionicons name="logo-google" size={24} color="#4285F4" />,
            iconColor: '#4285F4',
        });
    }, []);

    const handleAppleLogin = useCallback(() => {
        Toast.show({
            text1: 'Tentative de connexion avec Apple',
            position: 'bottom',
            icon: <Ionicons name="logo-apple" size={24} color="#000" />,
            iconColor: '#000',
        });
    }, []);

    const handleTogglePassword = useCallback(() => setObscurePassword(v => !v), []);
    const handleForgotPassword = useCallback(() => router.push('/forgot-password'), [router]);
    const handleRegister = useCallback(() => router.push('/register'), [router]);

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
        <>
            <View style={styles.background}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.card}>
                        <Text style={styles.heading}>Connexion</Text>
                        <View style={styles.formSection}>
                            <Text style={styles.subHeading}>Bonjour,</Text>
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
                            <SocialButton
                                label="Continuer avec Google"
                                onPress={handleGoogleLogin}
                                icon={
                                    <Image
                                        source={require('@/assets/images/google_logo.png')}
                                        style={styles.googleIcon}
                                        resizeMode="contain"
                                    />
                                }
                            />
                            <SocialButton
                                label="Continuer avec Apple"
                                onPress={handleAppleLogin}
                                icon={<Ionicons name="logo-apple" size={22} color="#000" />}
                            />
                            <TouchableOpacity onPress={handleForgotPassword}>
                                <Text style={styles.linkText}>Mot de passe oublié ?</Text>
                            </TouchableOpacity>
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
            <ToastManager />
        </>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: '#fdfdfc',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 16,
        justifyContent: 'center',
    },
    card: {
        borderRadius: 32,
        paddingVertical: 48,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
    },
    heading: {
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        color: '#111',
    },
    formSection: {
        marginTop: 80,
    },
    subHeading: {
        fontSize: 26,
        fontWeight: '700',
        color: '#111',
        marginBottom: 28,
        textAlign: 'center',
    },
    linkText: {
        textDecorationLine: 'underline',
        textAlign: 'center',
        color: '#000',
        fontWeight: '600',
        marginTop: 4,
        marginBottom: 28,
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
    googleIcon: {
        width: 22,
        height: 22,
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
