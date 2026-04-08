import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { brandTheme } from '@/constants/brandTheme';

const appTheme = {
	...DarkTheme,
	colors: {
		...DarkTheme.colors,
		primary: brandTheme.colors.orange,
		background: brandTheme.colors.bg,
		card: '#100a06',
		text: brandTheme.colors.text,
		border: brandTheme.colors.border,
		notification: brandTheme.colors.orange,
	},
};

export default function RootLayout() {
	const [loaded] = useFonts({
		SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
	});
	if (!loaded) {
		return null;
	}

	return (
		<ThemeProvider value={appTheme}>
			<Stack>
				<Stack.Screen name="index" options={{ headerShown: false }} />
				<Stack.Screen name="login" options={{ headerShown: false }} />
				<Stack.Screen name="register" options={{ headerShown: false }} />
				<Stack.Screen name="forgot-password" options={{ headerShown: false }} />
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen name="live-streaming" options={{ headerShown: false, orientation: 'portrait' }} />
				<Stack.Screen name="live-viewer" options={{ headerShown: false, orientation: 'all' }} />
				<Stack.Screen name="live-rooms" options={{ headerShown: false }} />
			</Stack>
			<StatusBar style="light" />
		</ThemeProvider>
	);
}
