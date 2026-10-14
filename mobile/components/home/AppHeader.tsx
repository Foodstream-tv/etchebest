import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import Avatar from '@/components/ui/Avatar';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import authService, { StoredUser } from '@/services/auth';

/**
 * Top bar of the tab screens: logo + gradient wordmark (web `AppTopNav`), search shortcut,
 * profile avatar. Search opens the dedicated `/search` screen (the web's inline dropdown).
 */
export default function AppHeader() {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();
    const router = useRouter();
    const [user, setUser] = useState<StoredUser | null>(null);

    useEffect(() => {
        let active = true;
        authService
            .getUser()
            .then((stored) => {
                if (active) setUser(stored);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    return (
        <View style={styles.row}>
            <View style={styles.brand} accessibilityRole="header">
                <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
                <Text style={styles.wordmark}>Foodstream</Text>
            </View>
            <View style={styles.actions}>
                <Pressable
                    onPress={() => router.push('/search' as never)}
                    style={styles.iconButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('search.openAria')}
                    testID="header-search"
                >
                    <Ionicons name="search" size={20} color={colors.text} />
                </Pressable>
                <Pressable
                    onPress={() => router.push('/(tabs)/profil' as never)}
                    accessibilityRole="button"
                    accessibilityLabel={t('nav.openProfileAria')}
                    testID="header-profile"
                >
                    <Avatar uri={user?.profileImageUrl} name={user?.username || user?.email} size={40} />
                </Pressable>
            </View>
        </View>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
    },
    brand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    logo: {
        width: 36,
        height: 36,
        borderRadius: 10,
    },
    wordmark: {
        color: colors.orange,
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceStrong,
        borderWidth: 1,
        borderColor: colors.border,
    },
}));
