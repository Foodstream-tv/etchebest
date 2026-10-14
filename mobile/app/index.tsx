import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import Screen from '@/components/ui/Screen';
import { useTheme } from '@/contexts/ThemeContext';
import { authService } from '../services/auth';

/** Entry point: signed in -> tabs, otherwise login. */
export default function Index() {
    const { colors } = useTheme();
    const [state, setState] = useState<'checking' | 'authenticated' | 'anonymous'>('checking');

    useEffect(() => {
        let active = true;
        authService
            .isAuthenticated()
            .then((isAuth) => {
                if (active) setState(isAuth ? 'authenticated' : 'anonymous');
            })
            // Secure storage unreadable (keychain locked…): treat as signed out instead of spinning forever.
            .catch(() => {
                if (active) setState('anonymous');
            });
        return () => {
            active = false;
        };
    }, []);

    if (state === 'checking') {
        return (
            <Screen plain edges={[]} testID="index-loading">
                <ActivityIndicator size="large" color={colors.orange} style={{ flex: 1 }} />
            </Screen>
        );
    }

    return <Redirect href={(state === 'authenticated' ? '/(tabs)' : '/login') as never} />;
}
