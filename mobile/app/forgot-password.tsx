import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ToastManager from 'toastify-react-native';

import BrandBackdrop from '@/components/BrandBackdrop';
import FloatingLabelInput from '@/components/FloatingLabelInput';
import { brandHeadlineFont, brandTheme } from '@/constants/brandTheme';
import { LanguageProvider, useI18n } from '@/contexts/LanguageContext';
import toast from '@/utils/toast';
import { validateEmail } from '@/utils/validation';

type ForgotCopy = {
    emptyEmail: string;
    invalidEmail: string;
    successToast: string;
    headlineTop: string;
    headlineAccent: string;
    subline: string;
    successMessagePrefix: string;
    formLabel: string;
    emailLabel: string;
    sendLink: string;
    backToLogin: string;
};

const FORGOT_COPY: Record<'fr' | 'en', ForgotCopy> = {
    fr: {
        emptyEmail: 'Veuillez entrer votre adresse e-mail',
        invalidEmail: 'Veuillez entrer une adresse e-mail valide',
        successToast: 'Si un compte existe, un lien de reinitialisation a ete envoye.',
        headlineTop: 'Reinitialisez votre',
        headlineAccent: 'mot de passe.',
        subline: 'Entrez votre e-mail et nous vous enverrons un lien securise de reinitialisation.',
        successMessagePrefix: 'Si un compte existe pour',
        formLabel: 'Mot de passe oublie',
        emailLabel: 'Adresse e-mail',
        sendLink: 'Envoyer le lien',
        backToLogin: 'Retour a la connexion',
    },
    en: {
        emptyEmail: 'Please enter your email address',
        invalidEmail: 'Please enter a valid email address',
        successToast: 'If an account exists, a reset link has been sent.',
        headlineTop: 'Reset your',
        headlineAccent: 'access key.',
        subline: 'Enter your account email and we will send a secure password reset link.',
        successMessagePrefix: 'If an account exists for',
        formLabel: 'Forgot password',
        emailLabel: 'Email address',
        sendLink: 'Send reset link',
        backToLogin: 'Back to login',
    },
};

const ForgotPasswordScreen: React.FC = () => (
    <LanguageProvider>
        <ForgotPasswordContent />
    </LanguageProvider>
);

const ForgotPasswordContent: React.FC = () => {
    const { locale } = useI18n();
    const copy = FORGOT_COPY[locale];

    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [focused, setFocused] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();

    const handleSubmit = () => {
        if (!email.trim()) {
            setError(copy.emptyEmail);
            toast.error(copy.emptyEmail);
            return;
        }

        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            setError(copy.invalidEmail);
            toast.error(copy.invalidEmail);
            return;
        }

        setError(null);
        setSubmitted(true);
        toast.success(copy.successToast);
    };

    return (
        <View style={styles.screen}>
            <BrandBackdrop compact />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <Text style={styles.headline}>
                        {copy.headlineTop}
                        {'\n'}
                        <Text style={styles.headlineAccent}>{copy.headlineAccent}</Text>
                    </Text>
                    <Text style={styles.subline}>
                        {copy.subline}
                    </Text>
                </View>

                <View style={styles.card}>
                    {submitted ? (
                        <View style={styles.successWrap}>
                            <Ionicons name="checkmark-circle-outline" size={40} color={brandTheme.colors.success} />
                            <Text style={styles.successText}>
                                {copy.successMessagePrefix} <Text style={styles.successEmail}>{email}</Text>, {copy.successToast.toLowerCase()}
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.formLabel}>{copy.formLabel}</Text>
                            <FloatingLabelInput
                                label={copy.emailLabel}
                                iconName="mail-outline"
                                focused={focused}
                                value={email}
                                onChangeText={(value) => {
                                    setEmail(value);
                                    if (error) {
                                        setError(null);
                                    }
                                }}
                                onFocus={() => setFocused(true)}
                                onBlur={() => setFocused(false)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                error={error}
                            />

                            <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
                                <LinearGradient
                                    colors={brandTheme.gradients.primary}
                                    start={{ x: 0, y: 0.5 }}
                                    end={{ x: 1, y: 0.5 }}
                                    style={styles.primaryGradient}
                                >
                                    <Text style={styles.primaryButtonText}>{copy.sendLink}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}

                    <TouchableOpacity style={styles.backLinkWrap} onPress={() => router.replace('/login' as any)}>
                        <Text style={styles.backLink}>{copy.backToLogin}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <ToastManager />
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: brandTheme.colors.bg,
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 64,
        paddingBottom: 32,
    },
    hero: {
        gap: 12,
        marginBottom: 24,
    },
    headline: {
        color: brandTheme.colors.text,
        fontSize: 34,
        lineHeight: 38,
        fontFamily: brandHeadlineFont,
        fontWeight: '700',
    },
    headlineAccent: {
        color: brandTheme.colors.orange,
        fontStyle: 'italic',
    },
    subline: {
        color: brandTheme.colors.muted,
        fontSize: 15,
        lineHeight: 23,
    },
    card: {
        borderRadius: brandTheme.radii.xxl,
        paddingHorizontal: 16,
        paddingVertical: 18,
        backgroundColor: brandTheme.colors.surface,
        borderWidth: 1,
        borderColor: brandTheme.colors.border,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
    },
    formLabel: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        color: brandTheme.colors.muted,
        marginBottom: 12,
    },
    primaryButton: {
        borderRadius: 14,
        overflow: 'hidden',
        width: '100%',
        marginTop: 2,
    },
    primaryGradient: {
        paddingVertical: 15,
        borderRadius: 14,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    successWrap: {
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
        paddingTop: 8,
    },
    successText: {
        color: brandTheme.colors.text,
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
    },
    successEmail: {
        fontWeight: '700',
    },
    backLinkWrap: {
        marginTop: 16,
    },
    backLink: {
        textAlign: 'center',
        color: brandTheme.colors.orange,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
});

export default ForgotPasswordScreen;
