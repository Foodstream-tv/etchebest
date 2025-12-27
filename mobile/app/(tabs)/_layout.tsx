
import { HapticTab } from '@/components/HapticTab';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const HomeIcon = ({ color }: { color: string }) => <Ionicons name="home-outline" size={28} color={color} />;
const PlatsIcon = ({ color }: { color: string }) => <Ionicons name="restaurant-outline" size={28} color={color} />;
const ORANGE_GRADIENT = ['#FFA92E', '#FF5D1E'] as const;
const AddIcon = ({ color }: { color: string }) => {
	const isActive = color === '#FF8A00';

	if (!isActive) {
		return (
			<View style={styles.addButton}>
				<Ionicons name="add" size={24} color="#666" />
			</View>
		);
	}

	return (
		<LinearGradient
			colors={ORANGE_GRADIENT}
			start={{ x: 0, y: 0.5 }}
			end={{ x: 1, y: 0.5 }}
			style={[styles.addButton, styles.addButtonActive]}
		>
			<Ionicons name="add" size={24} color="#fff" />
		</LinearGradient>
	);
};
const FavorisIcon = ({ color }: { color: string }) => <Ionicons name="heart-outline" size={28} color={color} />;
const ProfilIcon = ({ color }: { color: string }) => <Ionicons name="person-outline" size={28} color={color} />;

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: '#FF8A00',
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
				name="index"
				options={{
					title: 'Home',
					tabBarIcon: HomeIcon,
				}}
			/>
			<Tabs.Screen
				name="plats"
				options={{
					title: 'Plats',
					tabBarIcon: PlatsIcon,
				}}
			/>
			<Tabs.Screen
				name="add"
				options={{
					title: '',
					tabBarIcon: AddIcon,
				}}
			/>
			<Tabs.Screen
				name="favoris"
				options={{
					title: 'Favoris',
					tabBarIcon: FavorisIcon,
				}}
			/>
			<Tabs.Screen
				name="profil"
				options={{
					title: 'Profil',
					tabBarIcon: ProfilIcon,
				}}
			/>
		</Tabs>
	);
}

const styles = StyleSheet.create({
	addButton: {
		backgroundColor: '#e8e8e8',
		borderRadius: 20,
		width: 56,
		height: 40,
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: 8,
	},
	addButtonActive: {
		borderWidth: 0,
		shadowColor: '#FF7A00',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 6,
		elevation: 3,
	},
});
