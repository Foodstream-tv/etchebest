
import { HapticTab } from '@/components/HapticTab';
import { brandTheme } from '@/constants/brandTheme';
import { LanguageProvider, useI18n } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const HomeIcon = ({ color }: { color: string }) => <Ionicons name="home-outline" size={28} color={color} />;
const DiscoverIcon = ({ color }: { color: string }) => <Ionicons name="compass-outline" size={28} color={color} />;
const ORANGE_GRADIENT = brandTheme.gradients.primary;
const AddIcon = ({ color }: { color: string }) => {
	const isActive = color === brandTheme.colors.orange;

	if (!isActive) {
		return (
			<View style={styles.addButton}>
				<Ionicons name="add" size={24} color={brandTheme.colors.muted} />
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
		<LanguageProvider>
			<TabLayoutContent />
		</LanguageProvider>
	);
}

function TabLayoutContent() {
	const { t } = useI18n();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: brandTheme.colors.orange,
				tabBarInactiveTintColor: brandTheme.colors.muted,
				headerShown: false,
				tabBarButton: HapticTab,
				tabBarStyle: {
					backgroundColor: '#120c08',
					borderTopColor: brandTheme.colors.border,
					borderTopWidth: 1,
					height: 70,
				},
			}}>
			<Tabs.Screen
				name="index"
				options={{
					title: t('tabs.home'),
					tabBarIcon: HomeIcon,
				}}
			/>
			<Tabs.Screen
				name="discover"
				options={{
					title: t('tabs.discover'),
					tabBarIcon: DiscoverIcon,
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
					title: t('tabs.favorites'),
					tabBarIcon: FavorisIcon,
				}}
			/>
			<Tabs.Screen
				name="profil"
				options={{
					title: t('tabs.profile'),
					tabBarIcon: ProfilIcon,
				}}
			/>
		</Tabs>
	);
}

const styles = StyleSheet.create({
	addButton: {
		backgroundColor: brandTheme.colors.surfaceStrong,
		borderWidth: 1,
		borderColor: brandTheme.colors.border,
		borderRadius: 20,
		width: 56,
		height: 40,
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: 8,
	},
	addButtonActive: {
		borderWidth: 0,
		boxShadow: '0px 6px 24px rgba(249, 115, 22, 0.3)',
		elevation: 3,
	},
});
