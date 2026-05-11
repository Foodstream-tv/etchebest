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
  thumbnail_url?: string;
  preview_gif?: string;
  current_viewers: number;
  view_count: number;
  tags?: LiveTag[];
  user?: LiveUser;
  created_at: string;
  replay_url?: string;
  has_replay?: boolean;
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
  if (params.tag && params.tag !== "Tout") searchParams.set("tag", params.tag);

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