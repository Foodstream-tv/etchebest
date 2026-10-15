import authService from './auth';
import { getLives } from './lives';
import { request } from './http';
import { createRoom, disconnectRoom } from './streaming';
import type { MarmitonRecipe } from '@/utils/studioRecipe';

/** Backend limit of `POST /uploads/image` (same as the web Studio). */
export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 60_000;
const SCRAPE_TIMEOUT_MS = 25_000;

/** A picture chosen on the device (expo-image-picker asset, reduced to what the upload needs). */
export type PickedImage = {
    uri: string;
    name: string;
    mimeType: string;
    size?: number;
};

/** Imports a recipe page: the backend only accepts https://www.marmiton.org pages. */
export async function scrapeMarmiton(url: string): Promise<MarmitonRecipe> {
    return request<MarmitonRecipe>('/scrape/marmiton', {
        auth: 'optional',
        query: { url },
        timeoutMs: SCRAPE_TIMEOUT_MS,
    });
}

/** Uploads the thumbnail and returns the public path the live must reference (`/api/uploads/...`). */
export async function uploadThumbnail(image: PickedImage): Promise<string> {
    const form = new FormData();
    if (typeof document === 'undefined') {
        // React Native: the file is described by its uri, the native layer streams it.
        form.append('file', { uri: image.uri, name: image.name, type: image.mimeType } as unknown as Blob);
    } else {
        // Web: the picker returns an object/data url, turn it back into a Blob.
        const blob = await (await fetch(image.uri)).blob();
        form.append('file', blob, image.name);
    }
    const res = await request<{ url?: string }>('/uploads/image', { method: 'POST', body: form, timeoutMs: UPLOAD_TIMEOUT_MS });
    if (!res?.url) throw new Error('Aucune URL retournée après l’upload de l’image.');
    return res.url;
}

export type ScheduledLiveInput = {
    title: string;
    description: string;
    tags: string[];
    level: string;
    durationMinutes: number;
    thumbnailUrl?: string;
    /** RFC 3339 */
    scheduledAt: string;
};

/** Creates a scheduled live (no camera involved); returns the room id. */
export async function scheduleLive(input: ScheduledLiveInput): Promise<string> {
    const { roomId } = await createRoom(input.title, {
        title: input.title,
        description: input.description,
        tags: input.tags,
        level: input.level,
        durationMinutes: input.durationMinutes,
        thumbnailUrl: input.thumbnailUrl,
        status: 'scheduled',
        scheduledAt: input.scheduledAt,
    });
    return roomId;
}

/**
 * Escape hatch of the "you already have an active live" conflict (same as the web Studio):
 * finds the signed-in user's live in progress and closes it. Returns false when there is none.
 */
export async function stopMyActiveLive(): Promise<boolean> {
    const user = await authService.getUser();
    if (!user?.id) return false;
    const page = await getLives({ status: 'live', limit: 100 });
    const mine = page.lives.find((live) => live.user?.id === user.id);
    if (!mine) return false;
    await disconnectRoom(mine.room_id);
    return true;
}
