import { loadDateTimePicker, loadImagePicker, resetOptionalNativeCache } from '../optionalNative';

describe('optionalNative', () => {
    beforeEach(() => resetOptionalNativeCache());

    it('returns the modules when the app build has them (mocked in jest)', () => {
        expect(loadDateTimePicker()).not.toBeNull();
        expect(loadImagePicker()).not.toBeNull();
    });

    it('returns null instead of throwing when a module is missing from the binary', () => {
        jest.resetModules();
        jest.doMock('expo-image-picker', () => {
            throw new Error("Cannot find native module 'ExponentImagePicker'");
        });
        jest.doMock('@react-native-community/datetimepicker', () => {
            throw new Error("'RNCDatePicker' could not be found");
        });
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fresh = require('../optionalNative');
            expect(fresh.loadImagePicker()).toBeNull();
            expect(fresh.loadDateTimePicker()).toBeNull();
        } finally {
            jest.dontMock('expo-image-picker');
            jest.dontMock('@react-native-community/datetimepicker');
            jest.resetModules();
        }
    });
});
