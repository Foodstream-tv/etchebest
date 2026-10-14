import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { brandGradient } from '@/constants/theme';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcon = (outline: IconName, filled: IconName) =>
	function TabIcon({ color, focused }: Readonly<{ color: string; focused: boolean }>) {
		return <Ionicons name={focused ? filled : outline} size={26} color={color} />;
	};

const HomeIcon = tabIcon('home-outline', 'home');
const LivesIcon = tabIcon('radio-outline', 'radio');
const ReplaysIcon = tabIcon('play-circle-outline', 'play-circle');
const ProfileIcon = tabIcon('person-outline', 'person');

/** Center "Studio" button: brand gradient when focused, like the web CTA. */
function StudioIcon({ focused }: Readonly<{ focused: boolean }>) {
	const styles = useStyles();
	const { colors } = useTheme();

	if (!focused) {
		return (
			<View style={styles.studioButton}>
				<Ionicons name="videocam-outline" size={20} color={colors.muted} />
			</View>
		);
	}

	return (
		<LinearGradient colors={brandGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.studioButton, styles.studioButtonActive]}>
			<Ionicons name="videocam" size={20} color="#fff" />
		</LinearGradient>
	);
}

export default function TabLayout() {
	const { t } = useI18n();
	const { colors } = useTheme();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: colors.orange,
				tabBarInactiveTintColor: colors.muted,
				headerShown: false,
				tabBarButton: HapticTab,
				tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
				tabBarStyle: {
					backgroundColor: colors.tabBar,
					borderTopColor: colors.border,
					borderTopWidth: StyleSheet.hairlineWidth,
				},
			}}>
			<Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarIcon: HomeIcon }} />
			<Tabs.Screen name="lives" options={{ title: t('nav.lives'), tabBarIcon: LivesIcon }} />
			<Tabs.Screen
				name="studio"
				options={{
					title: t('nav.studio'),
					tabBarIcon: StudioIcon,
					tabBarAccessibilityLabel: t('nav.studio'),
				}}
			/>
			<Tabs.Screen name="replays" options={{ title: t('nav.replays'), tabBarIcon: ReplaysIcon }} />
			<Tabs.Screen name="profil" options={{ title: t('nav.profile'), tabBarIcon: ProfileIcon }} />
		</Tabs>
	);
}

const useStyles = makeStyles(({ colors }) => ({
	studioButton: {
		backgroundColor: colors.surfaceStrong,
		borderWidth: 1,
		borderColor: colors.border,
		// Same vertical footprint as the 26pt icons of the other tabs, so it never overlaps the label.
		borderRadius: 14,
		width: 44,
		height: 28,
		justifyContent: 'center',
		alignItems: 'center',
	},
	studioButtonActive: {
		borderWidth: 0,
		boxShadow: `0px 3px 10px ${colors.orangeGlow}`,
		elevation: 2,
	},
}));
