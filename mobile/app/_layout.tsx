import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import ToastManager from 'toastify-react-native';

import SessionGuard from '@/components/SessionGuard';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

function ThemedStack() {
	const { scheme, colors, ready } = useTheme();

	const navigationTheme = React.useMemo(() => {
		const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
		return {
			...base,
			colors: {
				...base.colors,
				primary: colors.orange,
				background: colors.bg,
				card: colors.cardSolid,
				text: colors.text,
				border: colors.border,
				notification: colors.orange,
			},
		};
	}, [scheme, colors]);

	// Wait for the stored theme so the app never flashes the wrong palette.
	if (!ready) {
		return null;
	}

	return (
		<NavigationThemeProvider value={navigationTheme}>
			<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
				<Stack.Screen name="index" />
				<Stack.Screen name="login" />
				<Stack.Screen name="register" />
				<Stack.Screen name="verify" />
				<Stack.Screen name="forgot-password" />
				<Stack.Screen name="(tabs)" />
				<Stack.Screen name="live-streaming" options={{ orientation: 'portrait' }} />
				<Stack.Screen name="live-viewer" options={{ orientation: 'all' }} />
				<Stack.Screen name="profile/[id]" />
				<Stack.Screen name="search" />
				<Stack.Screen name="settings" />
			</Stack>
			<StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
			<SessionGuard />
			<ToastManager />
		</NavigationThemeProvider>
	);
}

export default function RootLayout() {
	return (
		<ThemeProvider>
			<LanguageProvider>
				<ThemedStack />
			</LanguageProvider>
		</ThemeProvider>
	);
}
