import BrandBackdrop from '@/components/BrandBackdrop';
import { brandTheme } from '@/constants/brandTheme';
import { useI18n } from '@/contexts/LanguageContext';
import { createShadowStyle } from '@/utils/shadow';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { ComponentProps, useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	Image,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService, { UpdateProfileRequest } from '../../services/api';
import { authService, StoredUser } from '../../services/auth';
import { validateEmail } from '../../utils/validation';

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

type LocaleChip = 'fr' | 'en';

type ProfileFormState = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	description: string;
};

const PRIMARY = brandTheme.colors.orange;
const MUTED = brandTheme.colors.muted;
const BORDER = brandTheme.colors.border;
const BACKGROUND = brandTheme.colors.bg;
const CARD = brandTheme.colors.surface;
const SURFACE_STRONG = brandTheme.colors.surfaceStrong;
const TEXT = brandTheme.colors.text;
const ORANGE_GRADIENT = brandTheme.gradients.primary;

const connections: Connection[] = [
	{ name: 'Google', connected: true },
	{ name: 'Twitch', connected: false },
	{ name: 'YouTube', connected: false },
	{ name: 'Twitter/X', connected: false },
];

const connectionIcons: Record<string, IoniconName> = {
	Google: 'logo-google',
	Twitch: 'logo-twitch',
	YouTube: 'logo-youtube',
	'Twitter/X': 'logo-twitter',
};

const getProfileFormFromUser = (user: StoredUser | null): ProfileFormState => ({
	firstName: user?.firstName ?? '',
	lastName: user?.lastName ?? '',
	username: user?.username ?? '',
	email: user?.email ?? '',
	description: user?.description ?? '',
});

const SectionHeader = ({ title, icon }: { title: string; icon: IoniconName }) => (
	<View style={styles.sectionHeader}>
		<Ionicons name={icon} size={18} color={PRIMARY} />
		<Text style={styles.sectionTitle}>{title}</Text>
	</View>
);

const PreferenceChip = ({
	label,
	active,
	icon,
	onPress,
}: {
	label: string;
	active?: boolean;
	icon?: IoniconName;
	onPress?: () => void;
}) => {
	const content = active ? (
		<LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.chip, styles.chipActive]}>
			{icon ? <Ionicons name={icon} size={15} color="#fff" /> : null}
			<Text style={[styles.chipText, styles.chipTextActive]}>{label}</Text>
		</LinearGradient>
	) : (
		<View style={styles.chip}>
			{icon ? <Ionicons name={icon} size={15} color={PRIMARY} /> : null}
			<Text style={styles.chipText}>{label}</Text>
		</View>
	);

	if (!onPress) {
		return content;
	}

	return (
		<TouchableOpacity activeOpacity={0.85} onPress={onPress}>
			{content}
		</TouchableOpacity>
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

const ConnectionRow = ({
	name,
	connected,
	connectedLabel,
	linkLabel,
}: Connection & { connectedLabel: string; linkLabel: string }) => (
	<View style={styles.connectionRow}>
		<View style={styles.connectionInfo}>
			<Ionicons name={connectionIcons[name] ?? 'link-outline'} size={18} color={PRIMARY} />
			<Text style={styles.connectionName}>{name}</Text>
		</View>
		<TouchableOpacity style={[styles.connectionButton, connected && styles.connectionButtonConnected]} activeOpacity={0.85}>
			{connected ? (
				<Text style={[styles.connectionButtonText, styles.connectionButtonTextConnected]}>{connectedLabel}</Text>
			) : (
				<LinearGradient
					colors={ORANGE_GRADIENT}
					start={{ x: 0, y: 0.5 }}
					end={{ x: 1, y: 0.5 }}
					style={styles.connectionGradient}>
					<Text style={styles.connectionButtonTextActive}>{linkLabel}</Text>
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

export default function ProfileScreen(): React.JSX.Element {
	const router = useRouter();
	const { locale, setLocale, t } = useI18n();
	const [user, setUser] = useState<StoredUser | null>(null);
	const [editModalVisible, setEditModalVisible] = useState(false);
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [profileForm, setProfileForm] = useState<ProfileFormState>(() => getProfileFormFromUser(null));
	const [profileFormError, setProfileFormError] = useState<string | null>(null);

	const badges: Badge[] = [
		{ title: t('profile.badges.beginner.title'), description: t('profile.badges.beginner.description'), icon: 'flame-outline' },
		{ title: t('profile.badges.curious.title'), description: t('profile.badges.curious.description'), icon: 'restaurant-outline' },
		{ title: t('profile.badges.chatKing.title'), description: t('profile.badges.chatKing.description'), icon: 'chatbubble-ellipses-outline' },
		{ title: t('profile.badges.earlyBird.title'), description: t('profile.badges.earlyBird.description'), icon: 'sunny-outline' },
		{ title: t('profile.badges.nightOwl.title'), description: t('profile.badges.nightOwl.description'), icon: 'moon-outline' },
		{ title: t('profile.badges.ambassador.title'), description: t('profile.badges.ambassador.description'), icon: 'sparkles-outline' },
	];

	const stats: Stat[] = [
		{ label: t('profile.stats.watchTime'), value: '42 h' },
		{ label: t('profile.stats.recipes'), value: '18' },
		{ label: t('profile.stats.streak'), value: t('profile.stats.streakValue') },
		{ label: t('profile.stats.followedChefs'), value: '24' },
	];

	const progress: ProgressBar[] = [
		{ label: t('profile.progress.level'), value: 68 },
		{ label: t('profile.progress.weeklyGoal'), value: 80 },
	];

	const activities: Activity[] = [
		{ text: t('profile.activity.item1') },
		{ text: t('profile.activity.item2') },
		{ text: t('profile.activity.item3') },
	];

	useEffect(() => {
		authService.getUser().then((storedUser) => {
			setUser(storedUser);
			setProfileForm(getProfileFormFromUser(storedUser));
		});
	}, []);

	const displayName = (() => {
		if (!user) return t('common.user');
		if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
		return user.username;
	})();
	const displayHandle = user ? `@${user.username}` : '@—';
	const displayBio = user?.description ?? user?.email ?? '';

	const handleOpenSettings = useCallback(() => {
		if (Platform.OS === 'web') {
			const activeElement = document.activeElement as HTMLElement | null;
			activeElement?.blur?.();
		}

		router.push('/settings');
	}, [router]);

	const handleProfileFieldChange = useCallback((field: keyof ProfileFormState, value: string) => {
		setProfileForm((prevState) => ({
			...prevState,
			[field]: value,
		}));
	}, []);

	const handleOpenEditModal = useCallback(() => {
		setProfileForm(getProfileFormFromUser(user));
		setProfileFormError(null);
		setEditModalVisible(true);
	}, [user]);

	const handleCloseEditModal = useCallback(() => {
		if (isSavingProfile) {
			return;
		}
		setEditModalVisible(false);
		setProfileFormError(null);
	}, [isSavingProfile]);

	const validateProfileForm = useCallback((): string | null => {
		const firstName = profileForm.firstName.trim();
		const lastName = profileForm.lastName.trim();
		const username = profileForm.username.trim();
		const email = profileForm.email.trim().toLowerCase();

		if (!firstName) {
			return t('profile.edit.error.firstNameRequired');
		}
		if (!lastName) {
			return t('profile.edit.error.lastNameRequired');
		}
		if (!username || username.length < 3) {
			return t('profile.edit.error.usernameMin');
		}
		if (!email) {
			return t('profile.edit.error.emailRequired');
		}

		const emailValidation = validateEmail(email);
		if (!emailValidation.isValid) {
			return emailValidation.error ?? t('profile.edit.error.emailInvalid');
		}

		return null;
	}, [profileForm, t]);

	const handleSaveProfile = useCallback(async () => {
		const validationError = validateProfileForm();
		if (validationError) {
			setProfileFormError(validationError);
			return;
		}

		const token = await authService.getToken();
		if (!token) {
			Alert.alert(t('profile.edit.alert.sessionTitle'), t('profile.edit.alert.sessionMessage'));
			return;
		}

		setIsSavingProfile(true);
		setProfileFormError(null);

		try {
			const payload: UpdateProfileRequest = {
				firstName: profileForm.firstName,
				lastName: profileForm.lastName,
				username: profileForm.username,
				email: profileForm.email,
				description: profileForm.description,
			};

			const updatedProfile = await apiService.updateProfile(token, payload);
			const updatedStoredUser: StoredUser = {
				id: updatedProfile.id,
				email: updatedProfile.email,
				username: updatedProfile.username,
				firstName: updatedProfile.firstName,
				lastName: updatedProfile.lastName,
				description: updatedProfile.description,
			};

			await authService.saveAuth(token, updatedStoredUser);
			setUser(updatedStoredUser);
			setProfileForm(getProfileFormFromUser(updatedStoredUser));
			setEditModalVisible(false);
		} catch (error) {
			setProfileFormError(error instanceof Error ? error.message : t('profile.edit.error.updateFailed'));
		} finally {
			setIsSavingProfile(false);
		}
	}, [profileForm, t, validateProfileForm]);

	const handleChangeLocale = useCallback((nextLocale: LocaleChip) => {
		setLocale(nextLocale).catch(() => {
			// no-op: keep previous locale if persistence fails
		});
	}, [setLocale]);

	return (
		<SafeAreaView edges={['top']} style={styles.safeArea}>
			<BrandBackdrop compact />
			<ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.titleRow}>
					<Text style={styles.title}>{t('profile.title')}</Text>
					<TouchableOpacity style={styles.settingsButton} activeOpacity={0.85} onPress={handleOpenSettings}>
						<LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.settingsGradient}>
							<Ionicons name="settings-outline" size={20} color="#fff" />
						</LinearGradient>
					</TouchableOpacity>
				</View>

				<View style={[styles.card, styles.profileCard]}>
					<View style={styles.avatarWrapper}>
						<Image source={require('@/assets/images/icon.png')} style={styles.avatar} />
						<View style={styles.statusDot} />
					</View>
					<View style={styles.profileDetails}>
						<Text style={styles.name}>{displayName}</Text>
						<Text style={styles.handle}>{displayHandle}</Text>
						<Text style={styles.bio}>{displayBio}</Text>
					</View>
					<TouchableOpacity style={styles.editButton} activeOpacity={0.9} onPress={handleOpenEditModal}>
						<LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.editButtonGradient}>
							<Text style={styles.editButtonText}>{t('profile.edit.button')}</Text>
						</LinearGradient>
					</TouchableOpacity>
				</View>

				<View style={[styles.card, styles.sectionCard]}>
					<SectionHeader title={t('profile.section.preferences')} icon="settings-outline" />
					<View style={styles.preferenceBlock}>
						<Text style={styles.blockTitle}>{t('profile.preferences.theme')}</Text>
						<View style={styles.chipRow}>
							<PreferenceChip label={t('profile.preferences.theme.light')} />
							<PreferenceChip label={t('profile.preferences.theme.dark')} active />
							<PreferenceChip label={t('profile.preferences.theme.system')} />
						</View>
						<Text style={styles.helperText}>{t('profile.preferences.theme.helper')}</Text>
					</View>
					<View style={styles.preferenceBlock}>
						<Text style={styles.blockTitle}>{t('profile.preferences.notifications')}</Text>
						<View style={styles.chipRow}>
							<PreferenceChip label={t('profile.preferences.notifications.lives')} active />
							<PreferenceChip label={t('profile.preferences.notifications.replays')} />
							<PreferenceChip label={t('profile.preferences.notifications.newChefs')} />
						</View>
					</View>
					<View style={styles.preferenceBlock}>
						<Text style={styles.blockTitle}>{t('profile.preferences.language')}</Text>
						<View style={styles.chipRow}>
							<PreferenceChip label={t('common.languages.fr')} active={locale === 'fr'} onPress={() => handleChangeLocale('fr')} />
							<PreferenceChip label={t('common.languages.en')} active={locale === 'en'} onPress={() => handleChangeLocale('en')} />
						</View>
					</View>
				</View>

				<View style={[styles.card, styles.sectionCard]}>
					<SectionHeader title={t('profile.section.stats')} icon="bar-chart-outline" />
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
					<SectionHeader title={t('profile.section.badges')} icon="trophy-outline" />
					<View style={styles.badgeGrid}>
						{badges.map((badge) => (
							<BadgeCard key={badge.title} {...badge} />
						))}
					</View>
				</View>

				<View style={[styles.card, styles.sectionCard]}>
					<SectionHeader title={t('profile.section.connections')} icon="link-outline" />
					{connections.map((connection) => (
						<ConnectionRow
							key={connection.name}
							{...connection}
							connectedLabel={t('common.connected')}
							linkLabel={t('common.link')}
						/>
					))}
				</View>

				<View style={[styles.card, styles.sectionCard, styles.lastCard]}>
					<SectionHeader title={t('profile.section.activity')} icon="timer-outline" />
					{activities.map((activity) => (
						<ActivityRow key={activity.text} {...activity} />
					))}
				</View>
			</ScrollView>

			<Modal
				visible={editModalVisible}
				transparent
				animationType="fade"
				onRequestClose={handleCloseEditModal}>
				<View style={styles.modalBackdrop}>
					<BlurView intensity={44} tint="dark" style={styles.modalBlur} />
					<View style={styles.modalBackdropTint} />
					<View style={styles.modalCard}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>{t('profile.edit.modalTitle')}</Text>
							<TouchableOpacity onPress={handleCloseEditModal} disabled={isSavingProfile}>
								<Ionicons name="close" size={20} color={TEXT} />
							</TouchableOpacity>
						</View>

						<View style={styles.modalBody}>
							<View style={styles.inputGroup}>
								<Text style={styles.inputLabel}>{t('profile.edit.firstName')}</Text>
								<TextInput
									value={profileForm.firstName}
									onChangeText={(value) => handleProfileFieldChange('firstName', value)}
									placeholder={t('profile.edit.placeholder.firstName')}
									placeholderTextColor={MUTED}
									style={styles.inputControl}
									autoCapitalize="words"
								/>
							</View>

							<View style={styles.inputGroup}>
								<Text style={styles.inputLabel}>{t('profile.edit.lastName')}</Text>
								<TextInput
									value={profileForm.lastName}
									onChangeText={(value) => handleProfileFieldChange('lastName', value)}
									placeholder={t('profile.edit.placeholder.lastName')}
									placeholderTextColor={MUTED}
									style={styles.inputControl}
									autoCapitalize="words"
								/>
							</View>

							<View style={styles.inputGroup}>
								<Text style={styles.inputLabel}>{t('profile.edit.username')}</Text>
								<TextInput
									value={profileForm.username}
									onChangeText={(value) => handleProfileFieldChange('username', value)}
									placeholder={t('profile.edit.placeholder.username')}
									placeholderTextColor={MUTED}
									style={styles.inputControl}
									autoCapitalize="none"
								/>
							</View>

							<View style={styles.inputGroup}>
								<Text style={styles.inputLabel}>{t('profile.edit.email')}</Text>
								<TextInput
									value={profileForm.email}
									onChangeText={(value) => handleProfileFieldChange('email', value)}
									placeholder={t('profile.edit.placeholder.email')}
									placeholderTextColor={MUTED}
									style={styles.inputControl}
									autoCapitalize="none"
									keyboardType="email-address"
								/>
							</View>

							<View style={styles.inputGroup}>
								<Text style={styles.inputLabel}>{t('profile.edit.bio')}</Text>
								<TextInput
									value={profileForm.description}
									onChangeText={(value) => handleProfileFieldChange('description', value)}
									placeholder={t('profile.edit.placeholder.bio')}
									placeholderTextColor={MUTED}
									style={[styles.inputControl, styles.inputControlMultiline]}
									multiline
									numberOfLines={3}
								/>
							</View>
						</View>

						{profileFormError ? <Text style={styles.formErrorText}>{profileFormError}</Text> : null}

						<View style={styles.modalActions}>
							<TouchableOpacity style={styles.modalSecondaryButton} onPress={handleCloseEditModal} disabled={isSavingProfile}>
								<Text style={styles.modalSecondaryButtonText}>{t('common.cancel')}</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={[styles.modalPrimaryButton, isSavingProfile && styles.modalPrimaryButtonDisabled]}
								onPress={handleSaveProfile}
								disabled={isSavingProfile}>
								<LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.modalPrimaryGradient}>
									{isSavingProfile ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalPrimaryButtonText}>{t('common.save')}</Text>}
								</LinearGradient>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
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
		color: TEXT,
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
		...createShadowStyle({
			color: '#00000015',
			offset: { width: 0, height: 4 },
			opacity: 0.08,
			radius: 8,
			elevation: 2,
		}),
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
		backgroundColor: brandTheme.colors.success,
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
		color: TEXT,
	},
	handle: {
		fontSize: 14,
		color: MUTED,
	},
	bio: {
		fontSize: 14,
		color: TEXT,
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
		color: '#fff',
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
		color: TEXT,
	},
	preferenceBlock: {
		gap: 8,
	},
	blockTitle: {
		fontSize: 14,
		fontWeight: '600',
		color: TEXT,
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
		backgroundColor: SURFACE_STRONG,
	},
	chipActive: {
		backgroundColor: 'transparent',
		borderColor: 'transparent',
	},
	chipText: {
		color: TEXT,
		fontWeight: '600',
		fontSize: 13,
	},
	chipTextActive: {
		color: '#fff',
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
		backgroundColor: SURFACE_STRONG,
	},
	statValue: {
		fontSize: 20,
		fontWeight: '700',
		color: TEXT,
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
		backgroundColor: 'rgba(255, 255, 255, 0.12)',
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
		backgroundColor: 'rgba(249, 115, 22, 0.1)',
	},
	badgeIcon: {
		width: 36,
		height: 36,
		borderRadius: 10,
		backgroundColor: 'rgba(249, 115, 22, 0.22)',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 8,
	},
	badgeTitle: {
		fontWeight: '700',
		color: TEXT,
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
		color: TEXT,
	},
	connectionButton: {
		borderRadius: 10,
		overflow: 'hidden',
	},
	connectionButtonConnected: {
		backgroundColor: 'rgba(74, 222, 128, 0.12)',
		borderColor: brandTheme.colors.success,
		borderWidth: 1,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	connectionButtonText: {
		color: PRIMARY,
		fontWeight: '700',
	},
	connectionButtonTextActive: {
		color: '#fff',
		fontWeight: '700',
	},
	connectionButtonTextConnected: {
		color: '#9BF8C2',
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
		color: TEXT,
		flex: 1,
	},
	lastCard: {
		marginBottom: 20,
	},
	modalBackdrop: {
		flex: 1,
		justifyContent: 'center',
		padding: 20,
	},
	modalBlur: {
		...StyleSheet.absoluteFillObject,
	},
	modalBackdropTint: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(13, 10, 8, 0.36)',
	},
	modalCard: {
		backgroundColor: 'rgba(12, 8, 4, 0.86)',
		borderRadius: 16,
		padding: 16,
		gap: 12,
		borderWidth: 1,
		borderColor: BORDER,
		...createShadowStyle({
			color: '#0000001C',
			offset: { width: 0, height: 8 },
			opacity: 0.14,
			radius: 16,
			elevation: 3,
		}),
	},
	modalHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: TEXT,
	},
	modalBody: {
		gap: 10,
	},
	inputGroup: {
		gap: 6,
	},
	inputLabel: {
		fontSize: 13,
		fontWeight: '600',
		color: MUTED,
	},
	inputControl: {
		borderWidth: 1,
		borderColor: BORDER,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		color: TEXT,
		backgroundColor: SURFACE_STRONG,
	},
	inputControlMultiline: {
		minHeight: 92,
		textAlignVertical: 'top',
	},
	formErrorText: {
		color: '#FCA5A5',
		fontSize: 12,
	},
	modalActions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 10,
		marginTop: 4,
	},
	modalSecondaryButton: {
		borderWidth: 1,
		borderColor: BORDER,
		borderRadius: 10,
		paddingHorizontal: 14,
		paddingVertical: 10,
		backgroundColor: SURFACE_STRONG,
	},
	modalSecondaryButtonText: {
		color: TEXT,
		fontWeight: '600',
	},
	modalPrimaryButton: {
		borderRadius: 10,
		overflow: 'hidden',
	},
	modalPrimaryButtonDisabled: {
		opacity: 0.72,
	},
	modalPrimaryGradient: {
		minWidth: 118,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	modalPrimaryButtonText: {
		color: '#fff',
		fontWeight: '700',
	},
});