const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

// `localhost` is only a development convenience. A release build that was made without
// EXPO_PUBLIC_API_BASE_URL must not silently talk to localhost (every request would fail, cleartext
// being blocked anyway): it has no API URL and requests fail with an explicit configuration error.
const apiBaseUrl = configuredApiBaseUrl || (__DEV__ ? 'http://localhost:8081/api' : '');

if (!__DEV__ && !apiBaseUrl) {
  console.error('EXPO_PUBLIC_API_BASE_URL is not set: set it in the EAS build profile (https URL).');
}

export const config = {
  // API
  apiBaseUrl,
  apiTimeout: Number.parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '10000', 10),

  // Auth storage keys
  tokenKey: process.env.EXPO_PUBLIC_TOKEN_KEY || 'auth_token',
  userKey: process.env.EXPO_PUBLIC_USER_KEY || 'auth_user',

  // Google OAuth
  googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '180195435704-86emi3b8kkgprqsc8d92sgcan08r7ni4.apps.googleusercontent.com',
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
  googleRedirectUri: process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || '',
} as const;

export default config;
