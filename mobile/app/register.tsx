import {Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import { createShadowStyle } from '@/utils/shadow';
import FloatingLabelInput from '../components/FloatingLabelInput';
import apiService from '../services/api';
import { validateEmail, validateLengthRange, validateMinLength, validatePassword, validatePhone } from '../utils/validation';

// Common country codes for phone registration
// Each entry has:
// - code: The international dialing prefix (string with +)
// - country: Localized country name in French
// - flag: Emoji flag for visual identification
// - value: Numeric country code for API (matches API's countryNumberPhone field)
const COUNTRY_CODES = [
    { code: '+33', country: 'France', flag: '🇫🇷', value: 33 },
    { code: '+1', country: 'États-Unis', flag: '🇺🇸', value: 1 },
    { code: '+1', country: 'Canada', flag: '🇨🇦', value: 1 },
    { code: '+44', country: 'Royaume-Uni', flag: '🇬🇧', value: 44 },
    { code: '+49', country: 'Allemagne', flag: '🇩🇪', value: 49 },
    { code: '+34', country: 'Espagne', flag: '🇪🇸', value: 34 },
    { code: '+39', country: 'Italie', flag: '🇮🇹', value: 39 },
    { code: '+32', country: 'Belgique', flag: '🇧🇪', value: 32 },
    { code: '+41', country: 'Suisse', flag: '🇨🇭', value: 41 },
    { code: '+352', country: 'Luxembourg', flag: '🇱🇺', value: 352 },
    { code: '+212', country: 'Maroc', flag: '🇲🇦', value: 212 },
    { code: '+213', country: 'Algérie', flag: '🇩🇿', value: 213 },
    { code: '+216', country: 'Tunisie', flag: '🇹🇳', value: 216 },
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
    email: null, firstName: null, lastName: null,
    username: null, password: null, phone: null, description: null,
};

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [description, setDescription] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const countryPickerCloseRef = useRef<any>(null);
    const [obscurePassword, setObscurePassword] = useState(true);
    const [loading, setLoading] = useState(false);
    const [focusedField, setFocusedField] = useState<FocusedField>(null);
    const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS);
    const [socialMessage, setSocialMessage] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);

    const router = useRouter();

    useEffect(() => {
        if (showCountryPicker && Platform.OS === 'web') {
            countryPickerCloseRef.current?.focus?.();
        }
    }, [showCountryPicker]);

    const openCountryPicker = useCallback(() => {
        if (Platform.OS === 'web') {
            const active = document.activeElement as HTMLElement | null;
            active?.blur?.();
        }
        setShowCountryPicker(true);
    }, []);

    const clearError = useCallback((field: keyof FieldErrors) => {
        setErrors(prev => ({ ...prev, [field]: null }));
        setApiError(null);
    }, []);

    const handleRegister = useCallback(async () => {
        const validations: FieldErrors = {
            email: validateEmail(email).error ?? null,
            firstName: validateMinLength(firstName, 2, 'Le prénom').error ?? null,
            lastName: validateMinLength(lastName, 2, 'Le nom').error ?? null,
            username: validateMinLength(username, 3, 'L\'identifiant').error ?? null,
            password: validatePassword(password).error ?? null,
            description: validateLengthRange(description, 10, 500, 'La description').error ?? null,
            phone: validatePhone(phoneNumber).error ?? null,
        };

        const hasError = Object.values(validations).some(Boolean);
        setErrors(validations);
        if (hasError) return;

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
            // We don't need a success toast since we redirect immediately
            router.replace('/login');
        } catch (error) {
            console.error('Registration error:', error instanceof Error ? error.message : 'Unknown error');
            setApiError(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.');
        } finally {
            setLoading(false);
        }
    }, [email, firstName, lastName, username, password, description, phoneNumber, countryCode, router]);

    return (
        <>
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
                        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.subHeading}>Inscription</Text>
                        <Text style={styles.welcomeText}>Créez votre compte pour commencer !</Text>
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
                                onChangeText={v => { setEmail(v); clearError('email'); }}
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                error={errors.email}
                            />

                            <FloatingLabelInput
                                label="Prénom"
                                iconName="person-outline"
                                focused={focusedField === 'firstName'}
                                value={firstName}
                                onChangeText={v => { setFirstName(v); clearError('firstName'); }}
                                onFocus={() => setFocusedField('firstName')}
                                onBlur={() => setFocusedField(null)}
                                autoCapitalize="words"
                                error={errors.firstName}
                            />

                            <FloatingLabelInput
                                label="Nom"
                                iconName="person-outline"
                                focused={focusedField === 'lastName'}
                                value={lastName}
                                onChangeText={v => { setLastName(v); clearError('lastName'); }}
                                onFocus={() => setFocusedField('lastName')}
                                onBlur={() => setFocusedField(null)}
                                autoCapitalize="words"
                                error={errors.lastName}
                            />

                            <FloatingLabelInput
                                label="Identifiant"
                                iconName="at-outline"
                                focused={focusedField === 'username'}
                                value={username}
                                onChangeText={v => { setUsername(v); clearError('username'); }}
                                onFocus={() => setFocusedField('username')}
                                onBlur={() => setFocusedField(null)}
                                autoCapitalize="none"
                                error={errors.username}
                            />

                            <FloatingLabelInput
                                label="Mot de passe"
                                iconName="lock-closed-outline"
                                focused={focusedField === 'password'}
                                value={password}
                                onChangeText={v => { setPassword(v); clearError('password'); }}
                                onFocus={() => setFocusedField('password')}
                                onBlur={() => setFocusedField(null)}
                                secureTextEntry={obscurePassword}
                                error={errors.password}
                                trailingIcon={
                                    <TouchableOpacity onPress={() => setObscurePassword(v => !v)}>
                                        <Ionicons
                                            name={obscurePassword ? 'eye-off-outline' : 'eye-outline'}
                                            size={20}
                                            color="#000"
                                        />
                                    </TouchableOpacity>
                                }
                            />

                            <FloatingLabelInput
                                label="Numéro de téléphone"
                                iconName="call-outline"
                                focused={focusedField === 'phone'}
                                value={phoneNumber}
                                onChangeText={v => { setPhoneNumber(v); clearError('phone'); }}
                                onFocus={() => setFocusedField('phone')}
                                onBlur={() => setFocusedField(null)}
                                keyboardType="phone-pad"
                                error={errors.phone}
                                trailingIcon={
                                    <TouchableOpacity
                                        style={styles.countryCodeButton}
                                        onPress={openCountryPicker}
                                    >
                                        <Text style={styles.countryCodeText}>{countryCode.flag} {countryCode.code}</Text>
                                        <Ionicons name="chevron-down-outline" size={16} color="#000" />
                                    </TouchableOpacity>
                                }
                            />

                            <FloatingLabelInput
                                label="Description"
                                iconName="chatbubble-outline"
                                focused={focusedField === 'description'}
                                value={description}
                                onChangeText={v => { setDescription(v); clearError('description'); }}
                                onFocus={() => setFocusedField('description')}
                                onBlur={() => setFocusedField(null)}
                                multiline
                                error={errors.description}
                            />

                            <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} disabled={loading}>
                                <LinearGradient
                                    colors={['#FFA92E', '#FF5D1E']}
                                    start={{ x: 0, y: 0.5 }}
                                    end={{ x: 1, y: 0.5 }}
                                    style={styles.primaryGradient}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>Inscription</Text>
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
                                    onPress={() => setSocialMessage('L\'inscription avec Google n\'est pas encore disponible')}
                                >
                                    <Image
                                        source={require('@/assets/images/google_logo.png')}
                                        style={styles.socialIcon}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.socialIconButton}
                                    onPress={() => setSocialMessage('L\'inscription avec Apple n\'est pas encore disponible')}
                                >
                                    <Ionicons name="logo-apple" size={30} color="#000" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.socialIconButton}
                                    onPress={() => setSocialMessage('L\'inscription avec Facebook n\'est pas encore disponible')}
                                >
                                    <Ionicons name="logo-facebook" size={30} color="#1877F2" />
                                </TouchableOpacity>
                            </View>

                            {!!socialMessage && (
                                <Text style={styles.socialErrorText}>{socialMessage}</Text>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </View>

            {/* Country Code Picker Modal */}
            <Modal
                visible={showCountryPicker}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCountryPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Sélectionner un indicatif</Text>
                            <TouchableOpacity ref={countryPickerCloseRef} onPress={() => setShowCountryPicker(false)}>
                                <Ionicons name="close-outline" size={28} color="#000" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.countryList}>
                            {COUNTRY_CODES.map((country) => (
                                <TouchableOpacity
                                    key={country.country}
                                    style={[
                                        styles.countryItem,
                                        countryCode.country === country.country && styles.countryItemSelected
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
                                    {countryCode.country === country.country && (
                                        <Ionicons name="checkmark-outline" size={24} color="#FF8A00" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
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
    backButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        ...createShadowStyle({
            color: '#000',
            offset: { width: 0, height: 4 },
            opacity: 0.1,
            radius: 8,
            elevation: 4,
        }),
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
    dateRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#bcbcbc',
        paddingHorizontal: 16,
        height: 56,
        backgroundColor: '#fff',
    },
    dateText: {
        fontSize: 16,
        color: '#000',
        flex: 1,
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
    countryCodeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 8,
        borderRightWidth: 1,
        borderRightColor: '#e8e8e8',
        marginRight: 8,
    },
    countryCodeText: {
        fontSize: 16,
        color: '#000',
        marginRight: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '60%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e8e8e8',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111',
    },
    countryList: {
        width: '100%',
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    countryItemSelected: {
        backgroundColor: '#FFF5E6',
    },
    countryFlag: {
        fontSize: 28,
        marginRight: 12,
    },
    countryInfo: {
        flex: 1,
    },
    countryName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111',
        marginBottom: 2,
    },
    countryCodeLabel: {
        fontSize: 14,
        color: '#7a7a7a',
    },
});