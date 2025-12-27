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
   * Store authentication data after successful login
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
   * Get the stored token (from memory or storage)
   */
  async getToken(): Promise<string | null> {
    if (this.token) return this.token;

    this.token = await storage.getItem(TOKEN_KEY);
    return this.token;
  }

  /**
   * Get the stored user
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
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  /**
   * Clear all auth data (logout)
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
