"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import fr from "./messages/fr";
import en from "./messages/en";

export type Locale = "fr" | "en";
export type TranslationKey = keyof typeof fr;
export type TranslationValues = Record<string, string | number>;

type LanguageContextValue = {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
};

const translations: Record<Locale, Record<TranslationKey, string>> = {
  fr,
  en,
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const interpolate = (
  template: string,
  values?: TranslationValues
): string => {
  if (!values) {
    return template;
  }

  return Object.entries(values).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
};

export function LanguageProvider({
  children,
  initialLocale = "fr",
}: Readonly<{
  children: React.ReactNode;
  initialLocale?: Locale;
}>) {
  const [currentLocale, setCurrentLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("foodstream_locale") as Locale | null;
      if (stored === "fr" || stored === "en") {
        setCurrentLocale(stored);
        document.documentElement.lang = stored;
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setCurrentLocale(nextLocale);
    try {
      localStorage.setItem("foodstream_locale", nextLocale);
      document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = nextLocale;
    } catch {
      // ignore storage errors
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues): string => {
      const dict = translations[currentLocale] ?? translations.fr;
      const message = dict[key] ?? translations.fr[key] ?? String(key);
      return interpolate(message, values);
    },
    [currentLocale]
  );

  const value = useMemo(
    () => ({
      locale: currentLocale,
      setLocale,
      t,
    }),
    [currentLocale, setLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback safe dummy context if rendered outside LanguageProvider
    return {
      locale: "fr",
      setLocale: () => {},
      t: (key: TranslationKey, values?: TranslationValues) => {
        const message = fr[key] ?? String(key);
        return interpolate(message, values);
      },
    };
  }
  return context;
}
