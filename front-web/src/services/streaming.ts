import { API_BASE_URL, apiFetch } from "@/lib/api";

const MEDIA_BASE_URL =
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
  API_BASE_URL.replace(/\/api\/?$/, "");

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
  return apiFetch<RoomInfo[]>("/rooms", { token, cache: "no-store" });
}

export async function createRoom(
  name: string,
  token?: string
): Promise<{ roomId: string }> {
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

export async function sendOffer(roomId: string,sdp: string,token?: string): Promise<{ sdp: string }> {
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

  const safeCandidate: Record<string, unknown> = {
    candidate: candidate.candidate,
  };

  if (typeof candidate.sdpMid === "string") {
    safeCandidate.sdpMid = candidate.sdpMid;
  }

  if (typeof candidate.sdpMLineIndex === "number") {
    safeCandidate.sdpMLineIndex = candidate.sdpMLineIndex;
  }

  if (typeof (candidate as any).usernameFragment === "string") {
    safeCandidate.usernameFragment = (candidate as any).usernameFragment;
  }

  const body = JSON.stringify(safeCandidate);
  console.log("[ICE] request body =", body);

  const res = await fetch(`${API_BASE_URL}/ice?roomId=${rid}`, {
    method: "POST",
    headers: await authHeaders(token),
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ICE candidate failed (${res.status}) ${text}`);
  }
}

// ---------- HLS ----------

export function getHLSUrl(roomId: string): string {
  const rid = encodeURIComponent(roomId);
  return `${MEDIA_BASE_URL}/api/hls/${rid}/index.m3u8`;
}
