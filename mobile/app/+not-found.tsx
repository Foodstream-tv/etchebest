import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import BrandBackdrop from '@/components/BrandBackdrop';
import { brandTheme } from '@/constants/brandTheme';

export default function NotFoundScreen() {
	return (
		<>
			<Stack.Screen options={{ title: 'Oops!' }} />
			<View style={styles.container}>
				<BrandBackdrop compact />
				<Text style={styles.title}>Page introuvable</Text>
				<Text style={styles.description}>Le contenu que vous cherchez n&apos;existe pas ou a été déplacé.</Text>
				<Link href="/" style={styles.link}>Retour à l&apos;accueil</Link>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: brandTheme.colors.bg,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
	},
	title: {
		fontSize: 28,
		fontWeight: '800',
		color: brandTheme.colors.text,
		marginBottom: 10,
	},
	description: {
		fontSize: 15,
		lineHeight: 22,
		color: brandTheme.colors.muted,
		textAlign: 'center',
		maxWidth: 320,
	},
	link: {
		marginTop: 20,
		fontSize: 16,
		fontWeight: '700',
		color: brandTheme.colors.orange,
		textDecorationLine: 'underline',
	},
});
