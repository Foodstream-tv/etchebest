/**
 * API base URL resolution.
 *
 * In development the phone must reach the backend through the dev machine's LAN address, which changes
 * with every network. Metro already knows that address (`hostUri`, e.g. "192.168.1.40:8082"), so a
 * local-network API url is rebuilt from it instead of being read from a `.env` that goes stale.
 */

const LOCAL_NETWORK_HOST =
  /^(localhost|127(\.\d{1,3}){3}|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|[^.]+\.local)$/i;

const URL_PARTS = /^(https?:\/\/)([^/:]+)(:\d+)?(\/.*)?$/i;

export const DEFAULT_DEV_API_PORT = 8081;

/** localhost, loopback, RFC1918 private ranges and `*.local` names. */
export function isLocalNetworkHost(host: string): boolean {
  return LOCAL_NETWORK_HOST.test(host);
}

/** Host part of Metro's `hostUri` ("192.168.1.40:8082" or "exp://192.168.1.40:8082"), or null. */
export function hostFromHostUri(hostUri: string | null | undefined): string | null {
  if (!hostUri) return null;
  const withoutScheme = hostUri.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const host = withoutScheme.split('/')[0].split(':')[0].trim();
  return host || null;
}

type ResolveOptions = {
  /** EXPO_PUBLIC_API_BASE_URL */
  configured?: string | null;
  hostUri?: string | null;
  isDev: boolean;
  platform: string;
};

export function resolveApiBaseUrl({ configured, hostUri, isDev, platform }: ResolveOptions): string {
  const explicit = configured?.trim() || '';
  const metroHost = isDev ? hostFromHostUri(hostUri) : null;

  if (!metroHost) {
    // Release builds never fall back to localhost (it would fail silently everywhere).
    return explicit || (isDev ? `http://localhost:${DEFAULT_DEV_API_PORT}/api` : '');
  }

  // The Android emulator reaches the dev machine at 10.0.2.2; its own "localhost" is the emulator.
  const devHost = platform === 'android' && /^(localhost|127(\.\d{1,3}){3})$/.test(metroHost) ? '10.0.2.2' : metroHost;

  if (!explicit) return `http://${devHost}:${DEFAULT_DEV_API_PORT}/api`;

  const parts = URL_PARTS.exec(explicit);
  // A remote API (https://api.example.com/api) is kept as is; a local-network one follows Metro's address.
  if (!parts || !isLocalNetworkHost(parts[2])) return explicit;
  const [, scheme, , port = '', path = ''] = parts;
  return `${scheme}${devHost}${port}${path}`;
}
