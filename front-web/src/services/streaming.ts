// use the internal api helpers so that the base URL (/api suffix, headers)
// is always consistent with the rest of the frontend code.
import { API_BASE_URL, apiFetch } from "@/lib/api";


async function authHeaders(token?: string): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface RoomInfo {
  id: string;
  name: string;
  maxParticipants: number;
  participants: any[];
  viewers: number;
}

export async function getRooms(token?: string): Promise<RoomInfo[]> {
  // Use the internal api helpers so that the base URL (/api suffix, headers)
  // is always consistent with the rest of the frontend code. token is optional
  // so callers can pass it if they've got one.
  return apiFetch<RoomInfo[]>("/rooms", { token, cache: "no-store" });
}

export async function createRoom(name: string, token?: string): Promise<{ roomId: string }> {
  const res = await fetch(`${API_BASE_URL}/rooms`, {
    method: "POST",
    headers: await authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to create room (${res.status})`);
  return res.json();
}

export async function reserveRoom(roomId: string, token?: string): Promise<void> {
  const rid = encodeURIComponent(roomId);
  const res = await fetch(`${API_BASE_URL}/rooms/${rid}/reserve`, {
    method: "POST",
    headers: await authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to reserve room (${res.status})`);
}

export async function disconnectRoom(roomId: string, token?: string): Promise<void> {
  const rid = encodeURIComponent(roomId);
  await fetch(`${API_BASE_URL}/rooms/${rid}/disconnect`, {
    method: "POST",
    headers: await authHeaders(token),
  });
}

// ---------- WebRTC signaling ----------

export async function sendOffer(
  roomId: string,
  sdp: string,
  token?: string
): Promise<{ sdp: string }> {
  const rid = encodeURIComponent(roomId);
  const res = await fetch(`${API_BASE_URL}/webrtc?roomId=${rid}`, {
    method: "POST",
    headers: await authHeaders(token),
    body: JSON.stringify({ type: "offer", sdp }),
  });
  if (!res.ok) throw new Error(`SDP exchange failed (${res.status})`);
  return res.json();
}

export async function sendICECandidate(
  roomId: string,
  candidate: RTCIceCandidateInit,
  token?: string
): Promise<void> {
  const rid = encodeURIComponent(roomId);
  const res = await fetch(`${API_BASE_URL}/ice?roomId=${rid}`, {
    method: "POST",
    headers: await authHeaders(token),
    body: JSON.stringify({ candidate }),
  });
  if (!res.ok) throw new Error(`ICE candidate failed (${res.status})`);
}

// ---------- HLS ----------

export function getHLSUrl(roomId: string): string {
  const rid = encodeURIComponent(roomId);
  return `${API_BASE_URL}/hls/${rid}/index.m3u8`;
}