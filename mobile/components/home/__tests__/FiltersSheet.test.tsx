import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderWithProviders } from '@/test-utils/render';

import FiltersSheet from '../FiltersSheet';

jest.mock('react-native-safe-area-context', () => ({
    ...jest.requireActual('react-native-safe-area-context'),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('FiltersSheet', () => {
    it('applies the multi-selection and closes', () => {
        const onApply = jest.fn();
        const onClose = jest.fn();
        const { getByTestId, getByText } = renderWithProviders(<FiltersSheet visible value={[]} onApply={onApply} onClose={onClose} />);

        fireEvent.press(getByTestId('filter-Asiatique'));
        fireEvent.press(getByTestId('filter-BBQ'));
        fireEvent.press(getByTestId('filter-BBQ')); // toggled off again
        fireEvent.press(getByText('Afficher les résultats'));

        expect(onApply).toHaveBeenCalledWith(['Asiatique']);
        expect(onClose).toHaveBeenCalled();
    });

    it('starts from the applied filters and can reset them', () => {
        const onApply = jest.fn();
        const { getByText } = renderWithProviders(<FiltersSheet visible value={['Healthy']} onApply={onApply} onClose={jest.fn()} />);

        fireEvent.press(getByText('Réinitialiser'));
        fireEvent.press(getByText('Afficher les résultats'));

        expect(onApply).toHaveBeenCalledWith([]);
    });

    it('discards the draft when closed without applying', () => {
        const onApply = jest.fn();
        const onClose = jest.fn();
        const { getByTestId, getAllByLabelText } = renderWithProviders(<FiltersSheet visible value={[]} onApply={onApply} onClose={onClose} />);

        fireEvent.press(getByTestId('filter-Vegan'));
        fireEvent.press(getAllByLabelText('Fermer les filtres')[0]);

        expect(onClose).toHaveBeenCalled();
        expect(onApply).not.toHaveBeenCalled();
    });
});
