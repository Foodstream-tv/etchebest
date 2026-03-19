import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
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
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color="#FF7A00" />
            </View>
        );
    }

    return <Redirect href={authenticated ? '/(tabs)' : '/login'} />;
}
