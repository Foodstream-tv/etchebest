/** `__DEV__` and the env var are read at import time: load a fresh copy of the module per case. */
function loadConfig(options: { dev: boolean; apiUrl?: string }) {
    const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    const previousUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    (globalThis as { __DEV__?: boolean }).__DEV__ = options.dev;
    if (options.apiUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = options.apiUrl;

    try {
        let loaded: typeof import('../env').default | undefined;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            loaded = require('../env').default;
        });
        return loaded!;
    } finally {
        (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
        if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
        else process.env.EXPO_PUBLIC_API_BASE_URL = previousUrl;
    }
}

describe('config/env apiBaseUrl', () => {
    let consoleError: jest.SpyInstance;
    beforeEach(() => {
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => consoleError.mockRestore());

    it('uses the configured url', () => {
        expect(loadConfig({ dev: false, apiUrl: ' https://api.foodstream.tv/api ' }).apiBaseUrl).toBe('https://api.foodstream.tv/api');
    });

    it('falls back to localhost in development only', () => {
        expect(loadConfig({ dev: true }).apiBaseUrl).toBe('http://localhost:8081/api');
    });

    it('does not silently target localhost in a release build without a configured url', () => {
        expect(loadConfig({ dev: false }).apiBaseUrl).toBe('');
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('EXPO_PUBLIC_API_BASE_URL'));
    });
});
