import { apiFetch } from "@/lib/api";

export type SearchUser = {
  id: string;
  username?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
};

export type SearchLive = {
  id: number;
  room_id: string;
  title: string;
  dish_name?: string;
  thumbnail_url?: string;
};

export type SearchResponse = {
  users: SearchUser[];
  lives: SearchLive[];
};

export async function globalSearch(query: string, token?: string) {
  return apiFetch<SearchResponse>(
    `/search?q=${encodeURIComponent(query)}`,
    {
      token,
      cache: "no-store",
    }
  );
}