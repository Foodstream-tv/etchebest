import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const [loaded] = useFonts({
		SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
	});
	if (!loaded) {
		return null;
	}

	return (
		<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
			<Stack>
				<Stack.Screen name="login" options={{ headerShown: false }} />
				<Stack.Screen name="register" options={{ headerShown: false }} />
				<Stack.Screen name="forgot-password" options={{ title: 'Mot de passe oublié' }} />
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen name="live-streaming" options={{ headerShown: false, orientation: 'portrait' }} />
				<Stack.Screen name="live-viewer" options={{ headerShown: false, orientation: 'all' }} />
				<Stack.Screen name="live-rooms" options={{ headerShown: false }} />
			</Stack>
			<StatusBar style="auto" />
		</ThemeProvider>
	);
}
