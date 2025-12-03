import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { ComponentProps } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type Badge = {
	title: string;
	description: string;
	icon: IoniconName;
};

type Stat = {
	label: string;
	value: string;
	helper?: string;
};

type ProgressBar = {
	label: string;
	value: number;
	highlight?: string;
};

type Connection = {
	name: string;
	connected: boolean;
};

type Activity = {
	text: string;
};

const PRIMARY = '#FF7A00';
const MUTED = '#7B8294';
const BORDER = '#E7E7EC';
const BACKGROUND = '#F8F8FB';
const CARD = '#FFFFFF';
const ORANGE_GRADIENT = ['#FFA92E', '#FF5D1E'] as const;

const badges: Badge[] = [
	{ title: 'Chef Débutant', description: '5 lives suivis', icon: 'flame-outline' },
	{ title: 'Gourmet Curieux', description: '10 recettes sauvegardées', icon: 'restaurant-outline' },
	{ title: 'Roi du Chat', description: '100 messages envoyés', icon: 'chatbubble-ellipses-outline' },
	{ title: 'Matinal', description: '3 lives à 8h', icon: 'sunny-outline' },
	{ title: 'Noctambule', description: '3 lives après minuit', icon: 'moon-outline' },
	{ title: 'Ambassadeur', description: '5 parrainages', icon: 'sparkles-outline' },
];

const stats: Stat[] = [
	{ label: 'Temps de visionnage', value: '42 h' },
	{ label: 'Recettes cuisinées', value: '18' },
	{ label: 'Streak', value: '7 jours' },
	{ label: 'Chefs suivis', value: '24' },
];

const progress: ProgressBar[] = [
	{ label: 'Niveau de Chef', value: 68 },
	{ label: 'Objectif hebdo (5h)', value: 80 },
];

const connections: Connection[] = [
	{ name: 'Google', connected: true },
	{ name: 'Twitch', connected: false },
	{ name: 'YouTube', connected: false },
	{ name: 'Twitter/X', connected: false },
];

const activities: Activity[] = [
	{ text: 'A rejoint "Ramen Tonkotsu Ultimes"' },
	{ text: 'A sauvegardé "Bao buns ultra moelleux"' },
	{ text: 'A suivi le chef "Camille Dupont"' },
];

const connectionIcons: Record<string, IoniconName> = {
	Google: 'logo-google',
	Twitch: 'logo-twitch',
	YouTube: 'logo-youtube',
	'Twitter/X': 'logo-twitter',
};

const SectionHeader = ({ title, icon }: { title: string; icon: IoniconName }) => (
	<View style={styles.sectionHeader}>
		<Ionicons name={icon} size={18} color={PRIMARY} />
		<Text style={styles.sectionTitle}>{title}</Text>
	</View>
);

const PreferenceChip = ({ label, active, icon }: { label: string; active?: boolean; icon?: IoniconName }) => {
	if (active) {
		return (			
			<LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.chip, styles.chipActive]}>
				{icon ? <Ionicons name={icon} size={14} color={CARD} /> : null}
				<Text style={[styles.chipText, styles.chipTextActive]}>{label}</Text>
			</LinearGradient>
		);
	}
	return (
		<View style={styles.chip}>
			{icon ? <Ionicons name={icon} size={14} color={PRIMARY} /> : null}
			<Text style={styles.chipText}>{label}</Text>
		</View>
	);
};

const StatTile = ({ value, label, helper }: Stat) => (
	<View style={styles.statTile}>
		<Text style={styles.statValue}>{value}</Text>
		<Text style={styles.statLabel}>{label}</Text>
		{helper ? <Text style={styles.helperText}>{helper}</Text> : null}
	</View>
);

const BadgeCard = ({ title, description, icon }: Badge) => (
	<View style={styles.badgeCard}>
		<View style={styles.badgeIcon}>
			<Ionicons name={icon} size={18} color={PRIMARY} />
		</View>
		<Text style={styles.badgeTitle}>{title}</Text>
		<Text style={styles.badgeDescription}>{description}</Text>
	</View>
);

const ConnectionRow = ({ name, connected }: Connection) => (
	<View style={styles.connectionRow}>
		<View style={styles.connectionInfo}>
			<Ionicons name={connectionIcons[name] ?? 'link-outline'} size={18} color={PRIMARY} />
			<Text style={styles.connectionName}>{name}</Text>
		</View>
		<TouchableOpacity style={[styles.connectionButton, connected && styles.connectionButtonConnected]} activeOpacity={0.85}>
			{connected ? (
				<Text style={[styles.connectionButtonText, styles.connectionButtonTextConnected]}>Connecté</Text>
			) : (
				<LinearGradient
					colors={ORANGE_GRADIENT}
					start={{ x: 0, y: 0.5 }}
					end={{ x: 1, y: 0.5 }}
					style={styles.connectionGradient}>
					<Text style={styles.connectionButtonTextActive}>Lier</Text>
				</LinearGradient>
			)}
		</TouchableOpacity>
	</View>
);

const ActivityRow = ({ text }: Activity) => (
	<View style={styles.activityRow}>
		<Ionicons name="time-outline" size={16} color={PRIMARY} />
		<Text style={styles.activityText}>{text}</Text>
	</View>
);

export default function ProfileScreen(): JSX.Element {
	const router = useRouter();

	return (
		<SafeAreaView edges={['top']} style={styles.safeArea}>
			<ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.titleRow}>
					<Text style={styles.title}>Profil</Text>
					<TouchableOpacity style={styles.settingsButton} activeOpacity={0.85} onPress={() => router.push('/settings')}>
						<LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.settingsGradient}>
							<Ionicons name="settings-outline" size={18} color={CARD} />
						</LinearGradient>
					</TouchableOpacity>
				</View>

					<View style={[styles.card, styles.profileCard]}>
						<View style={styles.avatarWrapper}>
							<Image source={require('@/assets/images/icon.png')} style={styles.avatar} />
							<View style={styles.statusDot} />
						</View>
						<View style={styles.profileDetails}>
							<Text style={styles.name}>Nicolas Loiseau</Text>
							<Text style={styles.handle}>@nicolas • Paris, FR</Text>
							<Text style={styles.bio}>Toujours partant pour un live ramen ou pizza.</Text>
							<View style={styles.pillRow}>
								<PreferenceChip label="Live" icon="radio-outline" active />
								<PreferenceChip label="FR" />
								<PreferenceChip label="EN" />
							</View>
						</View>
						<TouchableOpacity style={styles.editButton} activeOpacity={0.9}>
							<LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.editButtonGradient}>
								<Text style={styles.editButtonText}>Modifier</Text>
							</LinearGradient>
						</TouchableOpacity>
					</View>

					<View style={[styles.card, styles.sectionCard]}>
						<SectionHeader title="Préférences" icon="settings-outline" />
						<View style={styles.preferenceBlock}>
							<Text style={styles.blockTitle}>Thème</Text>
							<View style={styles.chipRow}>
								<PreferenceChip label="Clair" />
								<PreferenceChip label="Sombre" active />
								<PreferenceChip label="Système" />
							</View>
							<Text style={styles.helperText}>Switch pour essayer le mode sombre</Text>
						</View>
						<View style={styles.preferenceBlock}>
							<Text style={styles.blockTitle}>Notifications</Text>
							<View style={styles.chipRow}>
								<PreferenceChip label="Lives" active />
								<PreferenceChip label="Replays" />
								<PreferenceChip label="Nouveaux chefs" />
							</View>
						</View>
						<View style={styles.preferenceBlock}>
							<Text style={styles.blockTitle}>Langue</Text>
							<View style={styles.chipRow}>
								<PreferenceChip label="FR" active />
								<PreferenceChip label="EN" />
							</View>
						</View>
					</View>

					<View style={[styles.card, styles.sectionCard]}>
						<SectionHeader title="Statistiques" icon="bar-chart-outline" />
						<View style={styles.statGrid}>
							{stats.map((stat) => (
								<StatTile key={stat.label} {...stat} />
							))}
						</View>
					<View style={styles.progressList}>
						{progress.map((item) => (
							<View key={item.label} style={styles.progressItem}>
								<View style={styles.progressHeader}>
									<Text style={styles.blockTitle}>{item.label}</Text>
									<Text style={styles.helperText}>{item.value}%</Text>
								</View>
								<View style={styles.progressTrack}>
									<LinearGradient
										colors={ORANGE_GRADIENT}
										start={{ x: 0, y: 0.5 }}
										end={{ x: 1, y: 0.5 }}
										style={[styles.progressFill, { width: `${item.value}%` }]}
									/>
								</View>
							</View>
						))}
					</View>
				</View>

					<View style={[styles.card, styles.sectionCard]}>
						<SectionHeader title="Médailles & Badges" icon="trophy-outline" />
						<View style={styles.badgeGrid}>
							{badges.map((badge) => (
								<BadgeCard key={badge.title} {...badge} />
							))}
						</View>
					</View>

					<View style={[styles.card, styles.sectionCard]}>
						<SectionHeader title="Comptes connectés" icon="link-outline" />
						{connections.map((connection) => (
							<ConnectionRow key={connection.name} {...connection} />
						))}
					</View>

					<View style={[styles.card, styles.sectionCard, styles.lastCard]}>
						<SectionHeader title="Activité récente" icon="timer-outline" />
						{activities.map((activity) => (
							<ActivityRow key={activity.text} {...activity} />
						))}
					</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: BACKGROUND,
	},
	container: {
		flex: 1,
	},
	content: {
		padding: 18,
		gap: 16,
	},
	breadcrumb: {
		color: MUTED,
		fontSize: 12,
	},
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: '#1F2430',
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	settingsButton: {
		borderRadius: 12,
		overflow: 'hidden',
	},
	settingsGradient: {
		padding: 10,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	card: {
		backgroundColor: CARD,
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: BORDER,
		shadowColor: '#00000015',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.08,
		shadowRadius: 8,
		elevation: 2,
	},
	profileCard: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	avatarWrapper: {
		width: 72,
		height: 72,
		borderRadius: 18,
		overflow: 'hidden',
		position: 'relative',
	},
	avatar: {
		width: '100%',
		height: '100%',
		borderRadius: 18,
	},
	statusDot: {
		width: 14,
		height: 14,
		borderRadius: 7,
		backgroundColor: '#3DC575',
		borderWidth: 2,
		borderColor: CARD,
		position: 'absolute',
		right: 6,
		bottom: 6,
	},
	profileDetails: {
		flex: 1,
		gap: 6,
	},
	name: {
		fontSize: 18,
		fontWeight: '700',
		color: '#1F2430',
	},
	handle: {
		fontSize: 14,
		color: MUTED,
	},
	bio: {
		fontSize: 14,
		color: '#2C3240',
	},
	pillRow: {
		flexDirection: 'row',
		gap: 8,
		flexWrap: 'wrap',
	},
	editButton: {
		borderRadius: 12,
		overflow: 'hidden',
	},
	editButtonGradient: {
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderRadius: 12,
		alignItems: 'center',
	},
	editButtonText: {
		color: CARD,
		fontWeight: '700',
	},
	sectionCard: {
		gap: 12,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#1F2430',
	},
	preferenceBlock: {
		gap: 8,
	},
	blockTitle: {
		fontSize: 14,
		fontWeight: '600',
		color: '#1F2430',
	},
	chipRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	chip: {
		borderWidth: 1,
		borderColor: BORDER,
		borderRadius: 10,
		paddingHorizontal: 10,
		paddingVertical: 6,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: '#F3F4F6',
	},
	chipActive: {
		backgroundColor: 'transparent',
		borderColor: 'transparent',
	},
	chipText: {
		color: '#1F2430',
		fontWeight: '600',
		fontSize: 13,
	},
	chipTextActive: {
		color: CARD,
	},
	helperText: {
		color: MUTED,
		fontSize: 12,
	},
	preferenceFooter: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		flexWrap: 'wrap',
		gap: 12,
	},
	preferenceColumn: {
		flex: 1,
		minWidth: '45%',
	},
	confidentiality: {
		flex: 1,
	},
	statGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
	},
	statTile: {
		borderWidth: 1,
		borderColor: BORDER,
		borderRadius: 12,
		padding: 12,
		flex: 1,
		minWidth: '45%',
		backgroundColor: '#FDFDFE',
	},
	statValue: {
		fontSize: 20,
		fontWeight: '700',
		color: '#1F2430',
	},
	statLabel: {
		fontSize: 13,
		color: MUTED,
		marginTop: 2,
	},
	progressList: {
		gap: 10,
	},
	progressItem: {
		gap: 6,
	},
	progressHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	progressTrack: {
		height: 10,
		backgroundColor: '#EEF0F3',
		borderRadius: 8,
		overflow: 'hidden',
	},
	progressFill: {
		height: '100%',
		borderRadius: 8,
	},
	badgeGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
	},
	badgeCard: {
		borderWidth: 1,
		borderColor: BORDER,
		borderRadius: 12,
		padding: 12,
		width: '48%',
		backgroundColor: '#FFFAF5',
	},
	badgeIcon: {
		width: 36,
		height: 36,
		borderRadius: 10,
		backgroundColor: '#FFE7D3',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 8,
	},
	badgeTitle: {
		fontWeight: '700',
		color: '#1F2430',
	},
	badgeDescription: {
		color: MUTED,
		fontSize: 12,
		marginTop: 2,
	},
	connectionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderWidth: 1,
		borderColor: BORDER,
		borderRadius: 12,
		padding: 12,
		marginBottom: 8,
	},
	connectionInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	connectionName: {
		fontWeight: '700',
		color: '#1F2430',
	},
	connectionButton: {
		borderRadius: 10,
		overflow: 'hidden',
	},
	connectionButtonConnected: {
		backgroundColor: '#E8FAF0',
		borderColor: '#3DC575',
		borderWidth: 1,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	connectionButtonText: {
		color: PRIMARY,
		fontWeight: '700',
	},
	connectionButtonTextActive: {
		color: CARD,
		fontWeight: '700',
	},
	connectionButtonTextConnected: {
		color: '#1F7A4E',
	},
	connectionGradient: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
		alignItems: 'center',
	},
	activityRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		borderWidth: 1,
		borderColor: BORDER,
		borderRadius: 12,
		padding: 12,
		marginBottom: 8,
	},
	activityText: {
		color: '#1F2430',
		flex: 1,
	},
	lastCard: {
		marginBottom: 20,
	},
});
