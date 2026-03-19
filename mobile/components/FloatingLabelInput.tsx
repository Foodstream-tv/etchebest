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
}

const FloatingLabelInput = React.memo(function FloatingLabelInput({
    label,
    iconName,
    focused,
    onFocus,
    onBlur,
    value,
    trailingIcon,
    error,
    ...rest
}: FloatingLabelInputProps) {
    const isActive = Boolean(focused || value);

    return (
        <View style={styles.inputWrapper}>
            {isActive && <Text style={styles.floatingLabel}>{label}</Text>}
            <View style={[styles.inputGroup, isActive && styles.inputGroupFocused, !!error && styles.inputGroupError]}>
                <Ionicons name={iconName} size={20} color={error ? '#D00000' : '#000'} style={styles.leadingIcon} />
                <TextInput
                    style={styles.input}
                    placeholder={isActive ? '' : label}
                    placeholderTextColor="#7a7a7a"
                    value={value}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    {...rest}
                />
                {trailingIcon}
            </View>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
});

export default FloatingLabelInput;

const styles = StyleSheet.create({
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
    inputGroupError: {
        borderColor: '#D00000',
    },
    errorText: {
        marginTop: 4,
        marginLeft: 4,
        fontSize: 12,
        color: '#D00000',
        fontWeight: '500',
    },
    leadingIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
});
