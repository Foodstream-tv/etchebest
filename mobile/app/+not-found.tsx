import { Link, Stack } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import Screen from '@/components/ui/Screen';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';

export default function NotFoundScreen() {
	const styles = useStyles();
	const { t } = useI18n();

	return (
		<Screen>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.container}>
				<Text style={styles.title} accessibilityRole="header">
					{t('common.notFoundTitle')}
				</Text>
				<Text style={styles.description}>{t('common.notFoundDescription')}</Text>
				<Link href="/" style={styles.link} accessibilityRole="link">
					{t('common.backHome')}
				</Link>
			</View>
		</Screen>
	);
}

const useStyles = makeStyles(({ colors }) => ({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
		gap: 12,
	},
	title: {
		color: colors.text,
		fontSize: 26,
		fontWeight: '700',
		textAlign: 'center',
	},
	description: {
		color: colors.muted,
		fontSize: 15,
		lineHeight: 22,
		textAlign: 'center',
	},
	link: {
		color: colors.orange,
		fontSize: 16,
		fontWeight: '700',
		paddingVertical: 12,
	},
}));
