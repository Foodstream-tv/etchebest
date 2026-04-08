import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ToastManager from 'toastify-react-native';

import BrandBackdrop from '../components/BrandBackdrop';
import FloatingLabelInput from '../components/FloatingLabelInput';
import { brandHeadlineFont, brandTheme } from '../constants/brandTheme';
import { LanguageProvider, useI18n } from '../contexts/LanguageContext';
import apiService from '../services/api';
import toast from '../utils/toast';
import { validateEmail, validateLengthRange, validateMinLength, validatePassword, validatePhone } from '../utils/validation';

const COUNTRY_CODES = [
    { code: '+33', country: 'France', flag: 'FR', value: 33 },
    { code: '+1', country: 'Etats-Unis', flag: 'US', value: 1 },
    { code: '+1', country: 'Canada', flag: 'CA', value: 1 },
    { code: '+44', country: 'Royaume-Uni', flag: 'GB', value: 44 },
    { code: '+49', country: 'Allemagne', flag: 'DE', value: 49 },
    { code: '+34', country: 'Espagne', flag: 'ES', value: 34 },
    { code: '+39', country: 'Italie', flag: 'IT', value: 39 },
    { code: '+32', country: 'Belgique', flag: 'BE', value: 32 },
    { code: '+41', country: 'Suisse', flag: 'CH', value: 41 },
    { code: '+352', country: 'Luxembourg', flag: 'LU', value: 352 },
    { code: '+212', country: 'Maroc', flag: 'MA', value: 212 },
    { code: '+213', country: 'Algerie', flag: 'DZ', value: 213 },
    { code: '+216', country: 'Tunisie', flag: 'TN', value: 216 },
];

type FocusedField = 'email' | 'firstName' | 'lastName' | 'username' | 'password' | 'phone' | 'description' | null;

type FieldErrors = {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    password: string | null;
    phone: string | null;
    description: string | null;
};

const NO_ERRORS: FieldErrors = {
    email: null,
    firstName: null,
    lastName: null,
    username: null,
    password: null,
    phone: null,
    description: null,
};

export default function RegisterScreen() {
    return (
        <LanguageProvider>
            <RegisterScreenContent />
        </LanguageProvider>
    );
}

type RegisterCopy = {
    backToLogin: string;
    headlineTop: string;
    headlineAccent: string;
    subline: string;
    formLabel: string;
    emailLabel: string;
    firstNameLabel: string;
    lastNameLabel: string;
    usernameLabel: string;
    passwordLabel: string;
    phoneLabel: string;
    descriptionLabel: string;
    submit: string;
    divider: string;
    signupGoogleAttempt: string;
    signupAppleAttempt: string;
    countryModalTitle: string;
    registerSuccess: string;
    registerError: string;
    validationFirstName: string;
    validationLastName: string;
    validationUsername: string;
    validationDescription: string;
};

const REGISTER_COPY: Record<'fr' | 'en', RegisterCopy> = {
    fr: {
        backToLogin: 'Login',
        headlineTop: 'Rejoins le',
        headlineAccent: 'cercle des chefs.',
        subline: 'Cree ton profil et lance ton premier live culinaire securise.',
        formLabel: 'Inscription',
        emailLabel: 'Adresse e-mail',
        firstNameLabel: 'Prenom',
        lastNameLabel: 'Nom',
        usernameLabel: 'Identifiant',
        passwordLabel: 'Mot de passe',
        phoneLabel: 'Numero de telephone',
        descriptionLabel: 'Description',
        submit: 'Inscription',
        divider: 'Ou',
        signupGoogleAttempt: "Tentative d'inscription avec Google",
        signupAppleAttempt: "Tentative d'inscription avec Apple",
        countryModalTitle: 'Selectionner un indicatif',
        registerSuccess: 'Inscription reussie !',
        registerError: "Erreur d'inscription",
        validationFirstName: 'Le prenom',
        validationLastName: 'Le nom',
        validationUsername: 'L identifiant',
        validationDescription: 'La description',
    },
    en: {
        backToLogin: 'Login',
        headlineTop: 'Join the',
        headlineAccent: 'chef circle.',
        subline: 'Build your profile and start your first secure live cooking room.',
        formLabel: 'Sign up',
        emailLabel: 'Email address',
        firstNameLabel: 'First name',
        lastNameLabel: 'Last name',
        usernameLabel: 'Username',
        passwordLabel: 'Password',
        phoneLabel: 'Phone number',
        descriptionLabel: 'Description',
        submit: 'Create account',
        divider: 'Or',
        signupGoogleAttempt: 'Google sign-up attempt',
        signupAppleAttempt: 'Apple sign-up attempt',
        countryModalTitle: 'Select country code',
        registerSuccess: 'Registration successful!',
        registerError: 'Registration error',
        validationFirstName: 'First name',
        validationLastName: 'Last name',
        validationUsername: 'Username',
        validationDescription: 'Description',
    },
};

function RegisterScreenContent() {
    const { locale } = useI18n();
    const copy = REGISTER_COPY[locale];

    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [description, setDescription] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [obscurePassword, setObscurePassword] = useState(true);
    const [loading, setLoading] = useState(false);
    const [focusedField, setFocusedField] = useState<FocusedField>(null);
    const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS);

    const router = useRouter();

    const clearError = useCallback(
        (field: keyof FieldErrors) => setErrors((prev) => ({ ...prev, [field]: null })),
        [],
    );

    const handleBackToLogin = useCallback(() => {
        router.replace('/login' as any);
    }, [router]);

    const handleRegister = useCallback(async () => {
        const validations: FieldErrors = {
            email: validateEmail(email).error ?? null,
            firstName: validateMinLength(firstName, 2, copy.validationFirstName).error ?? null,
            lastName: validateMinLength(lastName, 2, copy.validationLastName).error ?? null,
            username: validateMinLength(username, 3, copy.validationUsername).error ?? null,
            password: validatePassword(password).error ?? null,
            description: validateLengthRange(description, 10, 500, copy.validationDescription).error ?? null,
            phone: validatePhone(phoneNumber).error ?? null,
        };

        const hasError = Object.values(validations).some(Boolean);
        setErrors(validations);
        if (hasError) {
            return;
        }

        setLoading(true);
        try {
            await apiService.register({
                email,
                password,
                username,
                firstName,
                lastName,
                description,
                countryNumberPhone: countryCode.value,
                numberPhone: phoneNumber,
                profileImage: '',
            });
            toast.success(copy.registerSuccess);
            router.replace('/login' as any);
        } catch (error) {
            console.error('Registration error:', error instanceof Error ? error.message : 'Unknown error');
            toast.error(error instanceof Error ? error.message : copy.registerError);
        } finally {
            setLoading(false);
        }
    }, [email, firstName, lastName, username, password, description, phoneNumber, countryCode, router, copy]);

    return (
        <>
            <View style={styles.background}>
                <BrandBackdrop />
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        activeOpacity={0.7}
                        onPress={handleBackToLogin}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="arrow-back" size={20} color={brandTheme.colors.text} />
                        <Text style={styles.backButtonText}>{copy.backToLogin}</Text>
                    </TouchableOpacity>

                    <View style={styles.hero}>
                        <Text style={styles.headline}>
                            {copy.headlineTop}{"\n"}
                            <Text style={styles.headlineAccent}>{copy.headlineAccent}</Text>
                        </Text>
                        <Text style={styles.subline}>
                            {copy.subline}
                        </Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.formLabel}>{copy.formLabel}</Text>

                        <FloatingLabelInput
                            variant="login"
                            label={copy.emailLabel}
                            iconName="mail-outline"
                            focused={focusedField === 'email'}
                            value={email}
                            onChangeText={(v) => {
                                setEmail(v);
                                clearError('email');
                            }}
                            onFocus={() => setFocusedField('email')}
                            onBlur={() => setFocusedField(null)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            error={errors.email}
                        />

                        <FloatingLabelInput
                            variant="login"
                            label={copy.firstNameLabel}
                            iconName="person-outline"
                            focused={focusedField === 'firstName'}
                            value={firstName}
                            onChangeText={(v) => {
                                setFirstName(v);
                                clearError('firstName');
                            }}
                            onFocus={() => setFocusedField('firstName')}
                            onBlur={() => setFocusedField(null)}
                            autoCapitalize="words"
                            error={errors.firstName}
                        />

                        <FloatingLabelInput
                            variant="login"
                            label={copy.lastNameLabel}
                            iconName="person-outline"
                            focused={focusedField === 'lastName'}
                            value={lastName}
                            onChangeText={(v) => {
                                setLastName(v);
                                clearError('lastName');
                            }}
                            onFocus={() => setFocusedField('lastName')}
                            onBlur={() => setFocusedField(null)}
                            autoCapitalize="words"
                            error={errors.lastName}
                        />

                        <FloatingLabelInput
                            variant="login"
                            label={copy.usernameLabel}
                            iconName="at-outline"
                            focused={focusedField === 'username'}
                            value={username}
                            onChangeText={(v) => {
                                setUsername(v);
                                clearError('username');
                            }}
                            onFocus={() => setFocusedField('username')}
                            onBlur={() => setFocusedField(null)}
                            autoCapitalize="none"
                            error={errors.username}
                        />

                        <FloatingLabelInput
                            variant="login"
                            label={copy.passwordLabel}
                            iconName="lock-closed-outline"
                            focused={focusedField === 'password'}
                            value={password}
                            onChangeText={(v) => {
                                setPassword(v);
                                clearError('password');
                            }}
                            onFocus={() => setFocusedField('password')}
                            onBlur={() => setFocusedField(null)}
                            secureTextEntry={obscurePassword}
                            error={errors.password}
                            trailingIcon={
                                <TouchableOpacity onPress={() => setObscurePassword((v) => !v)}>
                                    <Ionicons
                                        name={obscurePassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color={brandTheme.colors.muted}
                                    />
                                </TouchableOpacity>
                            }
                        />

                        <FloatingLabelInput
                            variant="login"
                            label={copy.phoneLabel}
                            iconName="call-outline"
                            focused={focusedField === 'phone'}
                            value={phoneNumber}
                            onChangeText={(v) => {
                                setPhoneNumber(v);
                                clearError('phone');
                            }}
                            onFocus={() => setFocusedField('phone')}
                            onBlur={() => setFocusedField(null)}
                            keyboardType="phone-pad"
                            error={errors.phone}
                            trailingIcon={
                                <TouchableOpacity style={styles.countryCodeButton} onPress={() => setShowCountryPicker(true)}>
                                    <Text style={styles.countryCodeText}>
                                        {countryCode.flag} {countryCode.code}
                                    </Text>
                                    <Ionicons name="chevron-down-outline" size={16} color={brandTheme.colors.muted} />
                                </TouchableOpacity>
                            }
                        />

                        <FloatingLabelInput
                            variant="login"
                            label={copy.descriptionLabel}
                            iconName="chatbubble-outline"
                            focused={focusedField === 'description'}
                            value={description}
                            onChangeText={(v) => {
                                setDescription(v);
                                clearError('description');
                            }}
                            onFocus={() => setFocusedField('description')}
                            onBlur={() => setFocusedField(null)}
                            multiline
                            error={errors.description}
                        />

                        <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} disabled={loading}>
                            <LinearGradient
                                colors={brandTheme.gradients.primary}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={styles.primaryGradient}
                            >
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{copy.submit}</Text>}
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.dividerRow}>
                            <View style={styles.line} />
                            <Text style={styles.dividerLabel}>{copy.divider}</Text>
                            <View style={styles.line} />
                        </View>

                        <View style={styles.socialIconsRow}>
                            <TouchableOpacity
                                style={styles.socialIconButton}
                                onPress={() => {
                                    toast.info(copy.signupGoogleAttempt);
                                }}
                            >
                                <Image
                                    source={require('@/assets/images/google_logo.png')}
                                    style={styles.socialIcon}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.socialIconButton}
                                onPress={() => {
                                    toast.info(copy.signupAppleAttempt);
                                }}
                            >
                                <Ionicons name="logo-apple" size={26} color={brandTheme.colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>

            <Modal
                visible={showCountryPicker}
                animationType="slide"
                transparent
                onRequestClose={() => setShowCountryPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{copy.countryModalTitle}</Text>
                            <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                                <Ionicons name="close-outline" size={28} color={brandTheme.colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.countryList}>
                            {COUNTRY_CODES.map((country) => (
                                <TouchableOpacity
                                    key={`${country.code}-${country.country}`}
                                    style={[
                                        styles.countryItem,
                                        countryCode.code === country.code && countryCode.country === country.country
                                            ? styles.countryItemSelected
                                            : undefined,
                                    ]}
                                    onPress={() => {
                                        setCountryCode(country);
                                        setShowCountryPicker(false);
                                    }}
                                >
                                    <Text style={styles.countryFlag}>{country.flag}</Text>
                                    <View style={styles.countryInfo}>
                                        <Text style={styles.countryName}>{country.country}</Text>
                                        <Text style={styles.countryCodeLabel}>{country.code}</Text>
                                    </View>
                                    {countryCode.code === country.code && countryCode.country === country.country && (
                                        <Ionicons name="checkmark-outline" size={24} color={brandTheme.colors.orange} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ToastManager />
        </>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: brandTheme.colors.bg,
        overflow: 'hidden',
    },
    scrollView: {
        overflow: 'hidden',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 40,
    },
    backButton: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 18,
    },
    backButtonText: {
        color: brandTheme.colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    hero: {
        marginBottom: 20,
        gap: 10,
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
        paddingVertical: 20,
        paddingHorizontal: 16,
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
        borderRadius: 16,
        overflow: 'hidden',
        width: '100%',
        marginTop: 4,
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
        marginVertical: 28,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: brandTheme.colors.border,
    },
    dividerLabel: {
        marginHorizontal: 12,
        color: brandTheme.colors.muted,
        fontWeight: '600',
    },
    socialIconsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    socialIconButton: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: brandTheme.colors.surfaceStrong,
        borderWidth: 1,
        borderColor: brandTheme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialIcon: {
        width: 24,
        height: 24,
    },
    countryCodeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 8,
        borderRightWidth: 1,
        borderRightColor: brandTheme.colors.border,
        marginRight: 8,
    },
    countryCodeText: {
        fontSize: 14,
        color: brandTheme.colors.text,
        marginRight: 4,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#17110a',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 20,
        borderWidth: 1,
        borderColor: brandTheme.colors.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: brandTheme.colors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: brandTheme.colors.text,
    },
    countryList: {
        flex: 1,
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: brandTheme.colors.border,
    },
    countryItemSelected: {
        backgroundColor: 'rgba(249, 115, 22, 0.12)',
    },
    countryFlag: {
        fontSize: 16,
        marginRight: 12,
        color: brandTheme.colors.text,
        width: 34,
    },
    countryInfo: {
        flex: 1,
    },
    countryName: {
        fontSize: 16,
        fontWeight: '600',
        color: brandTheme.colors.text,
        marginBottom: 2,
    },
    countryCodeLabel: {
        fontSize: 14,
        color: brandTheme.colors.muted,
    },
});
