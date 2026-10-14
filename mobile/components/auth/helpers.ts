import type { Ref } from 'react';
import { Platform } from 'react-native';

/**
 * React 19 passes `ref` as a regular prop; `FloatingLabelInput` forwards its rest props to the
 * underlying `TextInput`, so `{...inputRef(ref)}` gives access to the native input (focus chaining)
 * without changing the shared component or fighting its prop types.
 */
export function inputRef<T>(ref: Ref<T>): Record<string, never> {
    return { ref } as unknown as Record<string, never>;
}

/** On web, the focused element must lose focus before a navigation hides the screen (aria-hidden warning). */
export function blurActiveElementOnWeb(): void {
    if (Platform.OS === 'web') {
        const active = document.activeElement as HTMLElement | null;
        active?.blur?.();
    }
}
