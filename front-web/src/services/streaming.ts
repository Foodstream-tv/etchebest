import { API_BASE_URL, ApiError, apiFetch } from "@/lib/api";

const MEDIA_BASE_URL =
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
  API_BASE_URL.replace(/\/api\/?$/, "");

// The session cookie authenticates these calls: they only need to send credentials.
const jsonHeaders = { "Content-Type": "application/json" };

export interface RoomParticipant {
  id: string;
  /** Empty when the backend does not know the user: never show the id instead. */
  username: string;
  role: "host" | "participant";
  /** True while the user has an active peer connection in the room. */
  connected: boolean;
}

export interface RoomInfo {
  id: string;
  name: string;
  host?: string;
  maxParticipants: number;
  /** Reserved and connected users (ids): includes people who never connected. */
  participants: string[];
  /** Same people with a name and a connection state (absent on an older backend). */
  participantsInfo?: RoomParticipant[];
  /** Co-streamers (host excluded) with an active peer connection (absent on an older backend). */
  connectedCount?: number;
  /** False when the host chose not to keep a replay (a co-streamer then has nothing to consent to). */
  recordReplay?: boolean;
  viewers: number;
}

export async function getRooms(token?: string): Promise<RoomInfo[]> {
  return apiFetch<RoomInfo[]>("/rooms", { token, cache: "no-store" });
}

export async function getRoom(roomId: string, token?: string): Promise<RoomInfo> {
  const rid = encodeURIComponent(roomId);
  return apiFetch<RoomInfo>(`/rooms/${rid}`, { token, cache: "no-store" });
}

export async function createRoom(name: string): Promise<{ roomId: string }> {
  const res = await fetch(`${API_BASE_URL}/rooms`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to create room (${res.status})`);
  return res.json();
}

export type ReservationResponse = {
  message: string;
  reserved: boolean;
  registeredCount: number;
  maxParticipants: number;
};

// The API refuses a reservation to a recorded live until the person agreed to the recording.
export const RECORDING_CONSENT_REQUIRED = "RECORDING_CONSENT_REQUIRED";

export function isRecordingConsentRequired(err: unknown): boolean {
  return err instanceof ApiError && err.body?.code === RECORDING_CONSENT_REQUIRED;
}

export async function reserveRoom(
  roomId: string,
  token?: string,
  opts: { consentToRecording?: boolean } = {}
): Promise<ReservationResponse> {
  const rid = encodeURIComponent(roomId);
  return apiFetch<ReservationResponse>(`/rooms/${rid}/reserve`, {
    method: "POST",
    token,
    body: opts.consentToRecording ? JSON.stringify({ consentToRecording: true }) : undefined,
  });
}

export async function cancelReserveRoom(roomId: string, token?: string): Promise<ReservationResponse> {
  const rid = encodeURIComponent(roomId);
  return apiFetch<ReservationResponse>(`/rooms/${rid}/reserve`, {
    method: "DELETE",
    token,
  });
}

export async function disconnectRoom(roomId: string): Promise<void> {
  const rid = encodeURIComponent(roomId);
  await fetch(`${API_BASE_URL}/rooms/${rid}/disconnect`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
  });
}

// ---------- WebRTC signaling ----------

export async function sendOffer(roomId: string, sdp: string): Promise<{ sdp: string }> {
  const rid = encodeURIComponent(roomId);

  const res = await fetch(`${API_BASE_URL}/webrtc?roomId=${rid}`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify({ type: "offer", sdp }),
  });
  if (!res.ok) throw new Error(`SDP exchange failed (${res.status})`);
  return res.json();
}

export async function sendRenegotiationAnswer(roomId: string, sdp: string): Promise<void> {
  const rid = encodeURIComponent(roomId);

  const res = await fetch(`${API_BASE_URL}/webrtc/answer?roomId=${rid}`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify({ type: "answer", sdp }),
  });
  if (!res.ok) throw new Error(`Renegotiation answer failed (${res.status})`);
}
export async function sendICECandidate(roomId: string, candidate: RTCIceCandidateInit): Promise<void> {
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

  if (typeof candidate.usernameFragment === "string") {
    safeCandidate.usernameFragment = candidate.usernameFragment;
  }

  const body = JSON.stringify(safeCandidate);

  const res = await fetch(`${API_BASE_URL}/ice?roomId=${rid}`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
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
  return `${MEDIA_BASE_URL}/api/hls/${rid}/master.m3u8`;
}

// ---------- Chat ----------

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
}

export async function getChatMessages(roomId: string, token?: string | null): Promise<ChatMessage[]> {
  const rid = encodeURIComponent(roomId);
  return apiFetch<ChatMessage[]>(`/rooms/${rid}/chat`, { token: token ?? undefined, cache: "no-store" });
}

export async function postChatMessage(roomId: string, message: string, token: string): Promise<void> {
  const rid = encodeURIComponent(roomId);
  await apiFetch<unknown>(`/rooms/${rid}/chat`, {
    method: "POST",
    token,
    body: JSON.stringify({ message }),
    silent: true,
  });
}

// ---------- Moderation & Management ----------

export async function kickParticipant(
  roomId: string,
  data: { streamId?: string; userId?: string },
  token: string
): Promise<{ message: string; participantId?: string }> {
  const rid = encodeURIComponent(roomId);
  return apiFetch<{ message: string; participantId?: string }>(`/rooms/${rid}/kick`, {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function deleteLive(
  liveIdOrRoomId: string | number,
  token: string
): Promise<{ message: string; id?: number; roomId?: string }> {
  const id = encodeURIComponent(String(liveIdOrRoomId));
  return apiFetch<{ message: string; id?: number; roomId?: string }>(`/lives/${id}`, {
    method: "DELETE",
    token,
  });
}

