import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type Locale = 'fr' | 'en';

const LANGUAGE_KEY = 'app_language';

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
};

class LanguageService {
    private locale: Locale | null = null;

    async getLanguage(): Promise<Locale> {
        if (this.locale) {
            return this.locale;
        }

        const stored = await storage.getItem(LANGUAGE_KEY);
        const resolved: Locale = stored === 'en' ? 'en' : 'fr';
        this.locale = resolved;
        return resolved;
    }

    async setLanguage(locale: Locale): Promise<void> {
        this.locale = locale;
        await storage.setItem(LANGUAGE_KEY, locale);
    }
}

const languageService = new LanguageService();

export default languageService;
