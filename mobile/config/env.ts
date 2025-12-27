export const config = {
  // API
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8081/api',
  apiTimeout: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '10000', 10),

  // Auth storage keys
  tokenKey: process.env.EXPO_PUBLIC_TOKEN_KEY || 'auth_token',
  userKey: process.env.EXPO_PUBLIC_USER_KEY || 'auth_user',
} as const;

export default config;
