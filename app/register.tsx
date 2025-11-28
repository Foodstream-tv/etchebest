import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ToastManager, { Toast } from 'toastify-react-native';

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [obscurePassword, setObscurePassword] = useState(true);
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [emailFocused, setEmailFocused] = useState(false);
    const [usernameFocused, setUsernameFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    const emailPattern = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const router = useRouter();

    const handleRegister = () => {
        if (!emailPattern.test(email)) {
            Toast.show({
                text1: 'Adresse e-mail invalide',
                position: 'bottom',
                icon: <Ionicons name="close-circle" size={24} color="red" />,
                iconColor: 'red',
                progressBarColor: 'red',
                visibilityTime: 2000,
            });
            return;
        }

        if (username.length < 3) {
            Toast.show({
                text1: 'L\'identifiant doit contenir au moins 3 caractères',
                position: 'bottom',
                icon: <Ionicons name="close-circle" size={24} color="red" />,
                iconColor: 'red',
                progressBarColor: 'red',
                visibilityTime: 2000,
            });
            return;
        }

        if (password.length < 8) {
            Toast.show({
                text1: 'Le mot de passe doit contenir au moins 8 caractères',
                position: 'bottom',
                icon: <Ionicons name="close-circle" size={24} color="red" />,
                iconColor: 'red',
                progressBarColor: 'red',
                visibilityTime: 2000,
            });
            return;
        }

        if (!day || !month || !year) {
            Toast.show({
                text1: 'Veuillez entrer votre date de naissance',
                position: 'bottom',
                icon: <Ionicons name="close-circle" size={24} color="red" />,
                iconColor: 'red',
                progressBarColor: 'red',
                visibilityTime: 2000,
            });
            return;
        }

        Toast.show({ text1: 'Inscription réussie !', position: 'bottom' });
        router.replace('/');
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
                                {Boolean(usernameFocused || username) && (
                                    <Text style={styles.floatingLabel}>Identifiant</Text>
                                )}
                                <View style={[styles.inputGroup, (usernameFocused || username) && styles.inputGroupFocused]}>
                                    <Ionicons name="person-outline" size={20} color="#000" style={styles.leadingIcon} />
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

                            <View style={styles.dateRow}>
                                <View style={[styles.dateInput, { flex: 1 }]}>
                                    <TextInput
                                        style={styles.dateText}
                                        placeholder="Jour"
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        value={day}
                                        onChangeText={setDay}
                                        placeholderTextColor="#7a7a7a"
                                    />
                                    <Ionicons name="chevron-down" size={18} color="#000" />
                                </View>
                                <View style={[styles.dateInput, { flex: 1 }]}>
                                    <TextInput
                                        style={styles.dateText}
                                        placeholder="Mois"
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        value={month}
                                        onChangeText={setMonth}
                                        placeholderTextColor="#7a7a7a"
                                    />
                                    <Ionicons name="chevron-down" size={18} color="#000" />
                                </View>
                                <View style={[styles.dateInput, { flex: 1 }]}>
                                    <TextInput
                                        style={styles.dateText}
                                        placeholder="Année"
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        value={year}
                                        onChangeText={setYear}
                                        placeholderTextColor="#7a7a7a"
                                    />
                                    <Ionicons name="chevron-down" size={18} color="#000" />
                                </View>
                            </View>

                            <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
                                <Text style={styles.primaryButtonText}>Inscription</Text>
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
        backgroundColor: '#FF8A00',
        borderRadius: 16,
        paddingVertical: 16,
        width: '100%',
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
