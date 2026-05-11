import { apiFetch } from "@/lib/api";

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

export async function followUser(userId: string, token?: string) {
  return apiFetch<{ message: string }>(`/users/follow/${userId}`, {
    method: "POST",
    token,
  });
}

export async function unfollowUser(userId: string, token?: string) {
  return apiFetch<{ message: string }>(`/users/unfollow/${userId}`, {
    method: "POST",
    token,
  });
}

export async function isFollowingUser(userId: string, token?: string) {
  return apiFetch<{ is_following: boolean }>(
    `/users/${userId}/is-following`,
    {
      token,
      cache: "no-store",
    }
  );
}

export async function getUserFollowers(userId: string, token?: string) {
  return apiFetch<FollowListResponse>(`/users/${userId}/followers`, {
    token,
    cache: "no-store",
  });
}

export async function getUserFollowing(userId: string, token?: string) {
  return apiFetch<FollowListResponse>(`/users/${userId}/following`, {
    token,
    cache: "no-store",
  });
}

export async function getUserById(userId: string, token?: string) {
  return apiFetch<UserSummary>(`/users/${userId}`, {
    token,
    cache: "no-store",
  });
}