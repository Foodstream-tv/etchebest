import { ApiError, NetworkError, UnauthorizedError } from '@/services/http';

import { classifyError, describeError, ERROR_MESSAGE_KEYS } from '../errorMessage';

describe('utils/errorMessage', () => {
    it.each([
        [new NetworkError('x', 'offline'), 'offline'],
        [new NetworkError('x', 'timeout'), 'timeout'],
        [new UnauthorizedError(), 'unauthorized'],
        [new ApiError('x', 401, null), 'unauthorized'],
        [new ApiError('x', 403, null), 'forbidden'],
        [new ApiError('x', 404, null), 'notFound'],
        [new ApiError('x', 429, null), 'rateLimited'],
        [new ApiError('x', 500, null), 'server'],
        [new ApiError('x', 503, null), 'server'],
        [new ApiError('x', 400, null), 'unknown'],
        [new Error('boom'), 'unknown'],
        ['string', 'unknown'],
        [undefined, 'unknown'],
    ])('classifies %p as %s', (error, kind) => {
        expect(classifyError(error)).toBe(kind);
    });

    it('only blames the connection for real network failures', () => {
        const t = (key: string) => key;
        expect(describeError(new NetworkError('x', 'offline'), t)).toBe(ERROR_MESSAGE_KEYS.offline);
        expect(describeError(new ApiError('Erreur 404', 404, null), t)).toBe(ERROR_MESSAGE_KEYS.notFound);
        expect(describeError(new ApiError('Erreur 500', 500, null), t)).toBe(ERROR_MESSAGE_KEYS.server);
    });
});
