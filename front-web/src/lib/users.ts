import { API_BASE_URL, ApiError, apiFetch } from "@/lib/api";
import { dispatchSessionTerminated } from "@/lib/session";

export interface UserSummary {
  id: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
  description?: string;
  followersIds?: string[];
  followingIds?: string[];
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

// GDPR: download every piece of personal data held about the signed-in user.
// Goes through a raw fetch (not apiFetch) because the document must reach the
// user untouched: apiFetch unwraps a top-level "data" key and re-parses the body.
export async function exportMyData(token: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL.replace(/\/+$/, "")}/users/me/export`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let body: { message?: string; error?: string } | null = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (res.status === 401) dispatchSessionTerminated({ reason: "revoked" });
    throw new ApiError(
      body?.message || body?.error || `Erreur ${res.status}`,
      res.status,
      body
    );
  }

  return res.blob();
}

// GDPR: permanently erase the signed-in user's account and all linked data.
// The backend answers 204 with no body.
export async function deleteMyAccount(token: string) {
  return apiFetch<null>("/users/me", {
    method: "DELETE",
    token,
  });
}
