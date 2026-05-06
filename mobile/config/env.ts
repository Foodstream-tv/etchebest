export const config = {
  // API
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8081/api',
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
