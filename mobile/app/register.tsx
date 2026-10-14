import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import AuthLayout from '@/components/auth/AuthLayout';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { blurActiveElementOnWeb, inputRef } from '@/components/auth/helpers';
import FloatingLabelInput from '@/components/FloatingLabelInput';
import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import apiService from '@/services/api';
import { bodyString, isApiError } from '@/utils/authErrors';
import { toast } from '@/utils/toast';
import {
    LIMITS,
    RegisterFieldErrors,
    RegisterFieldName,
    ValidationCode,
    validateRegisterForm,
} from '@/utils/validation';

type CountryCode = {
    code: string;
    flag: string;
    value: number;
    name: { fr: string; en: string };
};

// Same list as the web PhoneField (front-web/src/components/auth/PhoneField.tsx).
const COUNTRY_CODES: CountryCode[] = [
    { code: '+33', flag: '🇫🇷', value: 33, name: { fr: 'France', en: 'France' } },
    { code: '+1', flag: '🇺🇸', value: 1, name: { fr: 'États-Unis', en: 'United States' } },
    { code: '+1', flag: '🇨🇦', value: 1, name: { fr: 'Canada', en: 'Canada' } },
    { code: '+44', flag: '🇬🇧', value: 44, name: { fr: 'Royaume-Uni', en: 'United Kingdom' } },
    { code: '+49', flag: '🇩🇪', value: 49, name: { fr: 'Allemagne', en: 'Germany' } },
    { code: '+34', flag: '🇪🇸', value: 34, name: { fr: 'Espagne', en: 'Spain' } },
    { code: '+39', flag: '🇮🇹', value: 39, name: { fr: 'Italie', en: 'Italy' } },
    { code: '+32', flag: '🇧🇪', value: 32, name: { fr: 'Belgique', en: 'Belgium' } },
    { code: '+41', flag: '🇨🇭', value: 41, name: { fr: 'Suisse', en: 'Switzerland' } },
    { code: '+352', flag: '🇱🇺', value: 352, name: { fr: 'Luxembourg', en: 'Luxembourg' } },
    { code: '+212', flag: '🇲🇦', value: 212, name: { fr: 'Maroc', en: 'Morocco' } },
    { code: '+213', flag: '🇩🇿', value: 213, name: { fr: 'Algérie', en: 'Algeria' } },
    { code: '+216', flag: '🇹🇳', value: 216, name: { fr: 'Tunisie', en: 'Tunisia' } },
];

const sameCountry = (a: CountryCode, b: CountryCode) => a.code === b.code && a.name.fr === b.name.fr;

type FieldMessages = Record<RegisterFieldName, string | null>;

const NO_ERRORS: FieldMessages = {
    email: null,
    firstName: null,
    lastName: null,
    username: null,
    password: null,
    phone: null,
    description: null,
};

export default function RegisterScreen() {
    const { t, locale } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [description, setDescription] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState<CountryCode>(COUNTRY_CODES[0]);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [obscurePassword, setObscurePassword] = useState(true);
    const [loading, setLoading] = useState(false);
    const [googleBusy, setGoogleBusy] = useState(false);
    const [focusedField, setFocusedField] = useState<RegisterFieldName | null>(null);
    const [errors, setErrors] = useState<FieldMessages>(NO_ERRORS);
    const [formError, setFormError] = useState<string | null>(null);

    const firstNameRef = useRef<TextInput>(null);
    const lastNameRef = useRef<TextInput>(null);
    const usernameRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);
    const phoneRef = useRef<TextInput>(null);
    const descriptionRef = useRef<TextInput>(null);
    const submittingRef = useRef(false);

    const clearError = useCallback((field: RegisterFieldName) => {
        setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
        setFormError(null);
    }, []);

    const handleBackToLogin = useCallback(() => {
        blurActiveElementOnWeb();
        router.replace('/login' as never);
    }, [router]);

    const messageFor = useCallback(
        (field: RegisterFieldName, code: ValidationCode): string => {
            const required: Record<RegisterFieldName, string> = {
                email: t('auth.signup.errorEmailRequired'),
                firstName: t('auth.signup.errorFirstNameRequired'),
                lastName: t('auth.signup.errorLastNameRequired'),
                username: t('auth.signup.errorUsernameRequired'),
                password: t('auth.signup.errorPasswordRequired'),
                phone: t('auth.signup.errorPhoneRequired'),
                description: t('auth.signup.errorBioRequired'),
            };
            if (code === 'required') return required[field];

            switch (field) {
                case 'email':
                    return t('auth.signup.errorEmailInvalid');
                case 'firstName':
                    return t('auth.signup.errorFirstName');
                case 'lastName':
                    return t('auth.signup.errorLastName');
                case 'username':
                    return t('auth.signup.errorUsername');
                case 'password':
                    return t('auth.signup.errorPassword');
                case 'phone':
                    return t('auth.signup.errorPhone');
                default:
                    return code === 'tooLong'
                        ? t('auth.signup.errorBioMax')
                        : t('auth.signup.errorBioMin', { count: description.trim().length });
            }
        },
        [description, t]
    );

    const toMessages = useCallback(
        (codes: RegisterFieldErrors): FieldMessages => {
            const messages: FieldMessages = { ...NO_ERRORS };
            (Object.keys(codes) as RegisterFieldName[]).forEach((field) => {
                const code = codes[field];
                if (code) messages[field] = messageFor(field, code);
            });
            return messages;
        },
        [messageFor]
    );

    const handleRegister = useCallback(async () => {
        if (submittingRef.current) return;
        setFormError(null);

        const codes = validateRegisterForm({
            email,
            firstName,
            lastName,
            username,
            password,
            phone: phoneNumber,
            description,
        });
        const messages = toMessages(codes);
        setErrors(messages);
        if (Object.keys(codes).length > 0) {
            setFormError(t('auth.signup.errorFixFields'));
            return;
        }

        submittingRef.current = true;
        setLoading(true);
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const response = await apiService.register({
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

            // The account exists but is not verified yet: the e-mail code is entered on /verify.
            const params: Record<string, string> = { email: normalizedEmail };
            if (response?.userId) params.userId = response.userId;
            if (response?.devCode) params.devCode = response.devCode;
            blurActiveElementOnWeb();
            router.replace({ pathname: '/verify', params } as never);
        } catch (error) {
            const code = bodyString(error, 'code');
            const message = error instanceof Error ? error.message.toLowerCase() : '';

            if (code === 'EMAIL_ALREADY_EXISTS' || message.includes('email is already being used')) {
                setErrors((prev) => ({ ...prev, email: t('auth.signup.errorEmailExists') }));
                setFormError(t('auth.signup.errorEmailExists'));
            } else if (code === 'USERNAME_ALREADY_EXISTS' || message.includes('username is already taken')) {
                setErrors((prev) => ({ ...prev, username: t('auth.signup.errorUsernameExists') }));
                setFormError(t('auth.signup.errorUsernameExists'));
            } else {
                const text = isApiError(error) && error.status === 429 ? t('auth.signup.errorRateLimit') : t('auth.signup.errorGeneric');
                setFormError(text);
                toast.error(text);
            }
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
    }, [
        countryCode,
        description,
        email,
        firstName,
        lastName,
        password,
        phoneNumber,
        router,
        t,
        toMessages,
        username,
    ]);

    const bioLength = description.trim().length;
    const bioMissing = LIMITS.descriptionMin - bioLength;
    const countryName = countryCode.name[locale];

    return (
        <>
            <AuthLayout
                testID="register-screen"
                back={{ label: t('common.back'), onPress: handleBackToLogin, testID: 'register-back' }}
                label={t('auth.signup.label')}
                title={t('auth.signup.title')}
                subtitle={t('auth.signup.subtitle')}
                bottomText={t('auth.signup.hasAccount')}
                bottomLinkLabel={t('auth.signup.signinLink')}
                onBottomLinkPress={handleBackToLogin}
            >
                <FloatingLabelInput
                    label={t('auth.signin.emailPlaceholder')}
                    iconName="mail-outline"
                    focused={focusedField === 'email'}
                    value={email}
                    onChangeText={(value) => {
                        setEmail(value);
                        clearError('email');
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
                    onSubmitEditing={() => firstNameRef.current?.focus()}
                    editable={!loading}
                    error={errors.email}
                />

                <FloatingLabelInput
                    {...inputRef(firstNameRef)}
                    label={t('auth.signup.firstName')}
                    iconName="person-outline"
                    focused={focusedField === 'firstName'}
                    value={firstName}
                    onChangeText={(value) => {
                        setFirstName(value);
                        clearError('firstName');
                    }}
                    onFocus={() => setFocusedField('firstName')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                    autoComplete="given-name"
                    textContentType="givenName"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                    editable={!loading}
                    error={errors.firstName}
                />

                <FloatingLabelInput
                    {...inputRef(lastNameRef)}
                    label={t('auth.signup.lastName')}
                    iconName="person-outline"
                    focused={focusedField === 'lastName'}
                    value={lastName}
                    onChangeText={(value) => {
                        setLastName(value);
                        clearError('lastName');
                    }}
                    onFocus={() => setFocusedField('lastName')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                    autoComplete="family-name"
                    textContentType="familyName"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => usernameRef.current?.focus()}
                    editable={!loading}
                    error={errors.lastName}
                />

                <FloatingLabelInput
                    {...inputRef(usernameRef)}
                    label={t('auth.signup.username')}
                    iconName="at-outline"
                    focused={focusedField === 'username'}
                    value={username}
                    onChangeText={(value) => {
                        setUsername(value);
                        clearError('username');
                    }}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username-new"
                    textContentType="username"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    editable={!loading}
                    error={errors.username}
                />

                <FloatingLabelInput
                    {...inputRef(passwordRef)}
                    label={t('auth.signin.passwordPlaceholder')}
                    iconName="lock-closed-outline"
                    focused={focusedField === 'password'}
                    value={password}
                    onChangeText={(value) => {
                        setPassword(value);
                        clearError('password');
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={obscurePassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => phoneRef.current?.focus()}
                    editable={!loading}
                    error={errors.password}
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

                <FloatingLabelInput
                    {...inputRef(phoneRef)}
                    label={t('auth.signup.phone')}
                    iconName="call-outline"
                    focused={focusedField === 'phone'}
                    value={phoneNumber}
                    onChangeText={(value) => {
                        setPhoneNumber(value);
                        clearError('phone');
                    }}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="phone-pad"
                    autoComplete="tel-national"
                    textContentType="telephoneNumber"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => descriptionRef.current?.focus()}
                    editable={!loading}
                    error={errors.phone}
                    trailingIcon={
                        <Pressable
                            style={styles.countryCodeButton}
                            onPress={() => setShowCountryPicker(true)}
                            accessibilityRole="button"
                            accessibilityLabel={t('auth.phone.chooseCountryAria', {
                                country: countryName,
                                code: countryCode.code,
                            })}
                            testID="country-picker-button"
                            hitSlop={8}
                        >
                            <Text style={styles.countryCodeText}>
                                {countryCode.flag} {countryCode.code}
                            </Text>
                            <Ionicons name="chevron-down-outline" size={16} color={colors.muted} />
                        </Pressable>
                    }
                />

                <FloatingLabelInput
                    {...inputRef(descriptionRef)}
                    label={t('auth.signup.bio')}
                    iconName="document-text-outline"
                    focused={focusedField === 'description'}
                    value={description}
                    onChangeText={(value) => {
                        setDescription(value);
                        clearError('description');
                    }}
                    onFocus={() => setFocusedField('description')}
                    onBlur={() => setFocusedField(null)}
                    multiline
                    maxLength={LIMITS.descriptionMax}
                    editable={!loading}
                    error={errors.description}
                />
                {bioLength > 0 && !errors.description ? (
                    <Text
                        style={[styles.helper, bioMissing > 0 ? styles.helperWarn : styles.helperOk]}
                        testID="bio-helper"
                    >
                        {bioMissing > 0
                            ? t('auth.signup.bioMinHelper', { count: bioMissing, plural: bioMissing > 1 ? 's' : '' })
                            : t('auth.signup.bioValidHelper')}
                    </Text>
                ) : null}

                {formError ? (
                    <Text style={styles.formError} accessibilityRole="alert">
                        {formError}
                    </Text>
                ) : null}

                <Button
                    label={loading ? t('auth.signup.submitting') : t('auth.signup.submit')}
                    onPress={handleRegister}
                    loading={loading}
                    disabled={googleBusy}
                    testID="register-submit"
                />

                <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerLabel}>{t('auth.signin.or')}</Text>
                    <View style={styles.dividerLine} />
                </View>

                <GoogleAuthButton disabled={loading} onBusyChange={setGoogleBusy} testID="google-register-button" />
            </AuthLayout>

            <Modal
                visible={showCountryPicker}
                animationType="slide"
                transparent
                onRequestClose={() => setShowCountryPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle} accessibilityRole="header">
                                {t('auth.signup.countryPickerTitle')}
                            </Text>
                            <Pressable
                                onPress={() => setShowCountryPicker(false)}
                                accessibilityRole="button"
                                accessibilityLabel={t('common.close')}
                                hitSlop={10}
                                style={styles.modalClose}
                            >
                                <Ionicons name="close-outline" size={28} color={colors.text} />
                            </Pressable>
                        </View>
                        <ScrollView accessibilityLabel={t('auth.phone.countryListAria')}>
                            {COUNTRY_CODES.map((country) => {
                                const selected = sameCountry(countryCode, country);
                                return (
                                    <Pressable
                                        key={`${country.code}-${country.name.fr}`}
                                        style={[styles.countryItem, selected && styles.countryItemSelected]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected }}
                                        accessibilityLabel={`${country.name[locale]} ${country.code}`}
                                        onPress={() => {
                                            setCountryCode(country);
                                            setShowCountryPicker(false);
                                        }}
                                    >
                                        <Text style={styles.countryFlag}>{country.flag}</Text>
                                        <View style={styles.countryInfo}>
                                            <Text style={styles.countryName}>{country.name[locale]}</Text>
                                            <Text style={styles.countryCodeLabel}>{country.code}</Text>
                                        </View>
                                        {selected ? <Ionicons name="checkmark-outline" size={24} color={colors.orange} /> : null}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    eyeButton: {
        padding: 4,
        marginLeft: 8,
    },
    helper: {
        marginTop: -8,
        marginBottom: 14,
        marginLeft: 4,
        fontSize: 12,
        fontWeight: '500',
    },
    helperWarn: {
        color: colors.muted,
    },
    helperOk: {
        color: colors.success,
    },
    formError: {
        marginBottom: 12,
        color: colors.danger,
        fontSize: 14,
        fontWeight: '500',
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
    countryCodeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 8,
        marginLeft: 8,
        minHeight: 44,
        borderLeftWidth: 1,
        borderLeftColor: colors.border,
    },
    countryCodeText: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.cardSolid,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '80%',
        paddingBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
    },
    modalClose: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        minHeight: 56,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    countryItemSelected: {
        backgroundColor: colors.orangeSoft,
    },
    countryFlag: {
        fontSize: 22,
        marginRight: 14,
        width: 34,
    },
    countryInfo: {
        flex: 1,
    },
    countryName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    countryCodeLabel: {
        fontSize: 14,
        color: colors.muted,
    },
}));
