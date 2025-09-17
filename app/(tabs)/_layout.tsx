import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout()
{
	const colorScheme = useColorScheme();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
				headerShown: false,
				tabBarButton: HapticTab,
				tabBarBackground: TabBarBackground,
				tabBarStyle: Platform.select({
					ios: {
						position: 'absolute',
					},
					default: {},
				}),
			}}>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Home',
					tabBarIcon: ({ color }) => <Ionicons name="home" size={28} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="favorites"
				options={{
					title: 'Favorites',
					tabBarIcon: ({ color }) => <Ionicons name="heart" size={28} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="help"
				options={{
					title: 'Help',
					tabBarIcon: ({ color }) => <Ionicons name="help-circle" size={28} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: 'Profile',
					tabBarIcon: ({ color }) => <Ionicons name="person" size={28} color={color} />,
				}}
			/>

		</Tabs>
	);
}
