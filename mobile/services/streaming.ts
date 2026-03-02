import envConfig from '../config/env';
import auth from './auth';

const BASE_URL = envConfig.apiBaseUrl;

async function authHeaders(): Promise<Record<string, string>> {
    const token = await auth.getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

// ---------- Room endpoints ----------

export interface CreateRoomResponse {
    roomId: string;
    message: string;
}

export async function createRoom(name: string): Promise<CreateRoomResponse> {
    const res = await fetch(`${BASE_URL}/rooms`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ name }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create room (${res.status})`);
    }
    return res.json();
}

export async function reserveRoom(roomId: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/rooms/${roomId}/reserve`, {
        method: 'POST',
        headers: await authHeaders(),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to reserve room (${res.status})`);
    }
    return res.json();
}

export async function disconnectRoom(roomId: string): Promise<void> {
    await fetch(`${BASE_URL}/rooms/${roomId}/disconnect`, {
        method: 'POST',
        headers: await authHeaders(),
    });
}

export interface RoomInfo {
    id: string;
    name: string;
    host: string;
    participants: string[];
    viewers: number;
    maxParticipants: number;
}

export async function getRooms(): Promise<RoomInfo[]> {
    const res = await fetch(`${BASE_URL}/rooms`, {
        method: 'GET',
        headers: await authHeaders(),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch rooms (${res.status})`);
    }
    return res.json();
}

// ---------- WebRTC signaling ----------

export async function sendOffer(
    roomId: string,
    sdp: string
): Promise<{ sdp: string }> {
    const res = await fetch(`${BASE_URL}/webrtc?roomId=${roomId}`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ type: 'offer', sdp }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `SDP exchange failed (${res.status})`);
    }
    return res.json();
}

export async function sendICECandidate(
    roomId: string,
    candidate: RTCIceCandidateInit
): Promise<void> {
    const res = await fetch(`${BASE_URL}/ice?roomId=${roomId}`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(candidate),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `ICE candidate failed (${res.status})`);
    }
}

// ---------- HLS ----------

export function getHLSUrl(roomId: string): string {
    return `${BASE_URL}/hls/${roomId}/index.m3u8`;
}
