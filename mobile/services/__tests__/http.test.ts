import envConfig from '../../config/env';
import authService from '../auth';
import { ApiError, buildQuery, request, seg, UnauthorizedError } from '../http';
import { onSessionTerminated, SessionTerminationDetail } from '../session';

jest.mock('../auth', () => ({
    __esModule: true,
    default: {
        getToken: jest.fn(),
        logout: jest.fn(() => Promise.resolve()),
    },
}));

const mockedAuth = authService as unknown as { getToken: jest.Mock; logout: jest.Mock };

function jsonResponse(status: number, body: unknown): Response {
    const text = body === undefined ? '' : JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        text: () => Promise.resolve(text),
    } as unknown as Response;
}

describe('services/http', () => {
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

    afterEach(() => {
        unsubscribe();
    });

    describe('seg / buildQuery', () => {
        it('encodes path segments so they cannot alter the route', () => {
            expect(seg('a/b?c=d#e')).toBe('a%2Fb%3Fc%3Dd%23e');
            expect(seg('../../admin')).toBe('..%2F..%2Fadmin');
            expect(seg(42)).toBe('42');
        });

        it('drops empty values and repeats arrays', () => {
            expect(buildQuery({ q: 'ramen', tag: ['Asiatique', 'BBQ'], status: undefined, page: 2, empty: '', none: null })).toBe(
                '?q=ramen&tag=Asiatique&tag=BBQ&page=2'
            );
            expect(buildQuery({})).toBe('');
            expect(buildQuery(undefined)).toBe('');
        });

        it('url-encodes values', () => {
            expect(buildQuery({ q: 'a&b=c' })).toBe('?q=a%26b%3Dc');
        });
    });

    describe('request', () => {
        it('sends the bearer token and JSON body, and unwraps the { data } envelope', async () => {
            fetchMock.mockResolvedValue(jsonResponse(200, { data: { id: 1 } }));

            const result = await request<{ id: number }>('/rooms', { method: 'POST', body: { name: 'x' } });

            expect(result).toEqual({ id: 1 });
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe(`${envConfig.apiBaseUrl}/rooms`);
            expect(init.method).toBe('POST');
            expect(init.headers.Authorization).toBe('Bearer tok');
            expect(init.headers['Content-Type']).toBe('application/json');
            expect(init.body).toBe(JSON.stringify({ name: 'x' }));
        });

        it('sends FormData as multipart: no JSON Content-Type (fetch adds the boundary), body untouched', async () => {
            fetchMock.mockResolvedValue(jsonResponse(200, { url: '/api/uploads/a.jpg' }));
            const form = new FormData();
            form.append('file', 'x');

            await request('/uploads/image', { method: 'POST', body: form });

            const [, init] = fetchMock.mock.calls[0];
            expect(init.body).toBe(form);
            expect(init.headers['Content-Type']).toBeUndefined();
            expect(init.headers.Authorization).toBe('Bearer tok');
        });

        it('does not unwrap arrays or payloads without data', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ id: 1 }]));
            await expect(request('/rooms')).resolves.toEqual([{ id: 1 }]);
            fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: 'abc' }));
            await expect(request('/login', { auth: 'none' })).resolves.toEqual({ token: 'abc' });
        });

        it('returns null for an empty body (204)', async () => {
            fetchMock.mockResolvedValue(jsonResponse(204, undefined));
            await expect(request('/webrtc/offers/next')).resolves.toBeNull();
        });

        it('throws UnauthorizedError without calling the network when a token is required but missing', async () => {
            mockedAuth.getToken.mockResolvedValue(null);
            await expect(request('/rooms')).rejects.toBeInstanceOf(UnauthorizedError);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('works signed out for optional auth and never sends a token for auth: none', async () => {
            mockedAuth.getToken.mockResolvedValue(null);
            fetchMock.mockResolvedValue(jsonResponse(200, { lives: [] }));
            await request('/lives', { auth: 'optional' });
            expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();

            mockedAuth.getToken.mockResolvedValue('tok');
            await request('/login', { auth: 'none', method: 'POST', body: {} });
            expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
        });

        it('prefers an explicit token over the stored one', async () => {
            fetchMock.mockResolvedValue(jsonResponse(200, {}));
            await request('/users/me', { token: 'fresh' });
            expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer fresh');
            expect(mockedAuth.getToken).not.toHaveBeenCalled();
        });

        it('throws ApiError carrying status and body', async () => {
            fetchMock.mockResolvedValue(jsonResponse(403, { error: 'your account is not verified yet', code: 'ACCOUNT_NOT_VERIFIED', userId: 'u1' }));

            const error: any = await request<unknown>('/login', { auth: 'none', method: 'POST', body: {} }).catch((e: unknown) => e as any);

            expect(error).toBeInstanceOf(ApiError);
            expect(error.status).toBe(403);
            expect(error.message).toBe('your account is not verified yet');
            expect(error.body.code).toBe('ACCOUNT_NOT_VERIFIED');
            expect(events).toEqual([]);
        });

        it('signs out and emits "revoked" on 401 for an authenticated request', async () => {
            fetchMock.mockResolvedValue(jsonResponse(401, { error: 'invalid token' }));

            await expect(request('/rooms')).rejects.toBeInstanceOf(ApiError);

            expect(mockedAuth.logout).toHaveBeenCalledTimes(1);
            expect(events).toEqual([{ reason: 'revoked' }]);
        });

        it('does NOT sign out on 401 from /login (wrong password)', async () => {
            fetchMock.mockResolvedValue(jsonResponse(401, { error: 'invalid email or password' }));

            await expect(request('/login', { auth: 'none', method: 'POST', body: {} })).rejects.toThrow('invalid email or password');

            expect(mockedAuth.logout).not.toHaveBeenCalled();
            expect(events).toEqual([]);
        });

        it('signs out and emits "banned" with the ban details on the banned 403', async () => {
            fetchMock.mockResolvedValue(
                jsonResponse(403, { error: 'your account is banned', banReason: 'spam', bannedUntil: '2030-01-01T00:00:00Z' })
            );

            await expect(request('/rooms')).rejects.toBeInstanceOf(ApiError);

            expect(mockedAuth.logout).toHaveBeenCalledTimes(1);
            expect(events).toEqual([{ reason: 'banned', banReason: 'spam', bannedUntil: '2030-01-01T00:00:00Z' }]);
        });

        it('falls back to a generic message when the error body is not JSON', async () => {
            fetchMock.mockResolvedValue({ ok: false, status: 502, text: () => Promise.resolve('<html>bad gateway</html>') });
            await expect(request('/rooms', { auth: 'optional' })).rejects.toThrow('Erreur 502');
        });

        it('maps network failures to a friendly message without leaking internals', async () => {
            fetchMock.mockRejectedValue(new TypeError('Network request failed: http://10.0.0.1:8081'));
            const error: any = await request<unknown>('/rooms').catch((e: unknown) => e as any);
            expect(error.message).toBe('Erreur réseau. Vérifiez votre connexion ou réessayez plus tard.');
            expect(error.message).not.toContain('10.0.0.1');
        });

        it('aborts and reports a timeout', async () => {
            jest.useFakeTimers();
            try {
                fetchMock.mockImplementation(
                    (_url: string, init: RequestInit) =>
                        new Promise((_resolve, reject) => {
                            init.signal?.addEventListener('abort', () => {
                                const abort = new Error('aborted');
                                abort.name = 'AbortError';
                                reject(abort);
                            });
                        })
                );
                const pending = request<unknown>('/rooms', { timeoutMs: 50 }).catch((e: unknown) => e as any);
                await jest.advanceTimersByTimeAsync(60);
                const error: any = await pending;
                expect(error.message).toBe('La requête a expiré. Vérifiez votre connexion.');
            } finally {
                jest.useRealTimers();
            }
        });
    });
});

describe('services/http without an API url', () => {
    it('fails with an explicit configuration error instead of calling a wrong host', async () => {
        jest.resetModules();
        jest.doMock('../../config/env', () => ({ __esModule: true, default: { apiBaseUrl: '', apiTimeout: 1000 } }));
        jest.doMock('../auth', () => ({ __esModule: true, default: { getToken: jest.fn(), logout: jest.fn() } }));
        const fetchSpy = jest.fn();
        (globalThis as any).fetch = fetchSpy;

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { request: isolatedRequest } = require('../http');
        await expect(isolatedRequest('/lives', { auth: 'none' })).rejects.toThrow(/EXPO_PUBLIC_API_BASE_URL/);
        expect(fetchSpy).not.toHaveBeenCalled();

        jest.dontMock('../../config/env');
        jest.dontMock('../auth');
    });
});
