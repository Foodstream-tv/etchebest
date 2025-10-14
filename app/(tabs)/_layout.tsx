
import { HapticTab } from '@/components/HapticTab';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

const StreamIcon = ({ color }: { color: string }) => <Ionicons name="play" size={28} color={color} />;
const FavoritesIcon = ({ color }: { color: string }) => <Ionicons name="heart" size={28} color={color} />;
const HomeIcon = ({ color }: { color: string }) => <Ionicons name="home" size={28} color={color} />;
const HelpIcon = ({ color }: { color: string }) => <Ionicons name="help-circle" size={28} color={color} />;
const ProfileIcon = ({ color }: { color: string }) => <Ionicons name="person" size={28} color={color} />;

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: '#000',
				tabBarInactiveTintColor: '#888',
				headerShown: false,
				tabBarButton: HapticTab,
				tabBarStyle: {
					backgroundColor: '#fff',
					borderTopColor: '#eee',
					borderTopWidth: 1,
					height: 70,
				},
			}}>
			<Tabs.Screen
				name="stream"
				options={{
					title: 'Stream',
					tabBarIcon: StreamIcon,
				}}
			/>
			<Tabs.Screen
				name="favorites"
				options={{
					title: 'Favorites',
					tabBarIcon: FavoritesIcon,
				}}
			/>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Home',
					tabBarIcon: HomeIcon,
				}}
			/>
			<Tabs.Screen
				name="help"
				options={{
					title: 'Help',
					tabBarIcon: HelpIcon,
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: 'Profile',
					tabBarIcon: ProfileIcon,
				}}
			/>
		</Tabs>
	);
}
