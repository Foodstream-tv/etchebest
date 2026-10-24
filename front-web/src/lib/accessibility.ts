export const TEXT_SIZES = [100, 115, 130] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const CONTRAST_MODES = ["normal", "high"] as const;
export type ContrastMode = (typeof CONTRAST_MODES)[number];

export const COLOR_BLIND_MODES = [
  "none",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "achromatopsia",
] as const;
export type ColorBlindMode = (typeof COLOR_BLIND_MODES)[number];

export type A11ySettings = {
  textSize: TextSize;
  contrast: ContrastMode;
  colorBlind: ColorBlindMode;
};

export const DEFAULT_A11Y: A11ySettings = {
  textSize: 100,
  contrast: "normal",
  colorBlind: "none",
};

export const A11Y_COOKIE = "a11y";

/** Cookie shape: `<textSize>-<contrast>-<colorBlind>`, e.g. `115-high-deuteranopia`. */
export function serializeA11y(settings: A11ySettings): string {
  return `${settings.textSize}-${settings.contrast}-${settings.colorBlind}`;
}

export function parseA11y(value: string | undefined | null): A11ySettings {
  if (!value) return DEFAULT_A11Y;

  const [rawSize, rawContrast, rawColorBlind] = value.split("-");
  const size = Number(rawSize);

  return {
    textSize: (TEXT_SIZES as readonly number[]).includes(size)
      ? (size as TextSize)
      : DEFAULT_A11Y.textSize,
    contrast: (CONTRAST_MODES as readonly string[]).includes(rawContrast)
      ? (rawContrast as ContrastMode)
      : DEFAULT_A11Y.contrast,
    colorBlind: (COLOR_BLIND_MODES as readonly string[]).includes(rawColorBlind)
      ? (rawColorBlind as ColorBlindMode)
      : DEFAULT_A11Y.colorBlind,
  };
}

/** Attributes read by `app/accessibility.css`. */
export function a11yDataAttributes(settings: A11ySettings) {
  return {
    "data-a11y-text": String(settings.textSize),
    "data-a11y-contrast": settings.contrast,
    "data-a11y-cb": settings.colorBlind,
  } as const;
}

export function applyA11yToDocument(settings: A11ySettings) {
  const html = document.documentElement;

  for (const [name, value] of Object.entries(a11yDataAttributes(settings))) {
    html.setAttribute(name, value);
  }
}

export function persistA11y(settings: A11ySettings) {
  document.cookie = `${A11Y_COOKIE}=${serializeA11y(settings)}; path=/; max-age=31536000; samesite=lax`;
}
