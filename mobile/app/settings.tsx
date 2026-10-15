import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import ChangePasswordSheet from '@/components/profile/ChangePasswordSheet';
import DeleteAccountSheet from '@/components/profile/DeleteAccountSheet';
import { displayNameOf } from '@/components/profile/profileUtils';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Screen from '@/components/ui/Screen';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { WEB_BASE_URL } from '@/lib/calendar';
import apiService from '@/services/api';
import authService from '@/services/auth';
import { ApiError } from '@/services/http';
import preferencesService, { NotificationChannel, NotificationPreferences } from '@/services/preferences';
import { shareMyData } from '@/utils/exportData';
import toast from '@/utils/toast';

const REGIONS = {
	France: { timezone: '(GMT+1) Europe / Paris', labelKey: 'settings.appearance.regionFrance' },
	'United Kingdom': { timezone: '(GMT+0) Europe / London', labelKey: 'settings.appearance.regionUk' },
} as const;

type Region = keyof typeof REGIONS;

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
	global: true,
	lives: true,
	reminders: true,
	promotions: false,
	channel: 'site',
};

type AccountInfo = {
	name: string;
	username: string;
	email: string;
};

function Section({ title, subtitle, children }: Readonly<React.PropsWithChildren<{ title: string; subtitle?: string }>>) {
	const styles = useStyles();
	return (
		<Card style={styles.section}>
			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle} accessibilityRole="header">
					{title}
				</Text>
				{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
			</View>
			{children}
		</Card>
	);
}

function InfoRow({ label, value }: Readonly<{ label: string; value: string }>) {
	const styles = useStyles();
	return (
		<View style={styles.infoRow} accessible accessibilityLabel={`${label}: ${value}`}>
			<Text style={styles.infoLabel}>{label}</Text>
			<Text style={styles.infoValue} numberOfLines={1}>
				{value}
			</Text>
		</View>
	);
}

function ToggleRow({
	label,
	description,
	value,
	onValueChange,
	disabled,
	testID,
}: Readonly<{ label: string; description?: string; value: boolean; onValueChange: (next: boolean) => void; disabled?: boolean; testID?: string }>) {
	const styles = useStyles();
	const { colors } = useTheme();
	return (
		<View style={styles.toggleRow}>
			<View style={styles.toggleTexts}>
				<Text style={styles.rowLabel}>{label}</Text>
				{description ? <Text style={styles.rowDescription}>{description}</Text> : null}
			</View>
			<Switch
				value={value}
				onValueChange={onValueChange}
				disabled={disabled}
				accessibilityRole="switch"
				accessibilityLabel={label}
				accessibilityState={{ checked: value, disabled }}
				trackColor={{ false: colors.surfaceStrong, true: colors.orange }}
				thumbColor="#ffffff"
				testID={testID}
			/>
		</View>
	);
}

export default function SettingsScreen(): React.JSX.Element {
	const router = useRouter();
	const styles = useStyles();
	const { colors, preference, setPreference } = useTheme();
	const { t, locale, setLocale } = useI18n();

	const [account, setAccount] = useState<AccountInfo | null>(null);
	const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);
	const [region, setRegion] = useState<Region>('France');
	const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
	const [prefsLoaded, setPrefsLoaded] = useState(false);
	const [passwordOpen, setPasswordOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [signingOut, setSigningOut] = useState(false);
	const [exporting, setExporting] = useState(false);

	const mounted = useRef(true);
	const deleteInFlight = useRef(false);
	const exportInFlight = useRef(false);
	const notificationsRef = useRef(notifications);
	notificationsRef.current = notifications;

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	// Account info: stored user first (instant), then the fresh profile.
	useEffect(() => {
		let active = true;
		const toInfo = (user: { firstName?: string; lastName?: string; username?: string; email?: string } | null): AccountInfo | null =>
			user ? { name: displayNameOf(user), username: user.username ?? '', email: user.email ?? '' } : null;

		(async () => {
			try {
				const stored = await authService.getUser();
				if (active && stored) setAccount(toInfo(stored));
			} catch {
				// ignore: the fresh profile below may still succeed
			}
			try {
				const profile = await apiService.getProfile();
				if (!active) return;
				setAccount(toInfo(profile));
				setPasswordUpdatedAt(profile.passwordUpdatedAt ?? null);
			} catch {
				// A 401 / ban already signs the user out through SessionGuard; keep the stored data otherwise.
			}
		})();

		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		let active = true;
		preferencesService
			.getPreferences()
			.then((prefs) => {
				if (!active) return;
				setRegion(prefs.region in REGIONS ? (prefs.region as Region) : 'France');
				setNotifications(prefs.notifications);
			})
			.catch(() => {
				// keep defaults
			})
			.finally(() => {
				if (active) setPrefsLoaded(true);
			});
		return () => {
			active = false;
		};
	}, []);

	const updateNotifications = useCallback(
		async (patch: Partial<NotificationPreferences>) => {
			const keys = Object.keys(patch) as (keyof NotificationPreferences)[];
			const previous = Object.fromEntries(keys.map((key) => [key, notificationsRef.current[key]])) as Partial<NotificationPreferences>;
			setNotifications((prev) => ({ ...prev, ...patch }) as NotificationPreferences);
			try {
				// The service merges partial notification patches (its parameter type is stricter than its behavior).
				await preferencesService.setPreferences({ notifications: patch } as Parameters<typeof preferencesService.setPreferences>[0]);
			} catch {
				if (mounted.current) {
					setNotifications((prev) => ({ ...prev, ...previous }) as NotificationPreferences);
					toast.error(t('common.errorGeneric'), { force: true });
				}
			}
		},
		[t]
	);

	const selectRegion = useCallback(
		async (next: Region) => {
			const previous = region;
			setRegion(next);
			try {
				await preferencesService.setPreferences({ region: next, timezone: REGIONS[next].timezone });
			} catch {
				if (mounted.current) setRegion(previous);
			}
		},
		[region]
	);

	const changeLocale = useCallback(
		(next: 'fr' | 'en') => {
			setLocale(next).catch(() => {
				// persistence failure: keep the in-memory locale
			});
		},
		[setLocale]
	);

	const handleBack = useCallback(() => {
		if (router.canGoBack()) router.back();
		else router.replace('/(tabs)/profil' as never);
	}, [router]);

	const handleSignOut = useCallback(async () => {
		if (signingOut) return;
		setSigningOut(true);
		try {
			await authService.logout();
		} finally {
			router.replace('/login');
		}
	}, [router, signingOut]);

	const handleSubmitPassword = useCallback(
		async (currentPassword: string, newPassword: string) => {
			const token = await authService.getToken();
			if (!token) {
				throw new ApiError('No session', 401, null);
			}
			const response = await apiService.updatePassword(token, { currentPassword, newPassword });
			if (!mounted.current) return;
			setPasswordUpdatedAt(response?.passwordUpdatedAt || new Date().toISOString());
			setPasswordOpen(false);
			toast.success(t('settings.password.success'));
		},
		[t]
	);

	const handleExport = useCallback(async () => {
		if (exportInFlight.current) return;
		exportInFlight.current = true;
		setExporting(true);
		try {
			const data = await apiService.exportMyData();
			await shareMyData(data, t('settings.privacy.export'));
		} catch {
			toast.error(t('settings.privacy.exportError'));
		} finally {
			exportInFlight.current = false;
			if (mounted.current) setExporting(false);
		}
	}, [t]);

	const handleConfirmDelete = useCallback(async () => {
		if (deleteInFlight.current) return;
		deleteInFlight.current = true;
		setDeleting(true);
		setDeleteError(null);
		try {
			await apiService.deleteCurrentUser();
		} catch {
			deleteInFlight.current = false;
			if (mounted.current) {
				setDeleting(false);
				setDeleteError(t('settings.delete.error'));
			}
			return;
		}
		try {
			await authService.logout();
		} finally {
			router.replace('/login');
		}
	}, [router, t]);

	const passwordLabel = (() => {
		const date = passwordUpdatedAt ? new Date(passwordUpdatedAt) : null;
		if (!date || Number.isNaN(date.getTime())) return t('settings.security.passwordUnknown');
		const formatted = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
		return t('settings.security.passwordChanged', { date: formatted });
	})();

	const notSet = t('settings.account.notSet');
	const channels: { key: NotificationChannel; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; description: string }[] = [
		{ key: 'site', icon: 'notifications-outline', title: t('settings.notifications.channelSite'), description: t('settings.notifications.channelSiteDesc') },
		{ key: 'email', icon: 'mail-outline', title: t('settings.notifications.channelEmail'), description: t('settings.notifications.channelEmailDesc') },
		{ key: 'mobile', icon: 'phone-portrait-outline', title: t('settings.notifications.channelMobile'), description: t('settings.notifications.channelMobileDesc') },
	];

	return (
		<Screen edges={['top', 'bottom']} testID="settings-screen">
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.topRow}>
					<Pressable
						onPress={handleBack}
						accessibilityRole="button"
						accessibilityLabel={t('common.back')}
						style={({ pressed }) => [styles.back, pressed && styles.pressed]}
						testID="settings-back"
					>
						<Ionicons name="arrow-back" size={22} color={colors.text} />
					</Pressable>
					<Text style={styles.title} accessibilityRole="header">
						{t('settings.title')}
					</Text>
				</View>

				<Section title={t('settings.account.title')} subtitle={t('settings.account.subtitle')}>
					<InfoRow label={t('settings.account.displayName')} value={account?.name || notSet} />
					<InfoRow label={t('settings.account.username')} value={account?.username ? `@${account.username}` : notSet} />
					<InfoRow label={t('settings.account.email')} value={account?.email || notSet} />
				</Section>

				<Section title={t('theme.title')} subtitle={t('theme.helper')}>
					<View style={styles.chips} accessibilityRole="radiogroup">
						<Chip label={t('theme.system')} active={preference === 'system'} onPress={() => void setPreference('system')} icon={<Ionicons name="phone-portrait-outline" size={16} color={preference === 'system' ? colors.onBrand : colors.muted} />} testID="settings-theme-system" />
						<Chip label={t('theme.light')} active={preference === 'light'} onPress={() => void setPreference('light')} icon={<Ionicons name="sunny-outline" size={16} color={preference === 'light' ? colors.onBrand : colors.muted} />} testID="settings-theme-light" />
						<Chip label={t('theme.dark')} active={preference === 'dark'} onPress={() => void setPreference('dark')} icon={<Ionicons name="moon-outline" size={16} color={preference === 'dark' ? colors.onBrand : colors.muted} />} testID="settings-theme-dark" />
					</View>

					<Text style={styles.rowLabel}>{t('profile.preferences.language')}</Text>
					<View style={styles.chips} accessibilityRole="radiogroup">
						<Chip label={t('profile.languages.fr')} active={locale === 'fr'} onPress={() => changeLocale('fr')} testID="settings-locale-fr" />
						<Chip label={t('profile.languages.en')} active={locale === 'en'} onPress={() => changeLocale('en')} testID="settings-locale-en" />
					</View>

					<Text style={styles.rowLabel}>{t('settings.appearance.region')}</Text>
					<View style={styles.chips} accessibilityRole="radiogroup">
						{(Object.keys(REGIONS) as Region[]).map((key) => (
							<Chip key={key} label={t(REGIONS[key].labelKey)} active={region === key} onPress={() => void selectRegion(key)} testID={`settings-region-${key}`} />
						))}
					</View>
					<Text style={styles.rowDescription}>{t('settings.appearance.timezone', { timezone: REGIONS[region].timezone })}</Text>
				</Section>

				<Section title={t('settings.notifications.title')} subtitle={t('settings.notifications.subtitle')}>
					<ToggleRow label={t('settings.notifications.global')} description={t('settings.notifications.globalDesc')} value={notifications.global} disabled={!prefsLoaded} onValueChange={(value) => void updateNotifications({ global: value })} testID="notif-global" />
					<ToggleRow label={t('settings.notifications.lives')} description={t('settings.notifications.livesDesc')} value={notifications.lives} disabled={!prefsLoaded} onValueChange={(value) => void updateNotifications({ lives: value })} testID="notif-lives" />
					<ToggleRow label={t('settings.notifications.reminders')} description={t('settings.notifications.remindersDesc')} value={notifications.reminders} disabled={!prefsLoaded} onValueChange={(value) => void updateNotifications({ reminders: value })} testID="notif-reminders" />
					<ToggleRow label={t('settings.notifications.promotions')} description={t('settings.notifications.promotionsDesc')} value={notifications.promotions} disabled={!prefsLoaded} onValueChange={(value) => void updateNotifications({ promotions: value })} testID="notif-promotions" />

					<Text style={styles.rowLabel}>{t('settings.notifications.channel')}</Text>
					<View style={styles.channelList} accessibilityRole="radiogroup">
						{channels.map((channel) => {
							const selected = notifications.channel === channel.key;
							return (
								<Pressable
									key={channel.key}
									onPress={() => void updateNotifications({ channel: channel.key })}
									disabled={!prefsLoaded}
									accessibilityRole="radio"
									accessibilityState={{ selected }}
									accessibilityLabel={`${channel.title}. ${channel.description}`}
									style={[styles.channel, selected && styles.channelSelected]}
									testID={`notif-channel-${channel.key}`}
								>
									<Ionicons name={channel.icon} size={20} color={selected ? colors.orangeText : colors.muted} />
									<View style={styles.toggleTexts}>
										<Text style={styles.rowLabel}>{channel.title}</Text>
										<Text style={styles.rowDescription}>{channel.description}</Text>
									</View>
									{selected ? <Ionicons name="checkmark-circle" size={20} color={colors.orange} /> : null}
								</Pressable>
							);
						})}
					</View>
				</Section>

				<Section title={t('settings.security.title')} subtitle={t('settings.security.subtitle')}>
					<View style={styles.toggleRow}>
						<View style={styles.toggleTexts}>
							<Text style={styles.rowLabel}>{t('settings.security.password')}</Text>
							<Text style={styles.rowDescription}>{passwordLabel}</Text>
						</View>
						<Button label={t('settings.security.change')} variant="secondary" size="sm" onPress={() => setPasswordOpen(true)} testID="settings-change-password" />
					</View>
				</Section>

				<Section title={t('settings.session.title')} subtitle={t('settings.session.subtitle')}>
					<Button
						label={t('common.signOut')}
						variant="secondary"
						onPress={handleSignOut}
						loading={signingOut}
						icon={<Ionicons name="log-out-outline" size={18} color={colors.text} />}
						testID="settings-signout"
					/>
				</Section>

				<Section title={t('settings.privacy.title')} subtitle={t('settings.privacy.subtitle')}>
					<View style={styles.toggleRow}>
						<View style={styles.toggleTexts}>
							<Text style={styles.rowLabel}>{t('settings.privacy.export')}</Text>
							<Text style={styles.rowDescription}>{t('settings.privacy.exportDesc')}</Text>
						</View>
						<Button
							label={t('settings.privacy.export')}
							variant="secondary"
							size="sm"
							onPress={handleExport}
							loading={exporting}
							testID="settings-export-data"
						/>
					</View>
					<Pressable
						onPress={() => void Linking.openURL(`${WEB_BASE_URL}/confidentialite`)}
						accessibilityRole="link"
						style={styles.toggleRow}
						testID="settings-privacy-policy"
					>
						<Text style={styles.rowLabel}>{t('settings.privacy.policy')}</Text>
						<Ionicons name="open-outline" size={18} color={colors.muted} />
					</Pressable>
					<Pressable
						onPress={() => void Linking.openURL(`${WEB_BASE_URL}/cgu`)}
						accessibilityRole="link"
						style={styles.toggleRow}
						testID="settings-terms"
					>
						<Text style={styles.rowLabel}>{t('settings.privacy.terms')}</Text>
						<Ionicons name="open-outline" size={18} color={colors.muted} />
					</Pressable>
				</Section>

				<Section title={t('settings.danger.title')} subtitle={t('settings.danger.subtitle')}>
					<View style={styles.dangerTexts}>
						<Text style={styles.dangerLabel}>{t('settings.danger.delete')}</Text>
						<Text style={styles.rowDescription}>{t('settings.danger.deleteDesc')}</Text>
					</View>
					<Button
						label={t('settings.danger.delete')}
						variant="danger"
						onPress={() => {
							setDeleteError(null);
							setDeleteOpen(true);
						}}
						icon={<Ionicons name="trash-outline" size={18} color={colors.onBrand} />}
						testID="settings-delete-account"
					/>
				</Section>
			</ScrollView>

			<ChangePasswordSheet visible={passwordOpen} onSubmit={handleSubmitPassword} onClose={() => setPasswordOpen(false)} />
			<DeleteAccountSheet visible={deleteOpen} loading={deleting} error={deleteError} onConfirm={handleConfirmDelete} onClose={() => setDeleteOpen(false)} />
		</Screen>
	);
}

const useStyles = makeStyles(({ colors, radii }) => ({
	content: {
		padding: 18,
		paddingBottom: 32,
		gap: 16,
	},
	topRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	back: {
		width: 44,
		height: 44,
		borderRadius: radii.lg,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.surfaceStrong,
		borderWidth: 1,
		borderColor: colors.border,
	},
	pressed: {
		opacity: 0.8,
	},
	title: {
		color: colors.text,
		fontSize: 26,
		fontWeight: '700',
		letterSpacing: -0.4,
	},
	section: {
		padding: 20,
		gap: 12,
	},
	sectionHeader: {
		gap: 2,
	},
	sectionTitle: {
		color: colors.text,
		fontSize: 18,
		fontWeight: '700',
	},
	sectionSubtitle: {
		color: colors.muted,
		fontSize: 14,
		lineHeight: 20,
	},
	infoRow: {
		gap: 2,
		padding: 12,
		borderRadius: radii.lg,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
	},
	infoLabel: {
		color: colors.muted,
		fontSize: 12,
		fontWeight: '600',
	},
	infoValue: {
		color: colors.text,
		fontSize: 15,
		fontWeight: '500',
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	rowLabel: {
		color: colors.text,
		fontSize: 15,
		fontWeight: '600',
	},
	rowDescription: {
		color: colors.muted,
		fontSize: 13,
		lineHeight: 18,
	},
	toggleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		minHeight: 48,
	},
	toggleTexts: {
		flex: 1,
		gap: 2,
	},
	channelList: {
		gap: 8,
	},
	channel: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		minHeight: 56,
		padding: 12,
		borderRadius: radii.lg,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	channelSelected: {
		borderColor: colors.orange,
		backgroundColor: colors.orangeSoft,
	},
	dangerTexts: {
		gap: 2,
	},
	dangerLabel: {
		color: colors.danger,
		fontSize: 15,
		fontWeight: '700',
	},
}));
