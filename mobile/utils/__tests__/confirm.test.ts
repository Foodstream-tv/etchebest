import { Alert, Platform } from 'react-native';

import { confirmAction } from '../confirm';

const options = (onConfirm: () => void) => ({
    title: 'Arrêter ?',
    message: 'Le live sera terminé.',
    confirmLabel: 'Arrêter',
    cancelLabel: 'Annuler',
    destructive: true,
    onConfirm,
});

describe('utils/confirm', () => {
    const originalOS = Platform.OS;
    const originalConfirm = (globalThis as { confirm?: unknown }).confirm;
    afterEach(() => {
        Platform.OS = originalOS;
        (globalThis as { confirm?: unknown }).confirm = originalConfirm;
        jest.restoreAllMocks();
    });

    it('uses the native alert with a destructive confirm button', () => {
        Platform.OS = 'android';
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        const onConfirm = jest.fn();

        confirmAction(options(onConfirm));

        const [title, message, buttons] = alertSpy.mock.calls[0];
        expect(title).toBe('Arrêter ?');
        expect(message).toBe('Le live sera terminé.');
        expect(buttons?.[0]).toMatchObject({ text: 'Annuler', style: 'cancel' });
        expect(buttons?.[1]).toMatchObject({ text: 'Arrêter', style: 'destructive' });
        expect(onConfirm).not.toHaveBeenCalled();
        buttons?.[1].onPress?.();
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('uses the browser confirm on web (Alert.alert is a no-op there)', () => {
        Platform.OS = 'web';
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        const confirmMock = jest.fn(() => true);
        (globalThis as { confirm?: unknown }).confirm = confirmMock;
        const onConfirm = jest.fn();

        confirmAction(options(onConfirm));

        expect(confirmMock).toHaveBeenCalledWith('Arrêter ?\n\nLe live sera terminé.');
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(alertSpy).not.toHaveBeenCalled();
    });

    it('does nothing on web when the user cancels', () => {
        Platform.OS = 'web';
        (globalThis as { confirm?: unknown }).confirm = jest.fn(() => false);
        const onConfirm = jest.fn();

        confirmAction(options(onConfirm));

        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not trap the user when no dialog is available on web', () => {
        Platform.OS = 'web';
        (globalThis as { confirm?: unknown }).confirm = undefined;
        const onConfirm = jest.fn();

        confirmAction(options(onConfirm));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
