/**
 * Default StreamView — re-exports the native implementation for TypeScript.
 * Metro resolves:
 *   - StreamView.native.tsx on iOS/Android
 *   - StreamView.web.tsx on Web
 */
export { default } from './StreamView.native';
