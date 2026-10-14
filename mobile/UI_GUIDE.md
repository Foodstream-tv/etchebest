# Mobile UI guide (aligned with front-web)

The mobile app mirrors the web front (`front-web/`): same tokens, same wording, same
navigation (Accueil · Lives · Studio · Rediffusions · Profil), light **and** dark theme.

## Theme

- Tokens: `constants/theme.ts` (`palettes.light|dark`, `brandGradient`, `radii`, `spacing`).
  Values come from the web: page `#f6f2ed` / `#050505`, card white/72 / `#120b05`/60, border black/8 / white/10,
  accent orange-500 `#f97316`, brand gradient `#FFA92E → #FF5D1E` (LIVE badge, primary buttons),
  card radius 28, input/button radius 16 (`rounded-2xl`).
- `contexts/ThemeContext.tsx`: `useTheme()` → `{ scheme, colors, radii, preference, setPreference }`,
  `makeStyles((theme) => ({ ... }))` returns a `useStyles()` hook. **Never** hardcode colors or import
  the removed `brandTheme`; module-level `StyleSheet.create` with colors is not allowed (it can't follow the theme).
  Static, color-free styles may stay in a plain `StyleSheet.create`.
- Video surfaces (`colors.video`) stay black in both themes.

```tsx
const useStyles = makeStyles(({ colors, radii }) => ({
  box: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
}));
function Foo() { const styles = useStyles(); const { colors } = useTheme(); ... }
```

## Components (`components/ui`)

`Screen` (themed page + orbs + safe area) · `Card` · `Button` (primary gradient / secondary / danger / ghost) ·
`Chip` · `Badge` (LIVE gradient, dark, soft, neutral) · `Avatar` · `SearchBar` · `SectionHeader` ·
`LiveCard` · `EmptyState` / `ErrorState` / `LoadingState` · `Skeleton`.
`components/FloatingLabelInput` is the themed icon text field (web `auth-field`).
Use them instead of re-styling the same thing per screen. Add a new shared component only when 2+ screens need it.

## Data layer (`services/`)

- `http.ts` → `request<T>(path, { method, body, auth, query, token })`, `ApiError` (`status`, `body`), `seg()` to
  encode every path segment, `UnauthorizedError`. 401 on an authenticated call and the "your account is banned"
  403 sign the user out and emit a session event (`SessionGuard` in the root layout shows the toast and goes to `/login`).
  Do not call `fetch` directly from screens.
- `api.ts` (auth/profile), `lives.ts` (`/lives`, tags, status), `streaming.ts` (rooms, WebRTC signaling, HLS, chat),
  `social.ts` (search, follow, activities).
- Backend login returns `{ token }` only: fetch `/users/me` afterwards. Registration requires e-mail verification
  (`/verify`, `/resend-code`), login answers 403 `code: "ACCOUNT_NOT_VERIFIED"` for unverified accounts.

## i18n

- `i18n/messages/shared.{fr,en}.ts` is **generated** from the web dictionaries (`npm run sync-i18n`). Never edit it.
  Prefer reusing existing web keys (`nav.*`, `watch.*`, `home.*`, `auth.*`, `replays.*`, `profile.*`, `common.*`…).
- Mobile-only keys go in `i18n/messages/areas/<area>.ts` exporting `fr` (`as const`) and `en: Record<keyof typeof fr, string>`.
  Register the area in `i18n/messages/fr.ts` and `en.ts`. Mobile keys override shared ones.
- `const { t, locale } = useI18n()`; interpolation `{name}`, plurals like the web (`{plural}` → `'s'` or `''`).
- No hardcoded user-facing strings in screens.

## Toasts

`ToastManager` is mounted once in `app/_layout.tsx`; never mount it in a screen. Use `utils/toast`.

## Tests

- `npm test` (`jest`), `test-utils/render.tsx` → `renderWithProviders` (Theme + Language providers).
- `expo-router` is globally mocked in `jest.setup.js` (`useRouter`, `useLocalSearchParams`, `useFocusEffect`…);
  override per test with `jest.mock` when asserting navigation.
- Mock `@/services/*` at module level; never hit the network.

## Accessibility

Every pressable has `accessibilityRole` + a label, touch targets ≥ 44pt, errors use `accessibilityRole="alert"`,
text uses theme colors (contrast checked on both palettes).
