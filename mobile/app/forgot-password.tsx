import {Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import { createShadowStyle } from '@/utils/shadow';
import FloatingLabelInput from '../components/FloatingLabelInput';
import { validateEmail } from '../utils/validation';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [focusedField, setFocusedField] = useState<'email' | null>(null);
    const router = useRouter();

    const handleSubmit = () => {
        const emailValidation = validateEmail(email);
        setError(emailValidation.isValid ? null : (emailValidation.error ?? 'Email invalide'));
        
        if (!emailValidation.isValid) return;

        setSubmitted(true);
    };

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
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()} testID="back-button">
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                </View>
                
                <View style={styles.card}>
                    <Text style={styles.subHeading}>Récupération</Text>
                    <Text style={styles.welcomeText}>
                        {submitted 
                            ? 'Vérifiez votre boîte mail' 
                            : 'Entrez votre adresse e-mail pour recevoir un lien de réinitialisation.'}
                    </Text>
                    
                    <View style={styles.formSection}>
                        {submitted ? (
                            <View style={styles.successContainer}>
                                <Ionicons name="checkmark-circle" size={64} color="#4CAF50" style={styles.successIcon} />
                                <Text style={styles.infoText}>
                                    Si un compte existe pour <Text style={{ fontWeight: '700' }}>{email}</Text>, un lien de réinitialisation a été envoyé.
                                </Text>
                                <TouchableOpacity 
                                    style={styles.secondaryButton} 
                                    onPress={() => router.back()}
                                    testID="return-to-login-button"
                                >
                                    <Text style={styles.secondaryButtonText}>Retour à la connexion</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <FloatingLabelInput
                                    label="Adresse e-mail"
                                    iconName="mail-outline"
                                    focused={focusedField === 'email'}
                                    value={email}
                                    onChangeText={(v) => { setEmail(v); setError(null); }}
                                    onFocus={() => setFocusedField('email')}
                                    onBlur={() => setFocusedField(null)}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    error={error}
                                />
                                <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
                                    <LinearGradient
                                        colors={['#FFA92E', '#FF5D1E']}
                                        start={{ x: 0, y: 0.5 }}
                                        end={{ x: 1, y: 0.5 }}
                                        style={styles.primaryGradient}
                                    >
                                        <Text style={styles.primaryButtonText}>Envoyer le lien</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </>
                        )}
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
        lineHeight: 22,
        paddingHorizontal: 8,
    },
    formSection: {
        marginTop: 32,
    },
    primaryButton: {
        borderRadius: 16,
        overflow: 'hidden',
        width: '100%',
        marginTop: 8,
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
    successContainer: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    successIcon: {
        marginBottom: 16,
    },
    infoText: {
        color: '#333',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    secondaryButton: {
        backgroundColor: '#f0f0f0',
        paddingVertical: 16,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#111',
        fontWeight: '600',
        fontSize: 16,
    },
});