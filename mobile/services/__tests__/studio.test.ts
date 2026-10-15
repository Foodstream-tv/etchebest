import authService from '../auth';
import { request } from '../http';
import { getLives } from '../lives';
import { createRoom, disconnectRoom } from '../streaming';
import { scheduleLive, scrapeMarmiton, stopMyActiveLive, uploadThumbnail } from '../studio';

jest.mock('../http', () => ({ ...jest.requireActual('../http'), request: jest.fn() }));
jest.mock('../auth', () => ({ __esModule: true, default: { getUser: jest.fn() } }));
jest.mock('../lives', () => ({ ...jest.requireActual('../lives'), getLives: jest.fn() }));
jest.mock('../streaming', () => ({ createRoom: jest.fn(), disconnectRoom: jest.fn() }));

const mockedRequest = request as jest.Mock;
const mockedGetUser = authService.getUser as jest.Mock;
const mockedGetLives = getLives as jest.Mock;
const mockedCreateRoom = createRoom as jest.Mock;
const mockedDisconnect = disconnectRoom as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('scrapeMarmiton', () => {
    it('asks the backend to import the page, with a longer timeout (external site)', async () => {
        mockedRequest.mockResolvedValue({ title: 'x' });
        await scrapeMarmiton('https://www.marmiton.org/r');
        expect(mockedRequest).toHaveBeenCalledWith('/scrape/marmiton', expect.objectContaining({ auth: 'optional', query: { url: 'https://www.marmiton.org/r' }, timeoutMs: 25_000 }));
    });
});

describe('uploadThumbnail', () => {
    it('posts the file as multipart (React Native file descriptor) and returns the public path', async () => {
        mockedRequest.mockResolvedValue({ url: '/api/uploads/a.jpg' });
        const url = await uploadThumbnail({ uri: 'file:///p.jpg', name: 'thumbnail.jpg', mimeType: 'image/jpeg' });

        expect(url).toBe('/api/uploads/a.jpg');
        const [path, options] = mockedRequest.mock.calls[0];
        expect(path).toBe('/uploads/image');
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
        expect(options.timeoutMs).toBeGreaterThan(10_000); // a 5 MB photo on a mobile network
    });

    it('fails when the backend answers without a url', async () => {
        mockedRequest.mockResolvedValue({});
        await expect(uploadThumbnail({ uri: 'file:///p.jpg', name: 'thumbnail.jpg', mimeType: 'image/jpeg' })).rejects.toThrow();
    });
});

describe('scheduleLive', () => {
    it('creates a room in "scheduled" status with the date and the Studio fields', async () => {
        mockedCreateRoom.mockResolvedValue({ roomId: 'room-1' });
        const id = await scheduleLive({
            title: 'Brunch',
            description: 'desc',
            tags: ['Français'],
            level: 'Débutant',
            durationMinutes: 60,
            thumbnailUrl: '/api/uploads/t.jpg',
            scheduledAt: '2030-05-12T07:30:00.000Z',
        });
        expect(id).toBe('room-1');
        expect(mockedCreateRoom).toHaveBeenCalledWith('Brunch', {
            title: 'Brunch',
            description: 'desc',
            tags: ['Français'],
            level: 'Débutant',
            durationMinutes: 60,
            thumbnailUrl: '/api/uploads/t.jpg',
            status: 'scheduled',
            scheduledAt: '2030-05-12T07:30:00.000Z',
        });
    });
});

describe('stopMyActiveLive', () => {
    it('closes the signed-in user live in progress', async () => {
        mockedGetUser.mockResolvedValue({ id: 'me' });
        mockedGetLives.mockResolvedValue({ lives: [{ room_id: 'other', user: { id: 'u2' } }, { room_id: 'mine', user: { id: 'me' } }] });
        await expect(stopMyActiveLive()).resolves.toBe(true);
        expect(mockedGetLives).toHaveBeenCalledWith({ status: 'live', limit: 100 });
        expect(mockedDisconnect).toHaveBeenCalledWith('mine');
    });

    it('does nothing (and says so) when the user has no live in progress', async () => {
        mockedGetUser.mockResolvedValue({ id: 'me' });
        mockedGetLives.mockResolvedValue({ lives: [{ room_id: 'other', user: { id: 'u2' } }] });
        await expect(stopMyActiveLive()).resolves.toBe(false);
        expect(mockedDisconnect).not.toHaveBeenCalled();
    });

    it('does nothing without a stored user', async () => {
        mockedGetUser.mockResolvedValue(null);
        await expect(stopMyActiveLive()).resolves.toBe(false);
        expect(mockedGetLives).not.toHaveBeenCalled();
    });
});
