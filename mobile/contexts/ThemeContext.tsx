import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { AppTheme, ThemePreference, ThemeScheme, buildTheme } from '@/constants/theme';
import storage from '@/services/storage';

export const THEME_STORAGE_KEY = 'app_theme';

type ThemeContextValue = AppTheme & {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => Promise<void>;
  /** false until the stored preference has been read, to avoid a theme flash */
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function parseThemePreference(raw: string | null | undefined): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export function resolveScheme(preference: ThemePreference, system: ThemeScheme | null | undefined): ThemeScheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return system === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    storage
      .getItem(THEME_STORAGE_KEY)
      .then((raw) => {
        if (active) setPreferenceState(parseThemePreference(raw));
      })
      .catch(() => {
        // unreadable storage: keep following the system theme
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    await storage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const scheme = resolveScheme(preference, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({ ...buildTheme(scheme), preference, setPreference, ready }),
    [scheme, preference, setPreference, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const FALLBACK: ThemeContextValue = {
  ...buildTheme('dark'),
  preference: 'dark',
  setPreference: async () => {},
  ready: true,
};

/**
 * Returns the active theme. Outside a ThemeProvider (isolated component tests)
 * it falls back to the dark palette instead of throwing.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK;
}

/**
 * Builds a memoized StyleSheet from the active theme:
 *
 *   const useStyles = makeStyles((theme) => ({ card: { backgroundColor: theme.colors.card } }));
 *   const styles = useStyles();
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: AppTheme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(
      () => StyleSheet.create(factory(theme)),
      // factory is a module-level constant; only the theme drives the result
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [theme.scheme]
    );
  };
}
