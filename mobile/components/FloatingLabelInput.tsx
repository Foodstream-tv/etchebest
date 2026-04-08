import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

interface FloatingLabelInputProps extends TextInputProps {
    label: string;
    iconName: React.ComponentProps<typeof Ionicons>['name'];
    focused: boolean;
    onFocus: () => void;
    onBlur: () => void;
    trailingIcon?: React.ReactNode;
    error?: string | null;
    variant?: 'default' | 'login';
}

const getIconColor = (isLoginVariant: boolean, error?: string | null): string => {
    if (isLoginVariant) {
        if (error) {
            return '#F2A1A1';
        }
        return 'rgba(250, 244, 234, 0.56)';
    }

    if (error) {
        return '#D00000';
    }

    return '#000';
};

const getPlaceholder = (isLoginVariant: boolean, isActive: boolean, label: string): string => {
    if (isLoginVariant) {
        return label;
    }

    if (isActive) {
        return '';
    }

    return label;
};

const getPlaceholderColor = (isLoginVariant: boolean): string => {
    if (isLoginVariant) {
        return 'rgba(250, 244, 234, 0.4)';
    }
    return '#7a7a7a';
};

const FloatingLabelInput = React.memo(function FloatingLabelInput({
    label,
    iconName,
    focused,
    onFocus,
    onBlur,
    value,
    trailingIcon,
    error,
    variant = 'default',
    ...rest
}: FloatingLabelInputProps) {
    const isLoginVariant = variant === 'login';
    const isActive = Boolean(focused || value);
    const showFloatingLabel = !isLoginVariant && isActive;
    const iconColor = getIconColor(isLoginVariant, error);
    const placeholder = getPlaceholder(isLoginVariant, isActive, label);
    const placeholderTextColor = getPlaceholderColor(isLoginVariant);

    const inputGroupStyles = [
        styles.inputGroup,
        isActive && styles.inputGroupFocused,
        !!error && styles.inputGroupError,
        isLoginVariant && styles.inputGroupLogin,
        isLoginVariant && isActive && styles.inputGroupFocusedLogin,
        isLoginVariant && !!error && styles.inputGroupErrorLogin,
        rest.multiline && styles.inputGroupMultiline,
    ];

    const inputStyles = [styles.input, isLoginVariant && styles.inputLogin, rest.multiline && styles.inputMultiline];
    const errorStyles = [styles.errorText, isLoginVariant && styles.errorTextLogin];

    return (
        <View style={[styles.inputWrapper, isLoginVariant && styles.inputWrapperLogin]}>
            {showFloatingLabel && <Text style={styles.floatingLabel}>{label}</Text>}
            <View style={inputGroupStyles}>
                <Ionicons name={iconName} size={isLoginVariant ? 22 : 20} color={iconColor} style={styles.leadingIcon} />
                <TextInput
                    style={inputStyles}
                    placeholder={placeholder}
                    placeholderTextColor={placeholderTextColor}
                    value={value}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    {...rest}
                />
                {trailingIcon}
            </View>
            {!!error && <Text style={errorStyles}>{error}</Text>}
        </View>
    );
});

export default FloatingLabelInput;

const styles = StyleSheet.create({
    inputWrapper: {
        marginBottom: 16,
        position: 'relative',
    },
    inputWrapperLogin: {
        marginBottom: 14,
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
    inputGroupLogin: {
        borderRadius: 24,
        borderColor: 'rgba(255, 255, 255, 0.13)',
        backgroundColor: 'rgba(255, 255, 255, 0.047)',
        minHeight: 60,
        height: 'auto',
    },
    inputGroupFocused: {
        borderColor: '#FF8A00',
    },
    inputGroupFocusedLogin: {
        borderColor: '#FF8B21',
    },
    inputGroupError: {
        borderColor: '#D00000',
    },
    inputGroupErrorLogin: {
        borderColor: '#EB8F8F',
    },
    inputGroupMultiline: {
        alignItems: 'flex-start',
        paddingTop: 14,
        paddingBottom: 14,
    },
    errorText: {
        marginTop: 4,
        marginLeft: 4,
        fontSize: 12,
        color: '#D00000',
        fontWeight: '500',
    },
    errorTextLogin: {
        marginTop: 6,
        color: '#F2A1A1',
    },
    leadingIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    inputLogin: {
        color: '#F8F1E9',
        fontSize: 17,
        paddingVertical: 14,
    },
    inputMultiline: {
        textAlignVertical: 'top',
        minHeight: 80,
        paddingTop: 0,
    },
});
