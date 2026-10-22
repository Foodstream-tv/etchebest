import { Platform, TurboModuleRegistry } from 'react-native';

import { hasExpoNativeModule, hasTurboModule } from '../nativeProbe';

// The global test setup replaces the probe: load the real one for these tests.
jest.unmock('@/utils/nativeProbe');

// Keep the rest of the package: other modules loaded by the test setup need it at import time.
jest.mock('expo-modules-core', () => ({ ...jest.requireActual('expo-modules-core'), requireOptionalNativeModule: jest.fn() }));

const { requireOptionalNativeModule } = jest.requireMock('expo-modules-core') as { requireOptionalNativeModule: jest.Mock };

describe('nativeProbe', () => {
    const original = Platform.OS;
    afterEach(() => Object.defineProperty(Platform, 'OS', { value: original }));

    it('finds an Expo module in the binary, or reports it missing without throwing', () => {
        requireOptionalNativeModule.mockReturnValueOnce({}).mockReturnValueOnce(null).mockImplementationOnce(() => {
            throw new Error('boom');
        });
        expect(hasExpoNativeModule('ExponentImagePicker')).toBe(true);
        expect(hasExpoNativeModule('ExponentImagePicker')).toBe(false);
        expect(hasExpoNativeModule('ExponentImagePicker')).toBe(false);
    });

    it('finds a React Native module with the non-throwing registry lookup', () => {
        const get = jest.spyOn(TurboModuleRegistry, 'get');
        get.mockReturnValueOnce({} as never).mockReturnValueOnce(null).mockImplementationOnce(() => {
            throw new Error('boom');
        });
        expect(hasTurboModule('RNCDatePicker')).toBe(true);
        expect(hasTurboModule('RNCDatePicker')).toBe(false);
        expect(hasTurboModule('RNCDatePicker')).toBe(false);
        get.mockRestore();
    });

    it('trusts the packages on web, where there is no native binary', () => {
        Object.defineProperty(Platform, 'OS', { value: 'web' });
        expect(hasExpoNativeModule('Anything')).toBe(true);
        expect(hasTurboModule('Anything')).toBe(true);
    });
});
