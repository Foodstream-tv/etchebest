import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import FollowButton from '@/components/profile/FollowButton';
import FollowListSheet from '@/components/profile/FollowListSheet';
import ProfileHeader from '@/components/profile/ProfileHeader';
import { displayNameOf, followersCountOf, followingCountOf, parseRouteId, ProfileUser, safeImageUrl } from '@/components/profile/profileUtils';
import { FollowListKind, useFollowList } from '@/components/profile/useFollowList';
import Card from '@/components/ui/Card';
import Screen from '@/components/ui/Screen';
import SectionHeader from '@/components/ui/SectionHeader';
import Skeleton from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import authService from '@/services/auth';
import { ApiError } from '@/services/http';
import { getUserById, getUserFollowers, getUserFollowing, userImage, UserSummary } from '@/services/social';

type LoadState =
	| { status: 'loading' }
	| { status: 'invalid' }
	| { status: 'notFound' }
	| { status: 'error'; cause?: unknown }
	| { status: 'self' }
	| { status: 'ready'; user: ProfileUser };

export default function PublicProfileScreen(): React.JSX.Element {
	const router = useRouter();
	const params = useLocalSearchParams<{ id?: string | string[] }>();
	const styles = useStyles();
	const { colors } = useTheme();
	const { t } = useI18n();

	const userId = parseRouteId(params?.id);
	const [state, setState] = useState<LoadState>(userId ? { status: 'loading' } : { status: 'invalid' });
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [counts, setCounts] = useState({ followers: 0, following: 0 });
	const [reloadKey, setReloadKey] = useState(0);
	const routerRef = useRef(router);
	routerRef.current = router;

	useEffect(() => {
		if (!userId) {
			setState({ status: 'invalid' });
			return;
		}
		let active = true;
		setState({ status: 'loading' });

		const run = async () => {
			// Own profile: the profile tab is the place to view / edit it (and one cannot follow oneself).
			let me: string | null = null;
			try {
				me = (await authService.getUser())?.id ?? null;
			} catch {
				me = null;
			}
			if (!active) return;
			setCurrentUserId(me);
			if (me && me === userId) {
				setState({ status: 'self' });
				routerRef.current.replace('/(tabs)/profil' as never);
				return;
			}

			const [userResult, followersResult, followingResult] = await Promise.allSettled([
				getUserById(userId),
				getUserFollowers(userId),
				getUserFollowing(userId),
			]);
			if (!active) return;

			if (userResult.status === 'rejected') {
				const error = userResult.reason;
				const missing = error instanceof ApiError && (error.status === 404 || error.status === 400);
				setState(missing ? { status: 'notFound' } : { status: 'error', cause: error });
				return;
			}

			const user = userResult.value as ProfileUser;
			setCounts({
				followers: followersResult.status === 'fulfilled' && typeof followersResult.value?.count === 'number' ? followersResult.value.count : followersCountOf(user),
				following: followingResult.status === 'fulfilled' && typeof followingResult.value?.count === 'number' ? followingResult.value.count : followingCountOf(user),
			});
			setState({ status: 'ready', user });
		};

		void run();
		return () => {
			active = false;
		};
	}, [userId, reloadKey]);

	const followList = useFollowList(userId, {
		onCount: (kind: FollowListKind, count: number) => setCounts((prev) => ({ ...prev, [kind]: count })),
	});

	const handleBack = useCallback(() => {
		if (router.canGoBack()) router.back();
		else router.replace('/(tabs)' as never);
	}, [router]);

	const handleFollowChange = useCallback((isFollowing: boolean) => {
		setCounts((prev) => ({ ...prev, followers: Math.max(0, prev.followers + (isFollowing ? 1 : -1)) }));
	}, []);

	const handleSelectUser = useCallback(
		(user: UserSummary) => {
			followList.close();
			if (user.id === userId) return;
			if (user.id === currentUserId) {
				router.push('/(tabs)/profil' as never);
				return;
			}
			router.push({ pathname: '/profile/[id]', params: { id: user.id } } as never);
		},
		[currentUserId, followList, router, userId]
	);

	let content: React.ReactNode;
	switch (state.status) {
		case 'loading':
		case 'self':
			content = (
				<View style={styles.skeletons} accessibilityLabel={t('profile.public.loading')} testID="public-profile-loading">
					<Skeleton height={260} radius={28} />
					<Skeleton height={140} radius={28} />
				</View>
			);
			break;
		case 'invalid':
		case 'notFound':
			content = <EmptyState icon="person-outline" title={t('profile.public.notFound')} testID="public-profile-not-found" />;
			break;
		case 'error':
			content = <ErrorState title={t('profile.public.error')} error={state.cause} onRetry={() => setReloadKey((key) => key + 1)} testID="public-profile-error" />;
			break;
		default: {
			const { user } = state;
			const name = displayNameOf(user, t('common.user'));
			content = (
				<>
					<ProfileHeader
						centered
						name={name}
						username={user.username}
						bio={user.description}
						imageUrl={safeImageUrl(userImage(user))}
						verified={user.isVerified}
						chef={user.isFeaturedChef}
						followersCount={counts.followers}
						followingCount={counts.following}
						onOpenFollowers={() => void followList.open('followers')}
						onOpenFollowing={() => void followList.open('following')}
					>
						<FollowButton userId={user.id} currentUserId={currentUserId} name={name} onChange={handleFollowChange} />
					</ProfileHeader>

					<Card style={styles.section}>
						<SectionHeader title={t('profile.public.livesAndReplays')} />
						<EmptyState
							icon="restaurant-outline"
							title={t('profile.public.noLivesYet')}
							description={t('profile.public.noLivesDesc')}
							testID="public-profile-no-lives"
						/>
					</Card>
				</>
			);
		}
	}

	return (
		<Screen testID="public-profile-screen">
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.topRow}>
					<Pressable
						onPress={handleBack}
						accessibilityRole="button"
						accessibilityLabel={t('common.back')}
						style={({ pressed }) => [styles.back, pressed && styles.pressed]}
						testID="public-profile-back"
					>
						<Ionicons name="arrow-back" size={22} color={colors.text} />
					</Pressable>
					<Text style={styles.title} accessibilityRole="header">
						{t('profile.title')}
					</Text>
				</View>
				{content}
			</ScrollView>

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
		fontSize: 22,
		fontWeight: '700',
	},
	skeletons: {
		gap: 16,
	},
	section: {
		padding: 20,
	},
}));
