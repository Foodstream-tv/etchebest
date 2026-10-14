import storage from './storage';

export type Locale = 'fr' | 'en';

const LANGUAGE_KEY = 'app_language';


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
