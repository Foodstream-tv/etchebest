import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Key/value storage shared by every service: SecureStore on native,
 * localStorage on web. Every call swallows storage failures (private mode,
 * keychain unavailable…) so callers never crash because of persistence.
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return globalThis.localStorage?.getItem(key) ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore: persistence is best-effort
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore: persistence is best-effort
    }
  },
};

export default storage;
