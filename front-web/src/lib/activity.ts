import { apiFetch } from "@/lib/api";

export type Activity = {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  text: string;
  created_at: string;
};

export async function getMyActivities(
  token?: string
) {
  return apiFetch<{
    activities: Activity[];
  }>("/users/me/activities?days=30", {
    token,
    cache: "no-store",
  });
}