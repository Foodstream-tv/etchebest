"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_A11Y,
  applyA11yToDocument,
  persistA11y,
  type A11ySettings,
} from "@/lib/accessibility";

type AccessibilityContextValue = {
  settings: A11ySettings;
  update: (patch: Partial<A11ySettings>) => void;
  reset: () => void;
  isCustomized: boolean;
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({
  initialSettings,
  children,
}: {
  initialSettings: A11ySettings;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<A11ySettings>(initialSettings);

  useEffect(() => {
    applyA11yToDocument(settings);
    persistA11y(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<A11ySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_A11Y), []);

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      settings,
      update,
      reset,
      isCustomized:
        settings.textSize !== DEFAULT_A11Y.textSize ||
        settings.contrast !== DEFAULT_A11Y.contrast ||
        settings.colorBlind !== DEFAULT_A11Y.colorBlind,
    }),
    [settings, update, reset]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);

  if (!context) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }

  return context;
}
