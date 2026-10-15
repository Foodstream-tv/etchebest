import apiService from '../api';
import { request } from '../http';

jest.mock('../http', () => ({
    ...jest.requireActual('../http'),
    request: jest.fn(),
}));

const mockedRequest = request as jest.Mock;

const base = {
    email: ' Test@Example.com ',
    password: 'password',
    username: ' johnny ',
    firstName: ' John ',
    lastName: ' Doe ',
    profileImage: '',
    ageConfirmed: true,
};

describe('apiService.register', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sends ageConfirmed and omits the empty optional fields', async () => {
        mockedRequest.mockResolvedValue({ message: 'ok', userId: 'u', target: 'x' });
        await apiService.register({ ...base, description: '  ', numberPhone: ' ', countryNumberPhone: 33 });

        const [path, options] = mockedRequest.mock.calls[0];
        expect(path).toBe('/register');
        // The body is JSON.stringify-ed by http.ts: undefined values never reach the server.
        const sent = JSON.parse(JSON.stringify(options.body));
        expect(sent).toEqual({
            email: 'test@example.com',
            password: 'password',
            username: 'johnny',
            firstName: 'John',
            lastName: 'Doe',
            profileImage: '',
            ageConfirmed: true,
        });
    });

    it('keeps trimmed phone and bio when provided', async () => {
        mockedRequest.mockResolvedValue({ message: 'ok', userId: 'u', target: 'x' });
        await apiService.register({ ...base, description: ' hello ', numberPhone: ' 0612345678 ', countryNumberPhone: 33 });

        const sent = JSON.parse(JSON.stringify(mockedRequest.mock.calls[0][1].body));
        expect(sent).toMatchObject({ description: 'hello', numberPhone: '0612345678', countryNumberPhone: 33 });
    });
});
