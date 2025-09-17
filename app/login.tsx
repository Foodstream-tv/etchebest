import { FontAwesome, Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Image, ImageBackground, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';


export default function LoginScreen({ onLoginSuccess }: Readonly<{ onLoginSuccess?: () => void }>)
{
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [obscurePassword, setObscurePassword] = useState(true);

    const emailPattern = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;

    const handleLogin = () => {
        if (!emailPattern.test(email)) {
            Alert.alert('Erreur', 'Veuillez entrer une adresse e-mail valide');
            return;
        }

        if (password.length < 8) {
            Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères');
            return;
        }

        if (onLoginSuccess) {
            onLoginSuccess();
        }
    };

    return (
        <ImageBackground
            source={require('@/assets/images/food-iphone.jpg')}
            style={styles.background}
            blurRadius={8}
        >
            <View style={styles.container}>
                <Text style={styles.title}>Bienvenue</Text>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Adresse e-mail"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                        placeholderTextColor="#888"
                    />
                    <Ionicons name="mail" size={20} color="#888" style={styles.icon} />
                </View>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Mot de passe"
                        secureTextEntry={obscurePassword}
                        value={password}
                        onChangeText={setPassword}
                        placeholderTextColor="#888"
                    />
                    <TouchableOpacity onPress={() => setObscurePassword(!obscurePassword)}>
                        <Ionicons name={obscurePassword ? 'eye-off' : 'eye'} size={20} color="#888" style={styles.icon} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => Alert.alert('Mot de passe oublié')}>
                    <Text style={styles.forgotText}>Mot de passe oublié?</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                    <Text style={styles.loginButtonText}>Se connecter</Text>
                </TouchableOpacity>
                <View style={styles.dividerContainer}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>Ou</Text>
                    <View style={styles.divider} />
                </View>
                <View style={styles.socialRow}>
                    <TouchableOpacity style={styles.googleButton} onPress={() => Alert.alert('Google', 'Connexion avec Google')}>
                        <Image
                            source={require('@/assets/images/google_logo.png')}
                            style={styles.googleIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.facebookButton} onPress={() => Alert.alert('Facebook', 'Connexion avec Facebook')}>
                        <FontAwesome name="facebook" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>
                <View style={styles.signupContainer}>
                    <Text style={styles.signupText}>Vous n'avez pas de compte? </Text>
                    <TouchableOpacity onPress={() => Alert.alert('Inscription', 'Rediriger vers inscription')}>
                        <Text style={styles.signupLink}>Inscrivez-vous</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        resizeMode: 'cover',
        justifyContent: 'center',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    title: {
        fontWeight: 'bold',
        fontSize: 28,
        color: '#000',
        textAlign: 'center',
        marginBottom: 24,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 8,
        marginBottom: 16,
        paddingHorizontal: 12,
    },
    input: {
        flex: 1,
        height: 48,
        color: '#000',
    },
    icon: {
        marginLeft: 8,
    },
    loginButton: {
        backgroundColor: 'orange',
        borderRadius: 8,
        paddingVertical: 14,
        marginBottom: 16,
    },
    loginButtonText: {
        color: '#000',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 16,
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    googleButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 8,
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    googleIcon: {
        width: 28,
        height: 28,
    },
    googleButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 15,
    },
    facebookButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#1877F3',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 8,
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 12,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#ccc',
    },
    dividerText: {
        marginHorizontal: 8,
        color: '#888',
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingVertical: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#eee',
    },
    socialIcon: {
        marginLeft: 16,
        marginRight: 8,
    },
    socialButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 15,
    },
    forgotText: {
        color: '#000',
        textAlign: 'center',
        textDecorationLine: 'underline',
        marginBottom: 16,
    },
    signupContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    signupText: {
        color: '#fff',
    },
    signupLink: {
        color: 'orange',
        fontWeight: 'bold',
    },
});
