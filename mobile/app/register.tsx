import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ToastManager, { Toast } from 'toastify-react-native';
import apiService from '../services/api';
import toast from '../utils/toast';
import { validateEmail, validateMinLength, validatePassword, validatePhone } from '../utils/validation';

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [description, setDescription] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [obscurePassword, setObscurePassword] = useState(true);
    const [loading, setLoading] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [usernameFocused, setUsernameFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [firstNameFocused, setFirstNameFocused] = useState(false);
    const [lastNameFocused, setLastNameFocused] = useState(false);
    const [descriptionFocused, setDescriptionFocused] = useState(false);
    const [phoneFocused, setPhoneFocused] = useState(false);

    const router = useRouter();

    const handleRegister = async () => {
        const validations = [
            validateEmail(email),
            validateMinLength(firstName, 2, 'Le prénom'),
            validateMinLength(lastName, 2, 'Le nom'),
            validateMinLength(username, 2, 'L\'identifiant'),
            validatePassword(password),
            validateMinLength(description, 10, 'La description'),
            validatePhone(phoneNumber),
        ];

        for (const validation of validations) {
            if (!validation.isValid) {
                toast.error(validation.error!);
                return;
            }
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
                countryNumberPhone: 33,
                numberPhone: phoneNumber,
                profileImage: '',
            });
            toast.success('Inscription réussie !');
            router.replace('/login');
        } catch (error) {
            console.error('Registration error:', error);
            toast.error(error instanceof Error ? error.message : 'Erreur d\'inscription');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <View style={styles.background}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.card}>
                        <Text style={styles.heading}>Inscription</Text>
                        <View style={styles.formSection}>
                            <Text style={styles.subHeading}>Bienvenue</Text>

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
                                {Boolean(firstNameFocused || firstName) && (
                                    <Text style={styles.floatingLabel}>Prénom</Text>
                                )}
                                <View style={[styles.inputGroup, (firstNameFocused || firstName) && styles.inputGroupFocused]}>
                                    <Ionicons name="person-outline" size={20} color="#000" style={styles.leadingIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder={firstNameFocused || firstName ? '' : 'Prénom'}
                                        autoCapitalize="words"
                                        value={firstName}
                                        onChangeText={setFirstName}
                                        onFocus={() => setFirstNameFocused(true)}
                                        onBlur={() => setFirstNameFocused(false)}
                                        placeholderTextColor="#7a7a7a"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputWrapper}>
                                {Boolean(lastNameFocused || lastName) && (
                                    <Text style={styles.floatingLabel}>Nom</Text>
                                )}
                                <View style={[styles.inputGroup, (lastNameFocused || lastName) && styles.inputGroupFocused]}>
                                    <Ionicons name="person-outline" size={20} color="#000" style={styles.leadingIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder={lastNameFocused || lastName ? '' : 'Nom'}
                                        autoCapitalize="words"
                                        value={lastName}
                                        onChangeText={setLastName}
                                        onFocus={() => setLastNameFocused(true)}
                                        onBlur={() => setLastNameFocused(false)}
                                        placeholderTextColor="#7a7a7a"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputWrapper}>
                                {Boolean(usernameFocused || username) && (
                                    <Text style={styles.floatingLabel}>Identifiant</Text>
                                )}
                                <View style={[styles.inputGroup, (usernameFocused || username) && styles.inputGroupFocused]}>
                                    <Ionicons name="at-outline" size={20} color="#000" style={styles.leadingIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder={usernameFocused || username ? '' : 'Identifiant'}
                                        autoCapitalize="none"
                                        value={username}
                                        onChangeText={setUsername}
                                        onFocus={() => setUsernameFocused(true)}
                                        onBlur={() => setUsernameFocused(false)}
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

                            <View style={styles.inputWrapper}>
                                {Boolean(phoneFocused || phoneNumber) && (
                                    <Text style={styles.floatingLabel}>Numéro de téléphone</Text>
                                )}
                                <View style={[styles.inputGroup, (phoneFocused || phoneNumber) && styles.inputGroupFocused]}>
                                    <Ionicons name="call-outline" size={20} color="#000" style={styles.leadingIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder={phoneFocused || phoneNumber ? '' : 'Numéro de téléphone'}
                                        keyboardType="phone-pad"
                                        value={phoneNumber}
                                        onChangeText={setPhoneNumber}
                                        onFocus={() => setPhoneFocused(true)}
                                        onBlur={() => setPhoneFocused(false)}
                                        placeholderTextColor="#7a7a7a"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputWrapper}>
                                {Boolean(descriptionFocused || description) && (
                                    <Text style={styles.floatingLabel}>Description</Text>
                                )}
                                <View style={[styles.inputGroup, (descriptionFocused || description) && styles.inputGroupFocused]}>
                                    <Ionicons name="chatbubble-outline" size={20} color="#000" style={styles.leadingIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder={descriptionFocused || description ? '' : 'Parlez-nous de vous...'}
                                        multiline
                                        value={description}
                                        onChangeText={setDescription}
                                        onFocus={() => setDescriptionFocused(true)}
                                        onBlur={() => setDescriptionFocused(false)}
                                        placeholderTextColor="#7a7a7a"
                                    />
                                </View>
                            </View>

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
                                    onPress={() => {
                                        Toast.show({
                                            text1: 'Tentative d\'inscription avec Google',
                                            position: 'bottom',
                                            icon: <Ionicons name="logo-google" size={24} color="#4285F4" />,
                                            iconColor: '#4285F4',
                                        });
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
                                        Toast.show({
                                            text1: 'Tentative d\'inscription avec Apple',
                                            position: 'bottom',
                                            icon: <Ionicons name="logo-apple" size={24} color="#000" />,
                                            iconColor: '#000',
                                        });
                                    }}
                                >
                                    <Ionicons name="logo-apple" size={26} color="#000" />
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
});
