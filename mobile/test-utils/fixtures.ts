import { LiveDTO } from '@/services/lives';

let counter = 0;

/** Minimal LiveDTO factory for tests. */
export function makeLive(overrides: Partial<LiveDTO> = {}): LiveDTO {
    counter += 1;
    return {
        id: counter,
        room_id: `room-${counter}`,
        title: `Live ${counter}`,
        status: 'live',
        created_at: '2030-01-01T10:00:00Z',
        current_viewers: 3,
        view_count: 10,
        user: { id: `user-${counter}`, username: `chef${counter}` },
        ...overrides,
    };
}
