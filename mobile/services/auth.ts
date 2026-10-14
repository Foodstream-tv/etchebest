import config from '../config/env';
import storage from './storage';

const TOKEN_KEY = config.tokenKey;
const USER_KEY = config.userKey;

export interface StoredUser {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  description?: string;
  profileImageUrl?: string;
  role?: string;
}

class AuthService {
  private token: string | null = null;
  private user: StoredUser | null = null;

  /**
   * Persists the session after a successful login/verification.
   * The token is kept in memory for fast access and in secure storage for session recovery.
   */
  async saveAuth(token: string, user?: StoredUser): Promise<void> {
    this.token = token;
    await storage.setItem(TOKEN_KEY, token);

    if (user) {
      this.user = user;
      await storage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  /** Stored token (memory first, then secure storage), or null when signed out. */
  async getToken(): Promise<string | null> {
    if (this.token) return this.token;

    this.token = await storage.getItem(TOKEN_KEY);
    return this.token;
  }

  /** Stored user; a corrupted value is dropped and null returned. */
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

  async isAuthenticated(): Promise<boolean> {
    return !!(await this.getToken());
  }

  /** Clears the session from memory and storage. */
  async logout(): Promise<void> {
    this.token = null;
    this.user = null;
    await storage.removeItem(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
  }
}

export const authService = new AuthService();
export default authService;
