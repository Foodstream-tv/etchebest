export const API = "http://localhost:8081";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  followerCount: number;
  totalLives: number;
  totalViews: number;
  isVerified: boolean;
  isFeaturedChef: boolean;
  createdAt: string;
  lastLiveAt: string | null;
  isBanned: boolean;
  banReason: string;
  bannedAt: string | null;
  bannedUntil: string | null;
}

export interface Room {
  id: string;
  name: string;
  host: string;
  participants: string[];
  viewers: number;
  maxParticipants: number;
}

export function isBanActive(u: User): boolean {
  if (!u.isBanned) return false;
  return u.bannedUntil === null || new Date(u.bannedUntil) > new Date();
}

export async function adminAction(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = "Action failed";
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
}
