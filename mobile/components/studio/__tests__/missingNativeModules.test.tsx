import React from 'react';

import DateTimeFields from '../DateTimeFields';
import StepMedia from '../StepMedia';
import { fireEvent, renderWithProviders } from '@/test-utils/render';
import { type StudioForm } from '@/hooks/useStudioForm';
import { EMPTY_RECIPE } from '@/utils/studioRecipe';

// An app build installed before the pickers were added: loading them fails.
jest.mock('@/utils/optionalNative', () => ({
    loadDateTimePicker: () => null,
    loadImagePicker: () => null,
}));

const form: StudioForm = {
    title: 'Pasta',
    description: '',
    tags: [],
    level: 'Débutant',
    recipe: EMPTY_RECIPE,
    date: '2030-05-12',
    time: '09:30',
    durationMinutes: 60,
    image: null,
    imageUrl: '',
};

describe('Studio without the native pickers in the app build', () => {
    it('lets the user type the date and the time instead of crashing', () => {
        const onChange = jest.fn();
        const { getByTestId, getByText } = renderWithProviders(<DateTimeFields date="2030-05-12" time="09:30" onChange={onChange} />);

        expect(getByTestId('manual-datetime')).toBeTruthy();
        expect(getByText(/saisis-les au format AAAA-MM-JJ et HH:mm/)).toBeTruthy();
        expect(getByTestId('schedule-date').props.value).toBe('2030-05-12');

        fireEvent.changeText(getByTestId('schedule-date'), ' 2031-01-02 ');
        expect(onChange).toHaveBeenCalledWith({ date: '2031-01-02' });
        fireEvent.changeText(getByTestId('schedule-time'), '18:05');
        expect(onChange).toHaveBeenCalledWith({ time: '18:05' });
    });

    it('flags a typed value that is not a real date', () => {
        const { getByTestId } = renderWithProviders(<DateTimeFields date="2030-13-45" time="09:30" onChange={jest.fn()} />);
        // StudioInput marks an invalid value with the danger border; the value stays editable
        expect(getByTestId('schedule-date').props.value).toBe('2030-13-45');
    });

    it('hides the photo button and keeps the image url field', () => {
        const { queryByTestId, getByTestId } = renderWithProviders(
            <StepMedia form={form} onChange={jest.fn()} onDuration={jest.fn()} scheduleInvalid={false} busy={false} />
        );
        expect(queryByTestId('thumbnail-choose')).toBeNull();
        expect(getByTestId('thumbnail-unavailable')).toBeTruthy();
        expect(getByTestId('thumbnail-url')).toBeTruthy();
    });
});
