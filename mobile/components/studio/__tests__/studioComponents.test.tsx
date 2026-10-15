import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React from 'react';
import { Platform } from 'react-native';

import DateTimeFields from '../DateTimeFields';
import { normalizeRecipeUrl } from '../MarmitonImport';
import { formatPreviewDate } from '../StudioPreviewCard';
import { toPickedImage } from '../ThumbnailPicker';
import { fireEvent, renderWithProviders } from '@/test-utils/render';

describe('normalizeRecipeUrl', () => {
    it('adds https when the scheme is missing and keeps an explicit one', () => {
        expect(normalizeRecipeUrl('  www.marmiton.org/recettes/x.aspx ')).toBe('https://www.marmiton.org/recettes/x.aspx');
        expect(normalizeRecipeUrl('https://www.marmiton.org/x')).toBe('https://www.marmiton.org/x');
        expect(normalizeRecipeUrl('http://www.marmiton.org/x')).toBe('http://www.marmiton.org/x');
        expect(normalizeRecipeUrl('   ')).toBe('');
    });
});

describe('formatPreviewDate', () => {
    it('formats a real date in the locale, falls back otherwise', () => {
        expect(formatPreviewDate('2030-05-12', 'Aujourd’hui', 'fr')).toBe('12/05/2030');
        expect(formatPreviewDate('2030-05-12', 'Today', 'en')).toBe('12/05/2030');
        expect(formatPreviewDate('', 'Aujourd’hui', 'fr')).toBe('Aujourd’hui');
        expect(formatPreviewDate('2030-02-31', 'x', 'fr')).toBe('2030-02-31');
        expect(formatPreviewDate('garbage', 'x', 'fr')).toBe('garbage');
    });
});

describe('toPickedImage', () => {
    it('keeps the formats the backend accepts and sends anything else as jpeg', () => {
        expect(toPickedImage({ uri: 'file:///a.png', mimeType: 'image/png', fileSize: 10 } as never)).toEqual({ uri: 'file:///a.png', mimeType: 'image/png', name: 'thumbnail.png', size: 10 });
        expect(toPickedImage({ uri: 'file:///a.heic', mimeType: 'image/heic' } as never)).toMatchObject({ mimeType: 'image/jpeg', name: 'thumbnail.jpg' });
        expect(toPickedImage({ uri: 'file:///a', mimeType: undefined } as never)).toMatchObject({ name: 'thumbnail.jpg' });
    });
});

describe('DateTimeFields on Android', () => {
    const original = Platform.OS;
    beforeAll(() => Object.defineProperty(Platform, 'OS', { value: 'android' }));
    afterAll(() => Object.defineProperty(Platform, 'OS', { value: original }));
    beforeEach(() => (DateTimePickerAndroid.open as jest.Mock).mockClear());

    it('opens the system dialog and applies the chosen date', () => {
        const onChange = jest.fn();
        const { getByTestId } = renderWithProviders(<DateTimeFields date="2030-05-12" time="09:30" onChange={onChange} />);

        fireEvent.press(getByTestId('schedule-date'));
        const options = (DateTimePickerAndroid.open as jest.Mock).mock.calls[0][0];
        expect(options.mode).toBe('date');
        expect(options.value).toEqual(new Date(2030, 4, 12, 9, 30));

        options.onChange({ type: 'set' }, new Date(2031, 0, 2, 9, 30));
        expect(onChange).toHaveBeenCalledWith({ date: '2031-01-02' });
    });

    it('applies the chosen time and ignores a dismissed dialog', () => {
        const onChange = jest.fn();
        const { getByTestId } = renderWithProviders(<DateTimeFields date="2030-05-12" time="09:30" onChange={onChange} />);

        fireEvent.press(getByTestId('schedule-time'));
        const options = (DateTimePickerAndroid.open as jest.Mock).mock.calls[0][0];
        expect(options.mode).toBe('time');

        options.onChange({ type: 'dismissed' }, undefined);
        expect(onChange).not.toHaveBeenCalled();
        options.onChange({ type: 'set' }, new Date(2030, 4, 12, 18, 5));
        expect(onChange).toHaveBeenCalledWith({ time: '18:05' });
    });
});
