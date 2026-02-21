import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ToastManager, { Toast } from 'toastify-react-native';

const ForgotPasswordScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = () => {
        if (!email) {
            Toast.show({
                text1: 'Veuillez entrer votre adresse e-mail',
                position: 'bottom',
                icon: <Ionicons name="close-circle" size={24} color="red" />,
                iconColor: 'red',
                progressBarColor: 'red',
            });
            return;
        }
        setSubmitted(true);
        Toast.show({
            text1: 'Si un compte existe, un lien de réinitialisation a été envoyé.',
            position: 'bottom',
            icon: <Ionicons name="checkmark-circle" size={24} color="green" />,
            iconColor: 'green',
            progressBarColor: 'green',
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Mot de passe oublié</Text>
            {submitted ? (
                <Text style={styles.infoText}>
                    Si un compte existe pour <Text style={{ fontWeight: 'bold' }}>{email}</Text>, un lien de réinitialisation a été envoyé.
                </Text>
            ) : (
                <>
                    <Text style={styles.label}>Adresse e-mail</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Entrez votre adresse e-mail"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholderTextColor="#888"
                    />
                    <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                        <Text style={styles.buttonText}>Envoyer le lien</Text>
                    </TouchableOpacity>
                </>
            )}
            <ToastManager />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'rgba(255,255,255,0.95)',
    },
    title: {
        fontWeight: 'bold',
        fontSize: 24,
        color: '#000',
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        color: '#333',
        marginBottom: 8,
    },
    input: {
        width: '100%',
        height: 48,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 16,
        color: '#000',
        backgroundColor: '#fff',
    },
    button: {
        backgroundColor: 'orange',
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 32,
        marginBottom: 16,
    },
    buttonText: {
        color: '#000',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 16,
    },
    infoText: {
        color: '#333',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
    },
});

export default ForgotPasswordScreen;