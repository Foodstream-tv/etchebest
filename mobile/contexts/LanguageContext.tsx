import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import en from '@/i18n/messages/en';
import fr from '@/i18n/messages/fr';
import languageService, { Locale } from '@/services/language';

type TranslationKey = keyof typeof fr;

type TranslationValues = Record<string, string | number>;

type LanguageContextValue = {
    locale: Locale;
    setLocale: (nextLocale: Locale) => Promise<void>;
    t: (key: TranslationKey, values?: TranslationValues) => string;
};

const translations = {
    fr,
    en,
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const interpolate = (template: string, values?: TranslationValues): string => {
    if (!values) {
        return template;
    }

    return Object.entries(values).reduce((result, [name, value]) => {
        return result.replaceAll(`{${name}}`, String(value));
    }, template);
};

export function LanguageProvider({ children }: Readonly<{ children: React.ReactNode }>) {
    const [currentLocale, setCurrentLocale] = useState<Locale>('fr');

    useEffect(() => {
        languageService.getLanguage().then(setCurrentLocale).catch(() => {
            setCurrentLocale('fr');
        });
    }, []);

    const setLocale = useCallback(async (nextLocale: Locale) => {
        setCurrentLocale(nextLocale);
        await languageService.setLanguage(nextLocale);
    }, []);

    const t = useCallback((key: TranslationKey, values?: TranslationValues): string => {
        const message = translations[currentLocale][key] ?? fr[key] ?? String(key);
        return interpolate(message, values);
    }, [currentLocale]);

    const value = useMemo(() => ({
        locale: currentLocale,
        setLocale,
        t,
    }), [currentLocale, setLocale, t]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useI18n must be used inside LanguageProvider');
    }
    return context;
}
