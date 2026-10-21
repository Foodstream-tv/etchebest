import envConfig from '../config/env';
import { ApiError, request, seg, UnauthorizedError } from './http';

export { UnauthorizedError };

// ---------- Rooms ----------

export interface RoomParticipant {
  id: string;
  /** Empty when the backend does not know the user: never show the id instead. */
  username: string;
  role: 'host' | 'participant';
  /** True while the user has an active peer connection in the room. */
  connected: boolean;
}

export interface RoomInfo {
  id: string;
  name: string;
  host?: string;
  /** Reserved and connected users (ids): includes people who never connected. */
  participants: string[];
  /** Same people with a name and a connection state (absent on an older backend). */
  participantsInfo?: RoomParticipant[];
  /** Co-streamers (host excluded) with an active peer connection (absent on an older backend). */
  connectedCount?: number;
  viewers: number;
  maxParticipants: number;
  /** False when the host chose not to keep a replay (a co-streamer then has nothing to consent to). */
  recordReplay?: boolean;
}

export interface CreateRoomResponse {
  roomId: string;
  message?: string;
}

export interface ReservationResponse {
  message: string;
  reserved: boolean;
  registeredCount: number;
  maxParticipants: number;
}

export async function getRooms(): Promise<RoomInfo[]> {
  const rooms = await request<RoomInfo[] | null>('/rooms');
  return Array.isArray(rooms) ? rooms : [];
}

export async function getRoom(roomId: string): Promise<RoomInfo> {
  return request<RoomInfo>(`/rooms/${seg(roomId)}`);
}

/** Optional metadata the backend persists on the live at creation (web Studio payload). */
export interface CreateRoomOptions {
  title?: string;
  description?: string;
  tags?: string[];
  level?: string;
  durationMinutes?: number;
  thumbnailUrl?: string;
  /** Omitted for a live started right away (the backend then handles it like before). */
  status?: 'scheduled' | 'live';
  /** RFC 3339, with status "scheduled". */
  scheduledAt?: string;
  /** False: no replay is kept once the live is over. Omitted means yes. */
  recordReplay?: boolean;
}

export async function createRoom(name: string, options: CreateRoomOptions = {}): Promise<CreateRoomResponse> {
  const body: Record<string, unknown> = { name };
  if (options.title) body.title = options.title;
  if (options.description) body.description = options.description;
  if (options.tags && options.tags.length > 0) body.tags = options.tags;
  if (options.level) body.level = options.level;
  if (options.durationMinutes && options.durationMinutes > 0) body.durationMinutes = options.durationMinutes;
  if (options.thumbnailUrl) body.thumbnailUrl = options.thumbnailUrl;
  if (options.status) body.status = options.status;
  if (options.scheduledAt) body.scheduledAt = options.scheduledAt;
  if (options.recordReplay === false) body.recordReplay = false;
  return request<CreateRoomResponse>('/rooms', { method: 'POST', body });
}

/** The API refuses a reservation to a recorded live until the person agreed to the recording. */
export const RECORDING_CONSENT_REQUIRED = 'RECORDING_CONSENT_REQUIRED';

export function isRecordingConsentRequired(err: unknown): boolean {
  return err instanceof ApiError && err.body?.code === RECORDING_CONSENT_REQUIRED;
}

export async function reserveRoom(roomId: string, options: { consentToRecording?: boolean } = {}): Promise<ReservationResponse> {
  return request<ReservationResponse>(`/rooms/${seg(roomId)}/reserve`, {
    method: 'POST',
    body: options.consentToRecording ? { consentToRecording: true } : undefined,
  });
}

export async function cancelReserveRoom(roomId: string): Promise<ReservationResponse> {
  return request<ReservationResponse>(`/rooms/${seg(roomId)}/reserve`, { method: 'DELETE' });
}

export async function disconnectRoom(roomId: string): Promise<void> {
  await request<unknown>(`/rooms/${seg(roomId)}/disconnect`, { method: 'POST' });
}

// ---------- WebRTC signaling ----------

export async function sendOffer(roomId: string, sdp: string): Promise<{ sdp: string }> {
  return request<{ sdp: string }>('/webrtc', {
    method: 'POST',
    query: { roomId },
    body: { type: 'offer', sdp },
  });
}

/** Only forwards the fields the backend understands (same as the web client). */
export async function sendICECandidate(roomId: string, candidate: RTCIceCandidateInit): Promise<void> {
  const safeCandidate: Record<string, unknown> = { candidate: candidate.candidate };

  if (typeof candidate.sdpMid === 'string') safeCandidate.sdpMid = candidate.sdpMid;
  if (typeof candidate.sdpMLineIndex === 'number') safeCandidate.sdpMLineIndex = candidate.sdpMLineIndex;
  if (typeof candidate.usernameFragment === 'string') safeCandidate.usernameFragment = candidate.usernameFragment;

  await request<unknown>('/ice', { method: 'POST', query: { roomId }, body: safeCandidate });
}

export interface RenegotiationOffer {
  type: 'offer';
  sdp: string;
}

/** Resolves null when no renegotiation is pending (HTTP 204). */
export async function fetchRenegotiationOffer(roomId: string): Promise<RenegotiationOffer | null> {
  const offer = await request<RenegotiationOffer | null>('/webrtc/offers/next', { query: { roomId } });
  return offer?.sdp ? offer : null;
}

export async function sendRenegotiationAnswer(roomId: string, sdp: string): Promise<void> {
  await request<unknown>('/webrtc/answer', {
    method: 'POST',
    query: { roomId },
    body: { type: 'answer', sdp },
  });
}

// ---------- HLS ----------

export function getHLSUrl(roomId: string): string {
  return `${envConfig.apiBaseUrl.replace(/\/+$/, '')}/hls/${seg(roomId)}/master.m3u8`;
}

// ---------- Chat ----------

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
}

export const MAX_CHAT_MESSAGE_LENGTH = 500;

export async function getChatMessages(roomId: string): Promise<ChatMessage[]> {
  const messages = await request<ChatMessage[] | null>(`/rooms/${seg(roomId)}/chat`);
  return Array.isArray(messages) ? messages : [];
}

export async function postChatMessage(roomId: string, message: string): Promise<void> {
  const text = message.trim();
  if (!text) return;
  await request<unknown>(`/rooms/${seg(roomId)}/chat`, {
    method: 'POST',
    body: { message: text.slice(0, MAX_CHAT_MESSAGE_LENGTH) },
  });
}
