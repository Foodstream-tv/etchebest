import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ToastManager, { Toast } from 'toastify-react-native';
import apiService from '../services/api';
import authService from '../services/auth';
import toast from '../utils/toast';
import { validateEmail, validatePassword } from '../utils/validation';


export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [obscurePassword, setObscurePassword] = useState(true);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [loading, setLoading] = useState(false);

    const router = useRouter();

    const handleLogin = async () => {
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            toast.error(emailValidation.error!);
            return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            toast.error(passwordValidation.error!);
            return;
        }

        setLoading(true);
        try {
            const response = await apiService.login({ email, password });
            await authService.saveAuth(response.token, response.user);

            toast.success('Connexion réussie !');
            router.replace('/');
        } catch (error) {
            console.error('Login error:', error instanceof Error ? error.message : 'Unknown error');
            toast.error(error instanceof Error ? error.message : 'Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <View style={styles.background}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.card}>
                        <Text style={styles.heading}>Connexion</Text>
                        <View style={styles.formSection}>
                            <Text style={styles.subHeading}>Bonjour,</Text>
                            <View style={styles.inputWrapper}>
                                {Boolean(emailFocused || email) && (
                                    <Text style={styles.floatingLabel}>Adresse e-mail</Text>
                                )}
                                <View style={[styles.inputGroup, (emailFocused || email) && styles.inputGroupFocused]}>
                                    <Ionicons name="mail-outline" size={20} color="#000" style={styles.leadingIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder={emailFocused || email ? '' : 'Adresse e-mail'}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                        onFocus={() => setEmailFocused(true)}
                                        onBlur={() => setEmailFocused(false)}
                                        placeholderTextColor="#7a7a7a"
                                    />
                                </View>
                            </View>
                            <View style={styles.inputWrapper}>
                                {Boolean(passwordFocused || password) && (
                                    <Text style={styles.floatingLabel}>Mot de passe</Text>
                                )}
                                <View style={[styles.inputGroup, (passwordFocused || password) && styles.inputGroupFocused]}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#000" style={styles.leadingIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder={passwordFocused || password ? '' : 'Mot de passe'}
                                        secureTextEntry={obscurePassword}
                                        value={password}
                                        onChangeText={setPassword}
                                        onFocus={() => setPasswordFocused(true)}
                                        onBlur={() => setPasswordFocused(false)}
                                        placeholderTextColor="#7a7a7a"
                                    />
                                    <TouchableOpacity onPress={() => setObscurePassword(!obscurePassword)}>
                                        <Ionicons
                                            name={obscurePassword ? 'eye-off-outline' : 'eye-outline'}
                                            size={20}
                                            color="#000"
                                        />
                                    </TouchableOpacity>
                                </View>
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
                            <TouchableOpacity
                                style={styles.socialButton}
                                onPress={() => {
                                    Toast.show({
                                        text1: 'Tentative de connexion avec Google',
                                        position: 'bottom',
                                        icon: <Ionicons name="logo-google" size={24} color="#4285F4" />,
                                        iconColor: '#4285F4',
                                    });
                                }}
                            >
                                <View style={styles.socialButtonContent}>
                                    <View style={styles.socialIconBadge}>
                                        <Image
                                            source={require('@/assets/images/google_logo.png')}
                                            style={styles.googleIcon}
                                            resizeMode="contain"
                                        />
                                    </View>
                                    <Text style={styles.socialText}>Continuer avec Google</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.socialButton}
                                onPress={() => {
                                    Toast.show({
                                        text1: 'Tentative de connexion avec Apple',
                                        position: 'bottom',
                                        icon: <Ionicons name="logo-apple" size={24} color="#000" />,
                                        iconColor: '#000',
                                    });
                                }}
                            >
                                <View style={styles.socialButtonContent}>
                                    <View style={styles.socialIconBadge}>
                                        <Ionicons name="logo-apple" size={22} color="#000" />
                                    </View>
                                    <Text style={styles.socialText}>Continuer avec Apple</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                                <Text style={styles.linkText}>Mot de passe oublié ?</Text>
                            </TouchableOpacity>
                            <View style={styles.footerLinks}>
                                <Text style={styles.footerText}>Vous n&apos;avez pas de compte ? </Text>
                                <TouchableOpacity onPress={() => router.push('/register')}>
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
    inputWrapper: {
        marginBottom: 16,
        position: 'relative',
    },
    floatingLabel: {
        position: 'absolute',
        top: -8,
        left: 16,
        backgroundColor: '#fff',
        paddingHorizontal: 4,
        fontSize: 12,
        color: '#FF8A00',
        fontWeight: '600',
        zIndex: 1,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#bcbcbc',
        paddingHorizontal: 16,
        height: 56,
        backgroundColor: '#fff',
        width: '100%',
    },
    inputGroupFocused: {
        borderColor: '#FF8A00',
    },
    leadingIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
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
    socialButton: {
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 18,
        marginBottom: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e8e8e8',
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
        borderRadius: 12,
        backgroundColor: '#f4f4f4',
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
        fontWeight: '600',
        color: '#000',
        marginLeft: 18,
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
