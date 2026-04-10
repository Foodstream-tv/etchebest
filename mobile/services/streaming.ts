import envConfig from '../config/env';
import auth from './auth';

const BASE_URL = envConfig.apiBaseUrl;

export class UnauthorizedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

async function requireAuthHeaders(): Promise<Record<string, string>> {
    const token = await auth.getToken();
    if (!token) {
        throw new UnauthorizedError('Vous devez vous connecter pour accéder aux lives.');
    }

    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}

async function throwIfUnauthorized(res: Response): Promise<void> {
    if (res.status === 401) {
        await auth.logout();
        throw new UnauthorizedError('Session expirée. Reconnectez-vous pour continuer.');
    }
}

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
    const err = await res.json().catch(() => ({}));
    return err.error || fallback;
}

async function authHeaders(): Promise<Record<string, string>> {
    return requireAuthHeaders();
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
    await throwIfUnauthorized(res);
    if (!res.ok) {
        throw new Error(await getErrorMessage(res, `Failed to create room (${res.status})`));
    }
    return res.json();
}

export async function reserveRoom(roomId: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/rooms/${roomId}/reserve`, {
        method: 'POST',
        headers: await authHeaders(),
    });
    await throwIfUnauthorized(res);
    if (!res.ok) {
        throw new Error(await getErrorMessage(res, `Failed to reserve room (${res.status})`));
    }
    return res.json();
}

export async function disconnectRoom(roomId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/rooms/${roomId}/disconnect`, {
        method: 'POST',
        headers: await authHeaders(),
    });
    await throwIfUnauthorized(res);
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
    await throwIfUnauthorized(res);
    if (!res.ok) {
        throw new Error(await getErrorMessage(res, `Failed to fetch rooms (${res.status})`));
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
    await throwIfUnauthorized(res);
    if (!res.ok) {
        throw new Error(await getErrorMessage(res, `SDP exchange failed (${res.status})`));
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
    await throwIfUnauthorized(res);
    if (!res.ok) {
        throw new Error(await getErrorMessage(res, `ICE candidate failed (${res.status})`));
    }
}

export interface RenegotiationOffer {
    type: 'offer';
    sdp: string;
}

export async function fetchRenegotiationOffer(roomId: string): Promise<RenegotiationOffer | null> {
    const res = await fetch(`${BASE_URL}/webrtc/offers/next?roomId=${roomId}`, {
        method: 'GET',
        headers: await authHeaders(),
    });
    await throwIfUnauthorized(res);

    if (res.status === 204) {
        return null;
    }

    if (!res.ok) {
        throw new Error(await getErrorMessage(res, `Renegotiation poll failed (${res.status})`));
    }

    return res.json();
}

export async function sendRenegotiationAnswer(roomId: string, sdp: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/webrtc/answer?roomId=${roomId}`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ type: 'answer', sdp }),
    });
    await throwIfUnauthorized(res);
    if (!res.ok) {
        throw new Error(await getErrorMessage(res, `Renegotiation answer failed (${res.status})`));
    }
}

// ---------- HLS ----------

export function getHLSUrl(roomId: string): string {
    return `${BASE_URL}/hls/${roomId}/index.m3u8`;
}
