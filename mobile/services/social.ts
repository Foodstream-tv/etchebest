import { request, seg } from './http';

export type SearchUser = {
  id: string;
  username?: string;
  email?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
};

export type SearchLive = {
  id: number;
  room_id?: string;
  title: string;
  dishName?: string;
  dish_name?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
};

export type SearchResponse = {
  users: SearchUser[];
  lives: SearchLive[];
};

export async function globalSearch(query: string): Promise<SearchResponse> {
  const res = await request<Partial<SearchResponse> | null>('/search', {
    query: { q: query.trim() },
  });
  return {
    users: Array.isArray(res?.users) ? res.users : [],
    lives: Array.isArray(res?.lives) ? res.lives : [],
  };
}

export interface UserSummary {
  id: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
  description?: string;
  followersIDS?: string[];
  followingIDS?: string[];
}

export interface FollowListResponse {
  count: number;
  followers?: UserSummary[];
  following?: UserSummary[];
}

export const followUser = (userId: string) =>
  request<{ message: string }>(`/users/follow/${seg(userId)}`, { method: 'POST' });

export const unfollowUser = (userId: string) =>
  request<{ message: string }>(`/users/unfollow/${seg(userId)}`, { method: 'POST' });

export const isFollowingUser = (userId: string) =>
  request<{ is_following: boolean }>(`/users/${seg(userId)}/is-following`);

export const getUserFollowers = (userId: string) =>
  request<FollowListResponse>(`/users/${seg(userId)}/followers`);

export const getUserFollowing = (userId: string) =>
  request<FollowListResponse>(`/users/${seg(userId)}/following`);

export const getUserById = (userId: string) => request<UserSummary>(`/users/${seg(userId)}`);

export type Activity = {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  text: string;
  created_at: string;
};

export async function getMyActivities(days = 30): Promise<Activity[]> {
  const res = await request<{ activities?: Activity[] } | null>('/users/me/activities', { query: { days } });
  return Array.isArray(res?.activities) ? res.activities : [];
}

export type MyScheduledLive = {
  room_id: string;
  title: string;
  scheduled_at?: string | null;
};

export async function getMyScheduledLive(): Promise<MyScheduledLive | null> {
  const res = await request<{ live: MyScheduledLive | null } | null>('/users/me/scheduled-live');
  return res?.live ?? null;
}

export function userImage(user: Pick<UserSummary, 'profileImageUrl' | 'profile_image_url'> | undefined): string | undefined {
  return user?.profileImageUrl || user?.profile_image_url || undefined;
}
