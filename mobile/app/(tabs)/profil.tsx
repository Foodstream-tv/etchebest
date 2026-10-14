import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import ActivityRow from '@/components/profile/ActivityRow';
import EditProfileSheet from '@/components/profile/EditProfileSheet';
import FollowListSheet from '@/components/profile/FollowListSheet';
import ProfileHeader from '@/components/profile/ProfileHeader';
import { displayNameOf, followersCountOf, followingCountOf, ProfileUser, safeImageUrl } from '@/components/profile/profileUtils';
import { ProfileFormValues } from '@/components/profile/profileValidation';
import { FollowListKind, useFollowList } from '@/components/profile/useFollowList';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Screen from '@/components/ui/Screen';
import SectionHeader from '@/components/ui/SectionHeader';
import Skeleton from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import apiService, { UserProfile } from '@/services/api';
import authService from '@/services/auth';
import { ApiError } from '@/services/http';
import { Activity, getMyActivities, UserSummary } from '@/services/social';
import toast from '@/utils/toast';

type LoadStatus = 'loading' | 'ready' | 'error';

const ACTIVITY_DAYS = 30;

export default function ProfileScreen(): React.JSX.Element {
	const router = useRouter();
	const styles = useStyles();
	const { colors, preference, setPreference } = useTheme();
	const { t, locale, setLocale } = useI18n();

	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [activities, setActivities] = useState<Activity[]>([]);
	const [activitiesFailed, setActivitiesFailed] = useState(false);
	const [status, setStatus] = useState<LoadStatus>('loading');
	const [loadError, setLoadError] = useState<unknown>(undefined);
	const [refreshing, setRefreshing] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);
	const [counts, setCounts] = useState<{ followers?: number; following?: number }>({});

	const mounted = useRef(true);
	const loadId = useRef(0);
	const hasProfile = useRef(false);

	const followList = useFollowList(profile?.id, {
		onCount: (kind: FollowListKind, count: number) => setCounts((prev) => ({ ...prev, [kind]: count })),
	});

	const load = useCallback(async (mode: 'initial' | 'refresh') => {
		const id = ++loadId.current;
		if (mode === 'initial' && !hasProfile.current) setStatus('loading');

		const [profileResult, activitiesResult] = await Promise.allSettled([apiService.getProfile(), getMyActivities(ACTIVITY_DAYS)]);
		if (!mounted.current || id !== loadId.current) return;

		if (profileResult.status === 'fulfilled') {
			hasProfile.current = true;
			setProfile(profileResult.value);
			setCounts({});
			setStatus('ready');
		} else if (!hasProfile.current) {
			// Nothing to show yet: surface the error. With data already on screen a failed
			// refresh keeps the stale (but real) data instead of replacing it by an error.
			setLoadError(profileResult.reason);
			setStatus('error');
		}

		if (activitiesResult.status === 'fulfilled') {
			setActivities(activitiesResult.value);
			setActivitiesFailed(false);
		} else {
			setActivitiesFailed(true);
		}
	}, []);

	// Refresh whenever the tab gains focus (new followers, edits made in settings…).
	useFocusEffect(
		useCallback(() => {
			mounted.current = true;
			void load('initial');
			return () => {
				mounted.current = false;
			};
		}, [load])
	);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load('refresh');
		} finally {
			if (mounted.current) setRefreshing(false);
		}
	}, [load]);

	const handleSaveProfile = useCallback(
		async (values: ProfileFormValues) => {
			const token = await authService.getToken();
			if (!token) {
				throw new ApiError('No session', 401, null);
			}

			const updated = await apiService.updateProfile(token, {
				firstName: values.firstName,
				lastName: values.lastName,
				username: values.username,
				email: values.email,
				description: values.description,
			});

			// Keep the cached session user in sync (and don't drop its role / avatar).
			const stored = await authService.getUser();
			await authService.saveAuth(token, {
				...stored,
				id: updated.id,
				email: updated.email,
				username: updated.username,
				firstName: updated.firstName,
				lastName: updated.lastName,
				description: updated.description,
				profileImageUrl: updated.profileImageUrl,
				role: updated.role ?? stored?.role,
			});

			if (!mounted.current) return;
			setProfile((previous) => ({ ...(previous ?? ({} as UserProfile)), ...updated }));
			setEditOpen(false);
			toast.success(t('profile.editModal.success'));
		},
		[t]
	);

	const handleSignOut = useCallback(async () => {
		if (signingOut) return;
		setSigningOut(true);
		try {
			await authService.logout();
		} finally {
			router.replace('/login');
		}
	}, [router, signingOut]);

	const handleSelectUser = useCallback(
		(user: UserSummary) => {
			followList.close();
			router.push({ pathname: '/profile/[id]', params: { id: user.id } } as never);
		},
		[followList, router]
	);

	const handleChangeLocale = useCallback(
		(next: 'fr' | 'en') => {
			setLocale(next).catch(() => {
				// persistence failure: keep the in-memory locale
			});
		},
		[setLocale]
	);

	const user = profile as ProfileUser | null;
	const displayName = displayNameOf(profile, t('nav.myProfile'));
	const followersCount = counts.followers ?? followersCountOf(user);
	const followingCount = counts.following ?? followingCountOf(user);

	const editInitialValues = useMemo<ProfileFormValues>(
		() => ({
			firstName: profile?.firstName ?? '',
			lastName: profile?.lastName ?? '',
			username: profile?.username ?? '',
			email: profile?.email ?? '',
			description: profile?.description ?? '',
		}),
		[profile]
	);

	let content: React.ReactNode;
	if (status === 'loading') {
		content = (
			<View style={styles.skeletons} accessibilityLabel={t('common.loading')} testID="profile-loading">
				<Skeleton height={190} radius={28} />
				<Skeleton height={140} radius={28} />
				<Skeleton height={140} radius={28} />
			</View>
		);
	} else if (status === 'error' || !profile) {
		content = <ErrorState title={t('profile.error.title')} error={loadError} onRetry={() => void load('initial')} testID="profile-error" />;
	} else {
		content = (
			<>
				<ProfileHeader
					name={displayName}
					username={profile.username}
					bio={profile.description}
					imageUrl={safeImageUrl(profile.profileImageUrl)}
					verified={user?.isVerified}
					chef={user?.isFeaturedChef}
					followersCount={followersCount}
					followingCount={followingCount}
					onOpenFollowers={() => void followList.open('followers')}
					onOpenFollowing={() => void followList.open('following')}
				>
					<View style={styles.emailRow}>
						<Ionicons name="mail-outline" size={18} color={colors.muted} />
						<Text style={styles.email} numberOfLines={1}>
							{profile.email}
						</Text>
					</View>
					<Button
						label={t('profile.edit')}
						accessibilityLabel={t('profile.editAria')}
						onPress={() => setEditOpen(true)}
						icon={<Ionicons name="pencil" size={16} color={colors.onBrand} />}
						testID="profile-edit"
					/>
				</ProfileHeader>

				<Card style={styles.section}>
					<SectionHeader title={t('profile.section.activity')} />
					{activitiesFailed ? (
						<Text style={styles.muted} accessibilityRole="alert">
							{t('profile.activity.error')}
						</Text>
					) : activities.length === 0 ? (
						<EmptyState icon="notifications-off-outline" title={t('profile.activity.empty')} testID="profile-activity-empty" />
					) : (
						<View style={styles.list}>
							{activities.map((activity) => (
								<ActivityRow key={activity.id} text={activity.text} createdAt={activity.created_at} />
							))}
						</View>
					)}
				</Card>

				<Card style={styles.section}>
					<SectionHeader title={t('profile.preferences.title')} />
					<Text style={styles.label}>{t('profile.preferences.theme')}</Text>
					<View style={styles.chips} accessibilityRole="radiogroup">
						<Chip label={t('theme.system')} active={preference === 'system'} onPress={() => void setPreference('system')} testID="theme-system" />
						<Chip label={t('theme.light')} active={preference === 'light'} onPress={() => void setPreference('light')} testID="theme-light" />
						<Chip label={t('theme.dark')} active={preference === 'dark'} onPress={() => void setPreference('dark')} testID="theme-dark" />
					</View>
					<Text style={styles.label}>{t('profile.preferences.language')}</Text>
					<View style={styles.chips} accessibilityRole="radiogroup">
						<Chip label={t('profile.languages.fr')} active={locale === 'fr'} onPress={() => handleChangeLocale('fr')} testID="locale-fr" />
						<Chip label={t('profile.languages.en')} active={locale === 'en'} onPress={() => handleChangeLocale('en')} testID="locale-en" />
					</View>
					<Button
						label={t('profile.preferences.allSettings')}
						variant="secondary"
						onPress={() => router.push('/settings')}
						icon={<Ionicons name="settings-outline" size={18} color={colors.text} />}
						testID="profile-all-settings"
					/>
				</Card>

				<Button
					label={t('profile.signout')}
					accessibilityLabel={t('profile.signoutAria')}
					variant="secondary"
					onPress={handleSignOut}
					loading={signingOut}
					icon={<Ionicons name="log-out-outline" size={18} color={colors.text} />}
					testID="profile-signout"
				/>
			</>
		);
	}

	return (
		<Screen testID="profile-screen">
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.orange} />}
			>
				<View style={styles.titleRow}>
					<Text style={styles.title} accessibilityRole="header">
						{t('profile.title')}
					</Text>
					<Pressable
						onPress={() => router.push('/settings')}
						accessibilityRole="button"
						accessibilityLabel={t('settings.title')}
						style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
						testID="profile-settings"
					>
						<Ionicons name="settings-outline" size={22} color={colors.text} />
					</Pressable>
				</View>
				{content}
			</ScrollView>

			<EditProfileSheet visible={editOpen} initialValues={editInitialValues} onSubmit={handleSaveProfile} onClose={() => setEditOpen(false)} />

			<FollowListSheet
				visible={followList.kind !== null}
				title={followList.kind === 'following' ? t('profile.following') : t('profile.followers')}
				users={followList.users}
				loading={followList.loading}
				error={followList.error}
				onRetry={followList.retry}
				onClose={followList.close}
				onSelectUser={handleSelectUser}
			/>
		</Screen>
	);
}

const useStyles = makeStyles(({ colors, radii }) => ({
	content: {
		padding: 18,
		paddingBottom: 32,
		gap: 16,
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	title: {
		color: colors.text,
		fontSize: 28,
		fontWeight: '700',
		letterSpacing: -0.4,
	},
	gear: {
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
	skeletons: {
		gap: 16,
	},
	emailRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		padding: 12,
		borderRadius: radii.lg,
		backgroundColor: colors.surface,
	},
	email: {
		flex: 1,
		color: colors.muted,
		fontSize: 14,
	},
	section: {
		padding: 20,
		gap: 10,
	},
	list: {
		gap: 8,
	},
	label: {
		color: colors.text,
		fontSize: 14,
		fontWeight: '600',
		marginTop: 4,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	muted: {
		color: colors.muted,
		fontSize: 14,
	},
}));
