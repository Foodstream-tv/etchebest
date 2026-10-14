import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, TextInput, View, ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/LanguageContext';

type SearchBarProps = {
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    onSubmit?: () => void;
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

/** Web hero/nav search field: rounded-2xl, search icon, clear button. */
export default function SearchBar({ value, onChangeText, placeholder, onSubmit, style, testID }: Readonly<SearchBarProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();

    return (
        <View style={[styles.wrap, style]}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
                testID={testID}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                accessibilityLabel={placeholder}
                placeholderTextColor={colors.placeholder}
                returnKeyType="search"
                onSubmitEditing={onSubmit}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={colors.orange}
                style={styles.input}
            />
            {value.length > 0 ? (
                <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                    <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 52,
        paddingHorizontal: 16,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
        paddingVertical: 12,
    },
}));
