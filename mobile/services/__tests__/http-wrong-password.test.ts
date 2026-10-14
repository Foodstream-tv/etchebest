import authService from '../auth';
import { ApiError, request } from '../http';
import { onSessionTerminated, SessionTerminationDetail } from '../session';

jest.mock('../auth', () => ({
    __esModule: true,
    default: {
        getToken: jest.fn(),
        logout: jest.fn(() => Promise.resolve()),
    },
}));

const mockedAuth = authService as unknown as { getToken: jest.Mock; logout: jest.Mock };

const jsonResponse = (status: number, body: unknown) =>
    ({ ok: false, status, text: () => Promise.resolve(JSON.stringify(body)) }) as unknown as Response;

describe('services/http: wrong current password', () => {
    const fetchMock = jest.fn();
    let events: SessionTerminationDetail[];
    let unsubscribe: () => void;

    beforeEach(() => {
        jest.clearAllMocks();
        (globalThis as any).fetch = fetchMock;
        mockedAuth.getToken.mockResolvedValue('tok');
        events = [];
        unsubscribe = onSessionTerminated((detail) => events.push(detail));
    });

    afterEach(() => unsubscribe());

    it('keeps the session when PATCH /users/me/password answers 401 "invalid current password"', async () => {
        fetchMock.mockResolvedValue(jsonResponse(401, { error: 'invalid current password' }));

        await expect(request('/users/me/password', { method: 'PATCH', body: {} })).rejects.toBeInstanceOf(ApiError);

        expect(mockedAuth.logout).not.toHaveBeenCalled();
        expect(events).toEqual([]);
    });

    it('still signs out on any other 401', async () => {
        fetchMock.mockResolvedValue(jsonResponse(401, { error: 'invalid token' }));

        await expect(request('/users/me/password', { method: 'PATCH', body: {} })).rejects.toBeInstanceOf(ApiError);

        expect(mockedAuth.logout).toHaveBeenCalledTimes(1);
        expect(events).toEqual([{ reason: 'revoked' }]);
    });
});
