import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import BrandBackdrop from '@/components/BrandBackdrop';
import { brandTheme } from '@/constants/brandTheme';
import { authService } from '../services/auth';

export default function Index() {
    const [checking, setChecking] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        authService.isAuthenticated().then((isAuth) => {
            setAuthenticated(isAuth);
            setChecking(false);
        });
    }, []);

    if (checking) {
        return (
            <View style={styles.loadingContainer}>
                <BrandBackdrop compact />
                <ActivityIndicator size="large" color={brandTheme.colors.orange} />
            </View>
        );
    }

    return <Redirect href={(authenticated ? '/(tabs)' : '/login') as any} />;
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: brandTheme.colors.bg,
    },
});
