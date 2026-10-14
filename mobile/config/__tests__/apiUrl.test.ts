import { hostFromHostUri, isLocalNetworkHost, resolveApiBaseUrl } from '../apiUrl';

const dev = (overrides: Partial<Parameters<typeof resolveApiBaseUrl>[0]> = {}) =>
    resolveApiBaseUrl({ isDev: true, platform: 'ios', hostUri: '192.168.1.40:8082', ...overrides });

describe('config/apiUrl', () => {
    describe('isLocalNetworkHost', () => {
        it.each(['localhost', '127.0.0.1', '10.0.2.2', '10.68.237.224', '192.168.1.40', '172.16.0.5', '172.31.255.1', 'macbook.local'])(
            'treats %s as local',
            (host) => expect(isLocalNetworkHost(host)).toBe(true)
        );
        it.each(['api.foodstream.tv', '8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.1.1', 'example.com'])('treats %s as remote', (host) =>
            expect(isLocalNetworkHost(host)).toBe(false)
        );
    });

    describe('hostFromHostUri', () => {
        it('extracts the host with or without port and scheme', () => {
            expect(hostFromHostUri('192.168.1.40:8082')).toBe('192.168.1.40');
            expect(hostFromHostUri('exp://192.168.1.40:8082')).toBe('192.168.1.40');
            expect(hostFromHostUri('localhost')).toBe('localhost');
        });
        it('returns null when there is nothing usable', () => {
            expect(hostFromHostUri(undefined)).toBeNull();
            expect(hostFromHostUri('')).toBeNull();
            expect(hostFromHostUri(':8082')).toBeNull();
        });
    });

    describe('in development', () => {
        it('builds the url from Metro\'s address when nothing is configured', () => {
            expect(dev()).toBe('http://192.168.1.40:8081/api');
        });

        it('makes a stale LAN ip in .env harmless: it follows Metro\'s current address', () => {
            expect(dev({ configured: 'http://10.68.237.224:8081/api' })).toBe('http://192.168.1.40:8081/api');
            expect(dev({ configured: 'http://localhost:9000/api' })).toBe('http://192.168.1.40:9000/api');
        });

        it('keeps a remote API untouched', () => {
            expect(dev({ configured: 'https://api.foodstream.tv/api' })).toBe('https://api.foodstream.tv/api');
        });

        it('reaches the dev machine at 10.0.2.2 from the Android emulator when Metro says localhost', () => {
            expect(dev({ platform: 'android', hostUri: 'localhost:8082' })).toBe('http://10.0.2.2:8081/api');
            expect(dev({ platform: 'ios', hostUri: 'localhost:8082' })).toBe('http://localhost:8081/api');
            expect(dev({ platform: 'android', hostUri: '192.168.1.40:8082' })).toBe('http://192.168.1.40:8081/api');
        });

        it('falls back to the configured url, then to localhost, without Metro\'s address', () => {
            expect(dev({ hostUri: undefined, configured: 'http://192.168.1.99:8081/api' })).toBe('http://192.168.1.99:8081/api');
            expect(dev({ hostUri: undefined })).toBe('http://localhost:8081/api');
        });

        it('ignores a malformed configured url instead of crashing', () => {
            expect(dev({ configured: 'not a url' })).toBe('not a url');
        });
    });

    describe('in a release build', () => {
        const release = (configured?: string) => resolveApiBaseUrl({ isDev: false, platform: 'android', hostUri: '192.168.1.40:8082', configured });

        it('uses the configured url and ignores Metro', () => {
            expect(release('https://api.foodstream.tv/api')).toBe('https://api.foodstream.tv/api');
            expect(release('http://192.168.1.99:8081/api')).toBe('http://192.168.1.99:8081/api');
        });

        it('never falls back to localhost', () => {
            expect(release()).toBe('');
            expect(release('  ')).toBe('');
        });
    });
});
