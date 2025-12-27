import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import config from '../config/env';

const TOKEN_KEY = config.tokenKey;
const USER_KEY = config.userKey;

const storage = {
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export interface StoredUser {
  id: string;
  email: string;
  username: string;
}

class AuthService {
  private token: string | null = null;
  private user: StoredUser | null = null;

  /**
   * Store authentication data after successful login.
   * Saves the authentication token and optionally the user data to secure storage.
   * The token is stored in memory for quick access and persisted to storage for session recovery.
   * 
   * @param token - The JWT authentication token received from the server
   * @param user - Optional user data containing id, email, and username to be stored
   * @returns A promise that resolves when both token and user data are successfully saved
   * @throws {Error} May throw if storage operations fail (e.g., storage quota exceeded, permissions denied)
   * 
   * @example
   * ```typescript
   * await authService.saveAuth('eyJhbGciOiJIUzI1NiIs...', {
   *   id: '123',
   *   email: 'user@example.com',
   *   username: 'johndoe'
   * });
   * ```
   */
  async saveAuth(token: string, user?: StoredUser): Promise<void> {
    this.token = token;
    await storage.setItem(TOKEN_KEY, token);

    if (user) {
      this.user = user;
      await storage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  /**
   * Retrieve the stored authentication token.
   * First checks the in-memory cache for performance, then falls back to secure storage.
   * This method is used to authenticate API requests.
   * 
   * @returns A promise that resolves to the stored token string, or null if no token exists
   * @throws {Error} May throw if storage read operations fail
   * 
   * @example
   * ```typescript
   * const token = await authService.getToken();
   * if (token) {
   *   // Use token for authenticated API calls
   * }
   * ```
   */
  async getToken(): Promise<string | null> {
    if (this.token) return this.token;

    this.token = await storage.getItem(TOKEN_KEY);
    return this.token;
  }

  /**
   * Retrieve the stored user information.
   * First checks the in-memory cache, then attempts to retrieve and parse user data from storage.
   * If the stored data is corrupted, it will be cleared automatically and null will be returned.
   * 
   * @returns A promise that resolves to the StoredUser object containing id, email, and username, or null if no user data exists
   * @throws {Error} May throw if storage read operations fail (parsing errors are handled internally)
   * 
   * @example
   * ```typescript
   * const user = await authService.getUser();
   * if (user) {
   *   console.log(`Welcome back, ${user.username}!`);
   * }
   * ```
   */
  async getUser(): Promise<StoredUser | null> {
    if (this.user) return this.user;

    const userData = await storage.getItem(USER_KEY);
    if (userData) {
      try {
        this.user = JSON.parse(userData);
      } catch (error) {
        console.error('Failed to parse stored user data, clearing corrupted value.', error);
        this.user = null;
        await storage.removeItem(USER_KEY);
      }
    }
    return this.user;
  }

  /**
   * Check if the user is currently authenticated.
   * Determines authentication status by checking for the presence of a valid token.
   * This is a convenience method that wraps getToken() with a boolean result.
   * 
   * @returns A promise that resolves to true if a token exists, false otherwise
   * @throws {Error} May throw if token retrieval from storage fails
   * 
   * @example
   * ```typescript
   * if (await authService.isAuthenticated()) {
   *   // User is logged in, proceed to protected route
   * } else {
   *   // Redirect to login
   * }
   * ```
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  /**
   * Clear all authentication data and log the user out.
   * Removes the token and user data from both memory and secure storage.
   * This should be called when the user explicitly logs out or when the token is invalid.
   * 
   * @returns A promise that resolves when all auth data is successfully cleared
   * @throws {Error} May throw if storage removal operations fail
   * 
   * @example
   * ```typescript
   * await authService.logout();
   * // User is now logged out, redirect to login screen
   * ```
   */
  async logout(): Promise<void> {
    this.token = null;
    this.user = null;
    await storage.removeItem(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
  }
}

export const authService = new AuthService();
export default authService;
