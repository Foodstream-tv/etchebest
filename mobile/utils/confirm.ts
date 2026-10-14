import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    /** Styles the confirm button as destructive on native */
    destructive?: boolean;
    onConfirm: () => void;
};

/**
 * Cross-platform "are you sure?". `Alert.alert` with buttons is a silent no-op on
 * react-native-web, which would make the guarded action impossible there, so the
 * browser's own confirm dialog is used instead.
 */
export function confirmAction({ title, message, confirmLabel, cancelLabel, destructive = false, onConfirm }: ConfirmOptions): void {
    if (Platform.OS === 'web') {
        const confirmFn = (globalThis as { confirm?: (text?: string) => boolean }).confirm;
        // No dialog available (non-browser web runtime): do not trap the user, proceed.
        if (typeof confirmFn !== 'function' || confirmFn(`${title}\n\n${message}`)) onConfirm();
        return;
    }

    Alert.alert(title, message, [
        { text: cancelLabel, style: 'cancel' },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
}
