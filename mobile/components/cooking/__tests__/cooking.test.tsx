import { Linking } from 'react-native';
import React from 'react';

import CookingAssistant from '../CookingAssistant';
import CookingStrip from '../CookingStrip';
import { useCookingProgress } from '@/hooks/useCookingProgress';
import { fireEvent, renderWithProviders, waitFor, act } from '@/test-utils/render';
import { parseRecipe } from '@/utils/recipe';

jest.mock('@/services/storage', () => {
    const api = { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) };
    return { __esModule: true, default: api, storage: api };
});
jest.mock('@/utils/haptics', () => ({ haptics: { tap: jest.fn(), success: jest.fn() } }));

const recipe = parseRecipe({
    ingredients: [{ name: 'Farine', qty: '200 g' }, { name: 'Beurre', qty: '80 g' }],
    prepSteps: ['Tamiser : passer la farine', 'Pétrir'],
    platingSteps: ['Dresser en nid'],
    utensils: ['Fouet'],
    cookingTimer: 90,
    prepTimeMins: 15,
    restTimeMins: 30,
    sourceUrl: 'https://www.marmiton.org/r',
    sourceName: 'Marmiton',
})!;

function Harness({ withStrip = false, r = recipe }: Readonly<{ withStrip?: boolean; r?: typeof recipe }>) {
    const progress = useCookingProgress('room-1', r);
    if (!progress.ready) return null;
    return (
        <>
            {withStrip ? <CookingStrip recipe={r} progress={progress} onPress={() => undefined} /> : null}
            <CookingAssistant recipe={r} progress={progress} />
        </>
    );
}

async function render(props: Parameters<typeof Harness>[0] = {}) {
    const view = renderWithProviders(<Harness {...props} />);
    await waitFor(() => expect(view.getByTestId('cooking-assistant')).toBeTruthy());
    return view;
}

describe('CookingAssistant', () => {
    it('opens on the ingredients: tick them, see the progress and the utensils', async () => {
        const view = await render();
        expect(view.getByText('Étape 1 sur 4')).toBeTruthy();
        expect(view.getByText('0/2')).toBeTruthy();
        expect(view.getByText('Fouet')).toBeTruthy();

        fireEvent.press(view.getByTestId('ingredient-0'));
        expect(view.getByText('1/2')).toBeTruthy();
        expect(view.getByTestId('ingredient-0').props.accessibilityState.checked).toBe(true);

        fireEvent.press(view.getByTestId('ingredient-1'));
        expect(view.getByText('Tout est prêt !')).toBeTruthy();

        fireEvent.press(view.getByTestId('ingredient-0'));
        expect(view.queryByText('Tout est prêt !')).toBeNull();
    });

    it('moves through the four phases with the buttons and the tabs', async () => {
        const view = await render();
        fireEvent.press(view.getByTestId('cooking-next'));
        expect(view.getByText('Étape 2 sur 4')).toBeTruthy();
        expect(view.getByTestId('cooking-prep')).toBeTruthy();
        expect(view.getByText('Préparation : 15 min')).toBeTruthy();
        expect(view.getByText('Repos : 30 min')).toBeTruthy();
        // "Name : description" is shown as a title and a text
        expect(view.getByText('Tamiser')).toBeTruthy();
        expect(view.getByText('passer la farine')).toBeTruthy();

        fireEvent.press(view.getByTestId('cooking-phase-3'));
        expect(view.getByText('Étape 4 sur 4')).toBeTruthy();
        expect(view.getByTestId('cooking-plating')).toBeTruthy();
        expect(view.queryByTestId('cooking-next')).toBeNull();

        fireEvent.press(view.getByTestId('cooking-prev'));
        expect(view.getByTestId('cooking-cooking')).toBeTruthy();
        fireEvent.press(view.getByTestId('cooking-phase-0'));
        expect(view.queryByTestId('cooking-prev')).toBeNull();
    });

    it('ticks preparation steps and the plating steps, and celebrates the end', async () => {
        const view = await render();
        fireEvent.press(view.getByTestId('cooking-phase-1'));
        fireEvent.press(view.getByTestId('prep-0'));
        expect(view.getByText('1/2')).toBeTruthy();

        fireEvent.press(view.getByTestId('cooking-phase-3'));
        fireEvent.press(view.getByTestId('plating-0'));
        expect(view.getByText('Recette terminée ! Bon appétit 🍽️')).toBeTruthy();
    });

    it('has a cooking timer with start, pause and reset', async () => {
        const view = await render();
        fireEvent.press(view.getByTestId('cooking-phase-2'));
        expect(view.getByTestId('cooking-timer').props.children).toBe('1:30');

        fireEvent.press(view.getByTestId('cooking-timer-start'));
        expect(view.getByTestId('cooking-timer-pause')).toBeTruthy();
        fireEvent.press(view.getByTestId('cooking-timer-pause'));
        expect(view.getByTestId('cooking-timer-start')).toBeTruthy();
        fireEvent.press(view.getByTestId('cooking-timer-reset'));
        expect(view.getByTestId('cooking-timer').props.children).toBe('1:30');
    });

    it('says so when the host set no timer', async () => {
        const noTimer = parseRecipe({ ingredients: [{ name: 'Farine', qty: '1' }] })!;
        const view = await render({ r: noTimer });
        fireEvent.press(view.getByTestId('cooking-phase-2'));
        expect(view.getByTestId('cooking-no-timer')).toBeTruthy();
        expect(view.queryByTestId('cooking-timer')).toBeNull();
    });

    it('falls back to a generic text when there are no preparation steps', async () => {
        const noPrep = parseRecipe({ ingredients: [{ name: 'Farine', qty: '1' }] })!;
        const view = await render({ r: noPrep });
        fireEvent.press(view.getByTestId('cooking-phase-1'));
        expect(view.getByText(/Lavez, épluchez et découpez/)).toBeTruthy();
    });

    it('cites the source and opens it', async () => {
        const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
        const view = await render();
        expect(view.getByText('Source : Marmiton')).toBeTruthy();
        fireEvent.press(view.getByTestId('cooking-source'));
        expect(open).toHaveBeenCalledWith('https://www.marmiton.org/r');
    });
});

describe('CookingStrip', () => {
    it('shows the progress and the next ingredient, then the phase', async () => {
        const view = await render({ withStrip: true });
        expect(view.getByText('Ingrédients (0/2)')).toBeTruthy();
        expect(view.getByTestId('cooking-strip-next').props.children).toBe('Prochain : Farine');

        fireEvent.press(view.getByTestId('ingredient-0'));
        expect(view.getByTestId('cooking-strip-next').props.children).toBe('Prochain : Beurre');

        fireEvent.press(view.getByTestId('cooking-phase-1'));
        expect(view.getByText('Préparation 🔪')).toBeTruthy();
        expect(view.queryByTestId('cooking-strip-next')).toBeNull();
    });

    it('shows the timer once it runs', async () => {
        const view = await render({ withStrip: true });
        expect(view.queryByTestId('cooking-strip-timer')).toBeNull();
        fireEvent.press(view.getByTestId('cooking-phase-2'));
        await act(async () => {
            fireEvent.press(view.getByTestId('cooking-timer-start'));
        });
        expect(view.getByTestId('cooking-strip-timer')).toBeTruthy();
    });
});
