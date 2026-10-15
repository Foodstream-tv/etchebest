import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform, TurboModuleRegistry } from 'react-native';

/**
 * Is a native module in the installed app binary? Asked *before* importing its JS package: importing one
 * that is missing throws, and in development Metro reports that as a red error even when it is caught.
 * On web there is no native binary, the packages bring their own implementation.
 */
export function hasExpoNativeModule(name: string): boolean {
    if (Platform.OS === 'web') return true;
    try {
        return requireOptionalNativeModule(name) != null;
    } catch {
        return false;
    }
}

/** Same for a React Native (TurboModule / legacy) module such as `RNCDatePicker`. */
export function hasTurboModule(name: string): boolean {
    if (Platform.OS === 'web') return true;
    try {
        return TurboModuleRegistry.get(name) != null;
    } catch {
        return false;
    }
}
