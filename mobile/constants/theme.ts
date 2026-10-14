/**
 * Design tokens shared with the web front (front-web).
 *
 * Source of truth on the web side:
 *  - background: AppBackground.tsx (#050505 dark / #f6f2ed light)
 *  - brand gradient: lib/ui/colors.ts (#FFA92E -> #FF5D1E)
 *  - accent: Tailwind orange-500, title gradient orange-500 -> red-500
 *  - cards: white/72 (light) and #120b05/60 (dark), 28px radius
 *  - borders: black/8 (light) and white/10 (dark)
 */

export type ThemeScheme = 'light' | 'dark';
export type ThemePreference = ThemeScheme | 'system';

export type ThemeColors = {
  /** Page background */
  bg: string;
  /** Large rounded card (web `rounded-[28px]` blocks) */
  card: string;
  /** Opaque variant of the card, for sheets/modals that must not show what is behind */
  cardSolid: string;
  /** Subtle surface (chips, inputs, rows) */
  surface: string;
  /** Stronger surface (pressed/selected chips) */
  surfaceStrong: string;
  border: string;
  text: string;
  muted: string;
  placeholder: string;
  orange: string;
  orangeDim: string;
  orangeGlow: string;
  /** orange-50 / orange-500/10 tinted background */
  orangeSoft: string;
  /** orange-700 / orange-300 text on the tinted background */
  orangeText: string;
  /** Text/icon color on top of the brand gradient or an orange fill */
  onBrand: string;
  danger: string;
  dangerSoft: string;
  success: string;
  warning: string;
  /** Scrim behind modals */
  overlay: string;
  tabBar: string;
  /** Video surfaces stay dark in both themes */
  video: string;
};

export const palettes: Record<ThemeScheme, ThemeColors> = {
  light: {
    bg: '#f6f2ed',
    card: 'rgba(255, 255, 255, 0.72)',
    cardSolid: '#ffffff',
    surface: 'rgba(255, 255, 255, 0.72)',
    surfaceStrong: 'rgba(0, 0, 0, 0.05)',
    border: 'rgba(0, 0, 0, 0.08)',
    text: '#111827',
    muted: '#4b5563',
    placeholder: '#9ca3af',
    orange: '#f97316',
    orangeDim: '#c2540a',
    orangeGlow: 'rgba(249, 115, 22, 0.28)',
    orangeSoft: '#fff7ed',
    orangeText: '#c2410c',
    onBrand: '#ffffff',
    danger: '#dc2626',
    dangerSoft: 'rgba(220, 38, 38, 0.10)',
    success: '#15803d',
    warning: '#b45309',
    overlay: 'rgba(0, 0, 0, 0.45)',
    tabBar: 'rgba(255, 255, 255, 0.92)',
    video: '#000000',
  },
  dark: {
    bg: '#050505',
    card: 'rgba(18, 11, 5, 0.6)',
    cardSolid: '#120b05',
    surface: 'rgba(255, 255, 255, 0.04)',
    surfaceStrong: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.10)',
    text: '#f9fafb',
    muted: '#9ca3af',
    placeholder: '#6b7280',
    orange: '#f97316',
    orangeDim: '#c2540a',
    orangeGlow: 'rgba(249, 115, 22, 0.28)',
    orangeSoft: 'rgba(249, 115, 22, 0.10)',
    orangeText: '#fdba74',
    onBrand: '#ffffff',
    danger: '#f87171',
    dangerSoft: 'rgba(248, 113, 113, 0.12)',
    success: '#4ade80',
    warning: '#fbbf24',
    overlay: 'rgba(0, 0, 0, 0.65)',
    tabBar: 'rgba(10, 10, 10, 0.96)',
    video: '#000000',
  },
};

/** `ORANGE_GRADIENT` of the web (lib/ui/colors.ts): primary buttons, LIVE badge, FAB. */
export const brandGradient = ['#FFA92E', '#FF5D1E'] as const;

/** Wordmark gradient of the web top nav (`from-orange-500 to-red-500`). */
export const wordmarkGradient = ['#f97316', '#ef4444'] as const;

export const radii = {
  sm: 8,
  md: 12,
  /** Tailwind `rounded-2xl` : inputs, buttons */
  lg: 16,
  xl: 20,
  /** Web `rounded-[28px]` cards */
  card: 28,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/** Decorative orbs of the web background (AppBackground.tsx). */
export const orbs: Record<ThemeScheme, { main: readonly [string, string]; secondary: readonly [string, string] }> = {
  dark: {
    main: ['rgba(255, 120, 0, 0.32)', 'rgba(255, 120, 0, 0)'],
    secondary: ['rgba(255, 145, 20, 0.24)', 'rgba(255, 100, 0, 0)'],
  },
  light: {
    main: ['rgba(255, 145, 40, 0.30)', 'rgba(255, 145, 40, 0)'],
    secondary: ['rgba(255, 150, 30, 0.22)', 'rgba(255, 120, 0, 0)'],
  },
};

export type AppTheme = {
  scheme: ThemeScheme;
  colors: ThemeColors;
  gradient: typeof brandGradient;
  radii: typeof radii;
  spacing: typeof spacing;
};

export function buildTheme(scheme: ThemeScheme): AppTheme {
  return {
    scheme,
    colors: palettes[scheme],
    gradient: brandGradient,
    radii,
    spacing,
  };
}

/** Appends an alpha channel to a `#rrggbb` color; other formats are returned untouched. */
export function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }
  const clamped = Math.min(1, Math.max(0, alpha));
  const channel = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${channel}`;
}
