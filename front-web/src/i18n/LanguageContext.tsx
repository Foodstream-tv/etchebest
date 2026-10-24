"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
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

const LOCALE_STORAGE_KEY = "foodstream_locale";
// Fired in this tab when the locale is changed ("storage" only reaches the other tabs).
const LOCALE_CHANGE_EVENT = "foodstream_locale_change";

function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === "fr" || stored === "en" ? stored : null;
  } catch {
    return null;
  }
}

function subscribeLocale(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
  };
}

export function LanguageProvider({
  children,
  initialLocale = "fr",
}: Readonly<{
  children: React.ReactNode;
  initialLocale?: Locale;
}>) {
  // The server renders with the cookie's locale; the browser's stored choice wins once hydrated.
  const storedLocale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => null);
  // Kept in state too, so the switch works even when storage is blocked.
  const [chosenLocale, setChosenLocale] = useState<Locale | null>(null);
  const currentLocale = chosenLocale ?? storedLocale ?? initialLocale;

  useEffect(() => {
    document.documentElement.lang = currentLocale;
  }, [currentLocale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setChosenLocale(nextLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
      document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
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
