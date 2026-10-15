/**
 * Native modules added after a development build was installed (image picker, date/time picker).
 * Importing one that the installed binary does not contain throws at import time and would take
 * the whole screen down (the route then "has no default export"), so they are loaded lazily and
 * the callers fall back to a plain JS control when the module is missing.
 */
import { hasExpoNativeModule, hasTurboModule } from '@/utils/nativeProbe';

type DateTimePickerModule = typeof import('@react-native-community/datetimepicker');
type ImagePickerModule = typeof import('expo-image-picker');

function tryLoad<T>(load: () => T): T | null {
    try {
        return load();
    } catch {
        return null;
    }
}

let dateTimePicker: DateTimePickerModule | null | undefined;
let imagePicker: ImagePickerModule | null | undefined;

/** The system date/time picker, or null when this app build does not include it. */
export function loadDateTimePicker(): DateTimePickerModule | null {
    if (dateTimePicker === undefined) {
        // Probe first: requiring a package whose native side is missing logs a red error in development.
        dateTimePicker = hasTurboModule('RNCDatePicker')
            ? // eslint-disable-next-line @typescript-eslint/no-require-imports
              tryLoad(() => require('@react-native-community/datetimepicker') as DateTimePickerModule)
            : null;
    }
    return dateTimePicker;
}

/** The photo library picker, or null when this app build does not include it. */
export function loadImagePicker(): ImagePickerModule | null {
    if (imagePicker === undefined) {
        imagePicker = hasExpoNativeModule('ExponentImagePicker')
            ? // eslint-disable-next-line @typescript-eslint/no-require-imports
              tryLoad(() => require('expo-image-picker') as ImagePickerModule)
            : null;
    }
    return imagePicker;
}

/** Test helper: forget what was loaded. */
export function resetOptionalNativeCache() {
    dateTimePicker = undefined;
    imagePicker = undefined;
}
