import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Fire-and-forget haptic feedback: never throws and does nothing on web / unsupported devices. */
function run(effect: () => Promise<void>): void {
    if (Platform.OS === 'web') return;
    try {
        void effect().catch(() => {});
    } catch {
        // haptics are a nicety, never a failure
    }
}

export const haptics = {
    /** Light tap: a toggle, a selection, a send. */
    tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    /** Something worked (live started, followed, reserved). */
    success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    /** Destructive or attention-needed action (stop live, leave). */
    warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    /** Something failed. */
    error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
