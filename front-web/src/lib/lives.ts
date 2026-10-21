import { apiFetch } from "@/lib/api";

export type LiveTag = {
  id: number;
  name: string;
  slug: string;
};

export type LiveUser = {
  id: string;
  username?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
};

export type LiveDTO = {
  id: number;
  room_id: string;
  title: string;
  description?: string;
  dish_name?: string;
  status: "scheduled" | "live" | "ended";

  scheduled_at?: string;
  created_at: string;

  thumbnail_url?: string;
  preview_gif?: string;
  current_viewers: number;
  view_count: number;
  tags?: LiveTag[];
  user?: LiveUser;
  replay_url?: string;
  has_replay?: boolean;
  /** False when the host chose not to keep a replay. */
  replay_enabled?: boolean;
  /** True when the replay was withdrawn after the live. */
  replay_removed?: boolean;
};

export type GetLivesParams = {
  q?: string;
  tag?: string;
  status?: "all" | "scheduled" | "live" | "ended";
  page?: number;
  limit?: number;
};

export async function getLives(params: GetLivesParams = {}, token?: string) {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set("q", params.q);
  if (params.tag && params.tag !== "Tout" && params.tag !== "All") {
    searchParams.set("tag", params.tag);
  }

  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }

  if (params.page) {
    searchParams.set("page", String(params.page));
  }

  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const query = searchParams.toString();

  return apiFetch<{
    lives: LiveDTO[];
    total: number;
    page: number;
    limit: number;
  }>(`/lives${query ? `?${query}` : ""}`, {
    token,
    cache: "no-store",
  });
}

export async function getLiveByRoomId(roomId: string, token?: string) {
  return apiFetch<LiveDTO>(`/lives/${encodeURIComponent(roomId)}`, {
    token,
    cache: "no-store",
  });
}

// Withdraw the replay of a live: allowed to its host and to the people who took part in it.
export async function removeReplay(roomId: string, token: string) {
  return apiFetch<{ message: string }>(`/lives/${encodeURIComponent(roomId)}/replay/removal`, {
    method: "POST",
    token,
  });
}

export type MyScheduledLive = {
  room_id: string;
  title: string;
  scheduled_at?: string | null;
};

export async function getMyScheduledLive(token: string) {
  return apiFetch<{ live: MyScheduledLive | null }>("/users/me/scheduled-live", {
    token,
    cache: "no-store",
  });
}