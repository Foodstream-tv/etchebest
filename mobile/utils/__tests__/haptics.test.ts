import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { haptics } from '../haptics';

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(() => Promise.resolve()),
    notificationAsync: jest.fn(() => Promise.resolve()),
    ImpactFeedbackStyle: { Light: 'light' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const mocked = Haptics as unknown as { impactAsync: jest.Mock; notificationAsync: jest.Mock };

describe('utils/haptics', () => {
    const originalOS = Platform.OS;
    beforeEach(() => {
        jest.clearAllMocks();
        Platform.OS = 'android';
    });
    afterAll(() => {
        Platform.OS = originalOS;
    });

    it('maps each feedback to the matching native haptic', () => {
        haptics.tap();
        expect(mocked.impactAsync).toHaveBeenCalledWith('light');
        haptics.success();
        expect(mocked.notificationAsync).toHaveBeenLastCalledWith('success');
        haptics.warning();
        expect(mocked.notificationAsync).toHaveBeenLastCalledWith('warning');
        haptics.error();
        expect(mocked.notificationAsync).toHaveBeenLastCalledWith('error');
    });

    it('does nothing on web', () => {
        Platform.OS = 'web';
        haptics.tap();
        haptics.success();
        expect(mocked.impactAsync).not.toHaveBeenCalled();
        expect(mocked.notificationAsync).not.toHaveBeenCalled();
    });

    it('never throws or leaves an unhandled rejection when the haptic engine fails', async () => {
        mocked.impactAsync.mockRejectedValueOnce(new Error('no vibrator'));
        mocked.notificationAsync.mockImplementationOnce(() => {
            throw new Error('sync failure');
        });

        expect(() => haptics.tap()).not.toThrow();
        expect(() => haptics.success()).not.toThrow();
        await Promise.resolve();
    });
});
