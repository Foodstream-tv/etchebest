import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SocialButtonProps {
    label: string;
    onPress: () => void;
    icon: React.ReactNode;
}

const SocialButton = React.memo(function SocialButton({ label, onPress, icon }: SocialButtonProps) {
    return (
        <TouchableOpacity style={styles.socialButton} onPress={onPress}>
            <View style={styles.socialButtonContent}>
                <View style={styles.socialIconBadge}>{icon}</View>
                <Text style={styles.socialText}>{label}</Text>
            </View>
        </TouchableOpacity>
    );
});

export default SocialButton;

const styles = StyleSheet.create({
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
    socialText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginLeft: 18,
    },
});
