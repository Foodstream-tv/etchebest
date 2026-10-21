import envConfig from '../../config/env';
import { ApiError, request } from '../http';
import {
    createRoom,
    fetchRenegotiationOffer,
    getChatMessages,
    getHLSUrl,
    getRoom,
    getRooms,
    MAX_CHAT_MESSAGE_LENGTH,
    isRecordingConsentRequired,
    postChatMessage,
    reserveRoom,
    sendICECandidate,
    sendOffer,
} from '../streaming';

jest.mock('../http', () => ({
    ...jest.requireActual('../http'),
    request: jest.fn(),
}));

const mockedRequest = request as jest.Mock;

describe('services/streaming', () => {
    beforeEach(() => jest.clearAllMocks());

    it('builds an encoded HLS URL', () => {
        expect(getHLSUrl('room-1')).toBe(`${envConfig.apiBaseUrl}/hls/room-1/master.m3u8`);
        expect(getHLSUrl('../../etc/passwd')).toBe(`${envConfig.apiBaseUrl}/hls/..%2F..%2Fetc%2Fpasswd/master.m3u8`);
    });

    it('encodes room ids in every path', async () => {
        mockedRequest.mockResolvedValue({});
        await getRoom('x/y');
        expect(mockedRequest).toHaveBeenCalledWith('/rooms/x%2Fy');
    });

    it('returns [] when the backend answers null for rooms/chat', async () => {
        mockedRequest.mockResolvedValue(null);
        await expect(getRooms()).resolves.toEqual([]);
        await expect(getChatMessages('r')).resolves.toEqual([]);
    });

    it('sends the roomId as an encoded query parameter for signaling', async () => {
        mockedRequest.mockResolvedValue({ sdp: 'answer' });
        await sendOffer('r&evil=1', 'v=0');
        expect(mockedRequest).toHaveBeenCalledWith('/webrtc', {
            method: 'POST',
            query: { roomId: 'r&evil=1' },
            body: { type: 'offer', sdp: 'v=0' },
        });
    });

    it('only forwards known ICE candidate fields', async () => {
        mockedRequest.mockResolvedValue(undefined);
        await sendICECandidate('r', {
            candidate: 'candidate:1',
            sdpMid: '0',
            sdpMLineIndex: 0,
            usernameFragment: 'ufrag',
            // @ts-expect-error unknown field must not leak to the backend
            extra: 'nope',
        });
        expect(mockedRequest.mock.calls[0][1].body).toEqual({ candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'ufrag' });
    });

    it('resolves null when no renegotiation offer is pending', async () => {
        mockedRequest.mockResolvedValueOnce(null);
        await expect(fetchRenegotiationOffer('r')).resolves.toBeNull();
        mockedRequest.mockResolvedValueOnce({ type: 'offer', sdp: '' });
        await expect(fetchRenegotiationOffer('r')).resolves.toBeNull();
        mockedRequest.mockResolvedValueOnce({ type: 'offer', sdp: 'v=0' });
        await expect(fetchRenegotiationOffer('r')).resolves.toEqual({ type: 'offer', sdp: 'v=0' });
    });

    describe('reserveRoom', () => {
        it('sends the consent only when the person gave it', async () => {
            mockedRequest.mockResolvedValue({ reserved: true });
            await reserveRoom('r1');
            expect(mockedRequest).toHaveBeenLastCalledWith('/rooms/r1/reserve', { method: 'POST', body: undefined });
            await reserveRoom('r1', { consentToRecording: false });
            expect(mockedRequest).toHaveBeenLastCalledWith('/rooms/r1/reserve', { method: 'POST', body: undefined });
            await reserveRoom('r1', { consentToRecording: true });
            expect(mockedRequest).toHaveBeenLastCalledWith('/rooms/r1/reserve', { method: 'POST', body: { consentToRecording: true } });
        });

        it('recognizes the refusal that asks for the recording consent', () => {
            expect(isRecordingConsentRequired(new ApiError('x', 400, { code: 'RECORDING_CONSENT_REQUIRED' }))).toBe(true);
            expect(isRecordingConsentRequired(new ApiError('x', 400, { code: 'OTHER' }))).toBe(false);
            expect(isRecordingConsentRequired(new Error('x'))).toBe(false);
            expect(isRecordingConsentRequired(null)).toBe(false);
        });
    });

    describe('createRoom', () => {
        it('sends only the name when there are no options (backward compatible)', async () => {
            mockedRequest.mockResolvedValue({ roomId: 'r' });
            await createRoom('Ramen');
            expect(mockedRequest).toHaveBeenCalledWith('/rooms', { method: 'POST', body: { name: 'Ramen' } });
        });

        it('forwards title, description and non-empty tags', async () => {
            mockedRequest.mockResolvedValue({ roomId: 'r' });
            await createRoom('Ramen', { title: 'Ramen', description: 'desc', tags: ['Asiatique'] });
            expect(mockedRequest.mock.calls[0][1].body).toEqual({ name: 'Ramen', title: 'Ramen', description: 'desc', tags: ['Asiatique'] });

            await createRoom('x', { tags: [] });
            expect(mockedRequest.mock.calls[1][1].body).toEqual({ name: 'x' });
        });

        it('forwards the Studio fields: level, duration, thumbnail, status and schedule', async () => {
            mockedRequest.mockResolvedValue({ roomId: 'r' });
            await createRoom('Ramen', {
                title: 'Ramen',
                level: 'Avancé',
                durationMinutes: 45,
                thumbnailUrl: '/api/uploads/t.jpg',
                status: 'scheduled',
                scheduledAt: '2030-05-12T07:30:00.000Z',
            });
            expect(mockedRequest.mock.calls[0][1].body).toEqual({
                name: 'Ramen',
                title: 'Ramen',
                level: 'Avancé',
                durationMinutes: 45,
                thumbnailUrl: '/api/uploads/t.jpg',
                status: 'scheduled',
                scheduledAt: '2030-05-12T07:30:00.000Z',
            });
        });

        it('leaves out empty or zero Studio fields', async () => {
            mockedRequest.mockResolvedValue({ roomId: 'r' });
            await createRoom('x', { level: '', durationMinutes: 0, thumbnailUrl: '' });
            expect(mockedRequest.mock.calls[0][1].body).toEqual({ name: 'x' });
        });
    });

    describe('createRoom recordReplay', () => {
        it('only sends recordReplay when the host turned the replay off', async () => {
            mockedRequest.mockResolvedValue({ roomId: 'r' });
            await createRoom('Tarte', { recordReplay: false });
            expect(mockedRequest.mock.calls[0][1].body).toMatchObject({ recordReplay: false });
            await createRoom('Tarte', { recordReplay: true });
            expect(mockedRequest.mock.calls[1][1].body).not.toHaveProperty('recordReplay');
            await createRoom('Tarte');
            expect(mockedRequest.mock.calls[2][1].body).not.toHaveProperty('recordReplay');
        });
    });

    describe('postChatMessage', () => {
        it('trims and truncates to the max length', async () => {
            mockedRequest.mockResolvedValue(undefined);
            await postChatMessage('r', `  ${'a'.repeat(MAX_CHAT_MESSAGE_LENGTH + 50)}  `);
            expect(mockedRequest.mock.calls[0][1].body.message).toHaveLength(MAX_CHAT_MESSAGE_LENGTH);
        });

        it('ignores blank messages', async () => {
            await postChatMessage('r', '   ');
            expect(mockedRequest).not.toHaveBeenCalled();
        });
    });
});
