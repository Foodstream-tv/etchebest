import { act, fireEvent, renderWithProviders, waitFor, within } from '@/test-utils/render';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React from 'react';

import StudioScreen from '../(tabs)/studio';
import { ApiError } from '@/services/http';
import { getMyScheduledLive } from '@/services/social';
import { scheduleLive, scrapeMarmiton, stopMyActiveLive, uploadThumbnail } from '@/services/studio';
import { RECIPE_MARKER } from '@/services/lives';
import { clearLiveDrafts, getLiveDraft } from '@/utils/liveDraft';

jest.mock('@/services/social', () => ({
    getMyScheduledLive: jest.fn(),
}));
jest.mock('@/services/studio', () => ({
    THUMBNAIL_MAX_BYTES: 5 * 1024 * 1024,
    scrapeMarmiton: jest.fn(),
    uploadThumbnail: jest.fn(),
    scheduleLive: jest.fn(),
    stopMyActiveLive: jest.fn(),
}));

const mockedScheduled = getMyScheduledLive as jest.Mock;
const mockedScrape = scrapeMarmiton as jest.Mock;
const mockedUpload = uploadThumbnail as jest.Mock;
const mockedSchedule = scheduleLive as jest.Mock;
const mockedStop = stopMyActiveLive as jest.Mock;
const mockedPicker = ImagePicker.launchImageLibraryAsync as jest.Mock;
const router = (useRouter as unknown as () => { push: jest.Mock })();

async function renderStudio() {
    const view = renderWithProviders(<StudioScreen />);
    await act(async () => {
        await Promise.resolve();
    });
    return view;
}

type View = Awaited<ReturnType<typeof renderStudio>>;
const goTo = (view: View, step: 1 | 2 | 3) => fireEvent.press(view.getByTestId(`step-${step}`));

/** Sets a far-future slot so the schedule is always valid, whatever time the test runs at. */
function pickFutureSlot(view: View) {
    fireEvent(view.getByTestId('schedule-date'), 'onChange', {}, new Date(2030, 4, 12, 9, 30));
    fireEvent(view.getByTestId('schedule-time'), 'onChange', {}, new Date(2030, 4, 12, 9, 30));
}

beforeEach(() => {
    clearLiveDrafts();
    jest.clearAllMocks();
    mockedScheduled.mockResolvedValue(null);
    mockedSchedule.mockResolvedValue('room-new');
    mockedUpload.mockResolvedValue('/api/uploads/thumb.jpg');
    mockedStop.mockResolvedValue(true);
});

describe('StudioScreen - wizard', () => {
    it('opens on step 1 with the Marmiton import, title, tags and level, and a preview', async () => {
        const view = await renderStudio();
        expect(view.getByText('Foodstream Studio')).toBeTruthy();
        expect(view.getByText('Étape 1 sur 3')).toBeTruthy();
        expect(view.getByTestId('marmiton-import')).toBeTruthy();
        expect(view.getByTestId('studio-title')).toBeTruthy();
        expect(view.getByTestId('tag-Italien')).toBeTruthy();
        expect(view.getByTestId('level-Débutant')).toBeTruthy();
        expect(view.getByTestId('studio-preview')).toBeTruthy();
        expect(view.getByTestId('preview-title').props.children).toBe('Ramen Tonkotsu en 30 minutes');
        expect(view.queryByTestId('scheduled-live')).toBeNull();
    });

    it('moves between the 3 steps with the buttons and the stepper, keeping what was typed', async () => {
        const view = await renderStudio();
        fireEvent.changeText(view.getByTestId('studio-title'), 'Pasta maison');

        fireEvent.press(view.getByTestId('step-next'));
        expect(view.getByText('Étape 2 sur 3')).toBeTruthy();
        expect(view.getByTestId('studio-description')).toBeTruthy();

        fireEvent.press(view.getByTestId('step-next'));
        expect(view.getByText('Étape 3 sur 3')).toBeTruthy();
        expect(view.getByTestId('schedule-live')).toBeTruthy();
        expect(view.getByTestId('go-live')).toBeTruthy();
        expect(view.queryByTestId('step-next')).toBeNull();

        goTo(view, 1);
        expect(view.getByTestId('studio-title').props.value).toBe('Pasta maison');
        expect(view.queryByTestId('step-prev')).toBeNull();

        goTo(view, 3);
        fireEvent.press(view.getByTestId('step-prev'));
        expect(view.getByText('Étape 2 sur 3')).toBeTruthy();
    });

    it('shows the live preview: title, first 3 tags and the level', async () => {
        const view = await renderStudio();
        fireEvent.changeText(view.getByTestId('studio-title'), 'Pasta maison');
        ['Italien', 'Français', 'Japonais', 'Indien'].forEach((tag) => fireEvent.press(view.getByTestId(`tag-${tag}`)));
        fireEvent.press(view.getByTestId('level-Avancé'));

        const preview = within(view.getByTestId('studio-preview'));
        expect(view.getByTestId('preview-title').props.children).toBe('Pasta maison');
        ['Italien', 'Français', 'Japonais'].forEach((tag) => expect(preview.getByText(tag)).toBeTruthy());
        expect(preview.queryByText('Indien')).toBeNull(); // only the first 3 tags
        expect(preview.getByText('Avancé')).toBeTruthy();
    });

    it('previews a date and time the user picked', async () => {
        const view = await renderStudio();
        goTo(view, 3);
        fireEvent(view.getByTestId('schedule-date'), 'onChange', {}, new Date(2030, 4, 12, 9, 30));
        fireEvent(view.getByTestId('schedule-time'), 'onChange', {}, new Date(2030, 4, 12, 9, 30));
        expect(within(view.getByTestId('studio-preview')).getByText(/09:30/)).toBeTruthy();
    });
});

describe('StudioScreen - step 1', () => {
    it('toggles tags, limits the selection to 5 and adds custom tags', async () => {
        const view = await renderStudio();
        ['Italien', 'Français', 'Chinois'].forEach((tag) => fireEvent.press(view.getByTestId(`tag-${tag}`)));
        expect(view.getByText('3/5 tags')).toBeTruthy();

        fireEvent.changeText(view.getByTestId('custom-tag-input'), '  Fait   minute ');
        fireEvent.press(view.getByTestId('custom-tag-add'));
        expect(view.getByTestId('selected-tag-Fait minute')).toBeTruthy();
        expect(view.getByText('4/5 tags')).toBeTruthy();

        // duplicate (case-insensitive) is ignored
        fireEvent.changeText(view.getByTestId('custom-tag-input'), 'fait minute');
        fireEvent.press(view.getByTestId('custom-tag-add'));
        expect(view.getByText('4/5 tags')).toBeTruthy();

        fireEvent.press(view.getByTestId('tag-Indien'));
        expect(view.getByText('5/5 tags')).toBeTruthy();
        fireEvent.changeText(view.getByTestId('custom-tag-input'), 'Un de trop');
        fireEvent.press(view.getByTestId('custom-tag-add'));
        expect(view.getByText('Tu peux choisir 5 tags au maximum.')).toBeTruthy();
        expect(view.getByText('5/5 tags')).toBeTruthy();

        fireEvent.press(view.getByTestId('selected-tag-Chinois'));
        expect(view.queryByText('Tu peux choisir 5 tags au maximum.')).toBeNull();
        expect(view.getByText('4/5 tags')).toBeTruthy();
    });

    it('caps the title at 80 characters', async () => {
        const view = await renderStudio();
        expect(view.getByTestId('studio-title').props.maxLength).toBe(80);
    });

    it('opens one tag group at a time (Cuisine first)', async () => {
        const view = await renderStudio();
        expect(view.getByTestId('tag-Italien')).toBeTruthy();
        expect(view.queryByTestId('tag-Vegan')).toBeNull();

        fireEvent.press(view.getByTestId('tag-group-studio.go.tagGroup.dish'));
        expect(view.getByTestId('tag-Vegan')).toBeTruthy();
        expect(view.queryByTestId('tag-Italien')).toBeNull();

        fireEvent.press(view.getByTestId('tag-group-studio.go.tagGroup.dish'));
        expect(view.queryByTestId('tag-Vegan')).toBeNull();
    });

    it('keeps tags picked in another group', async () => {
        const view = await renderStudio();
        fireEvent.press(view.getByTestId('tag-Italien'));
        fireEvent.press(view.getByTestId('tag-group-studio.go.tagGroup.dish'));
        fireEvent.press(view.getByTestId('tag-Vegan'));
        expect(view.getByText('2/5 tags')).toBeTruthy();
        expect(view.getByTestId('selected-tag-Italien')).toBeTruthy();
    });
});

describe('StudioScreen - Marmiton import', () => {
    it('fills the title, description and the whole recipe, then keeps the citation', async () => {
        mockedScrape.mockResolvedValue({
            title: 'Pâtes carbonara',
            description: 'La vraie recette.',
            ingredients: ['200 g de pâtes', 'sel'],
            steps: ['Cuire les pâtes'],
            cook_time_mins: 10,
            prep_time_mins: 5,
            utensils: ['casserole'],
        });
        const view = await renderStudio();

        fireEvent.changeText(view.getByTestId('marmiton-url'), 'www.marmiton.org/recettes/carbonara.aspx');
        await act(async () => {
            fireEvent.press(view.getByTestId('marmiton-import-button'));
        });

        // a scheme-less address is completed: the backend only fetches https pages
        expect(mockedScrape).toHaveBeenCalledWith('https://www.marmiton.org/recettes/carbonara.aspx');
        expect(view.getByTestId('marmiton-success')).toBeTruthy();
        expect(view.getByTestId('studio-title').props.value).toBe('Pâtes carbonara');
        expect(view.getByTestId('studio-source').props.value).toBe('https://www.marmiton.org/recettes/carbonara.aspx');

        fireEvent.press(view.getByTestId('step-next'));
        expect(view.getByTestId('studio-description').props.value).toBe('La vraie recette.');
        expect(view.getByText('pâtes (200 g)')).toBeTruthy();
        expect(view.getByText('sel (Au goût)')).toBeTruthy();
        expect(view.getByText('Cuire les pâtes', { exact: false })).toBeTruthy();
        expect(view.getByText('casserole')).toBeTruthy();
        expect(view.getByTestId('cook-time').props.value).toBe('10');
        expect(view.getByTestId('prep-time').props.value).toBe('5');
    });

    it('shows the backend message when the import fails and lets the user retry', async () => {
        mockedScrape.mockRejectedValueOnce(new ApiError('only marmiton.org URLs are supported', 400, null)).mockResolvedValueOnce({ title: 'OK', ingredients: ['sel'] });
        const view = await renderStudio();

        fireEvent.changeText(view.getByTestId('marmiton-url'), 'https://evil.test/?marmiton.org');
        await act(async () => {
            fireEvent.press(view.getByTestId('marmiton-import-button'));
        });
        expect(view.getByTestId('marmiton-error').props.children).toBe('only marmiton.org URLs are supported');
        expect(view.getByTestId('studio-title').props.value).toBe('');

        fireEvent.changeText(view.getByTestId('marmiton-url'), 'https://www.marmiton.org/x');
        await act(async () => {
            fireEvent.press(view.getByTestId('marmiton-import-button'));
        });
        expect(view.queryByTestId('marmiton-error')).toBeNull();
        expect(view.getByTestId('studio-title').props.value).toBe('OK');
    });

    it('does not report a successful import for a page without recipe (article, home page): a title only', async () => {
        mockedScrape.mockResolvedValue({ title: 'Fini le riz ou les pommes de terre', description: '', ingredients: null, steps: null });
        const view = await renderStudio();
        fireEvent.changeText(view.getByTestId('studio-title'), 'Mon titre');

        fireEvent.changeText(view.getByTestId('marmiton-url'), 'https://www.marmiton.org/dossier-article.aspx');
        await act(async () => {
            fireEvent.press(view.getByTestId('marmiton-import-button'));
        });

        expect(view.getByTestId('marmiton-error').props.children).toMatch(/ne contient pas de recette/);
        expect(view.queryByTestId('marmiton-success')).toBeNull();
        // nothing was filled in, what the user typed is untouched, the address stays to be corrected
        expect(view.getByTestId('studio-title').props.value).toBe('Mon titre');
        expect(view.getByTestId('marmiton-url').props.value).toBe('https://www.marmiton.org/dossier-article.aspx');
    });

    it('accepts a page with steps only', async () => {
        mockedScrape.mockResolvedValue({ title: 'Seulement des étapes', steps: ['Mélanger'] });
        const view = await renderStudio();
        fireEvent.changeText(view.getByTestId('marmiton-url'), 'https://www.marmiton.org/recettes/x.aspx');
        await act(async () => {
            fireEvent.press(view.getByTestId('marmiton-import-button'));
        });
        expect(view.getByTestId('marmiton-success')).toBeTruthy();
        expect(view.getByTestId('studio-title').props.value).toBe('Seulement des étapes');
    });

    it('does not import an empty address', async () => {
        const view = await renderStudio();
        fireEvent.press(view.getByTestId('marmiton-import-button'));
        expect(mockedScrape).not.toHaveBeenCalled();
    });
});

describe('StudioScreen - step 2 (recipe)', () => {
    async function onStep2() {
        const view = await renderStudio();
        fireEvent.press(view.getByTestId('step-next'));
        return view;
    }

    it('adds quick suggestions to the description, once, within 500 characters', async () => {
        const view = await onStep2();
        fireEvent.press(view.getByTestId('hint-Pas à pas'));
        expect(view.getByTestId('studio-description').props.value).toBe('• Pas à pas');
        fireEvent.press(view.getByTestId('hint-Recette maison'));
        expect(view.getByTestId('studio-description').props.value).toBe('• Pas à pas\n• Recette maison');
        expect(view.getByTestId('hint-Pas à pas').props.accessibilityState.disabled).toBe(true);
        expect(view.getByText('28/500')).toBeTruthy();
    });

    it('caps the description at 500 characters', async () => {
        const view = await onStep2();
        fireEvent.changeText(view.getByTestId('studio-description'), 'a'.repeat(700));
        expect(view.getByTestId('studio-description').props.value).toHaveLength(500);
        expect(view.getByText('500/500')).toBeTruthy();
    });

    it('adds and removes ingredients (default quantity "Au goût")', async () => {
        const view = await onStep2();
        fireEvent.changeText(view.getByTestId('ingredient-name'), 'Farine');
        fireEvent.changeText(view.getByTestId('ingredient-qty'), '200 g');
        fireEvent.press(view.getByTestId('ingredient-add'));
        fireEvent.changeText(view.getByTestId('ingredient-name'), 'Sel');
        fireEvent.press(view.getByTestId('ingredient-add'));

        expect(view.getByText('Farine (200 g)')).toBeTruthy();
        expect(view.getByText('Sel (Au goût)')).toBeTruthy();
        expect(view.getByTestId('ingredient-name').props.value).toBe('');

        fireEvent.press(view.getByTestId('ingredient-0-remove'));
        expect(view.queryByText('Farine (200 g)')).toBeNull();
        expect(view.getByText('Sel (Au goût)')).toBeTruthy();
    });

    it('does not add an ingredient without a name', async () => {
        const view = await onStep2();
        fireEvent.changeText(view.getByTestId('ingredient-qty'), '200 g');
        fireEvent.press(view.getByTestId('ingredient-add'));
        expect(view.queryByTestId('ingredient-0')).toBeNull();
    });

    it('adds, edits and removes preparation steps', async () => {
        const view = await onStep2();
        fireEvent.changeText(view.getByTestId('prep-step-input'), 'Mélanger');
        fireEvent.press(view.getByTestId('prep-step-add'));
        fireEvent.changeText(view.getByTestId('prep-step-input'), 'Cuire');
        fireEvent(view.getByTestId('prep-step-input'), 'submitEditing');
        expect(view.getByText('Mélanger', { exact: false })).toBeTruthy();
        expect(view.getByText('Cuire', { exact: false })).toBeTruthy();

        fireEvent.press(view.getByTestId('prep-step-item-0-edit'));
        fireEvent.changeText(view.getByTestId('prep-step-item-0-edit-input'), 'Mélanger doucement');
        fireEvent.press(view.getByTestId('prep-step-item-0-save'));
        expect(view.getByText('Mélanger doucement', { exact: false })).toBeTruthy();

        // cancelling an edit keeps the step as it was
        fireEvent.press(view.getByTestId('prep-step-item-1-edit'));
        fireEvent.changeText(view.getByTestId('prep-step-item-1-edit-input'), 'Autre');
        fireEvent.press(view.getByTestId('prep-step-item-1-cancel'));
        expect(view.getByText('Cuire', { exact: false })).toBeTruthy();

        fireEvent.press(view.getByTestId('prep-step-item-0-remove'));
        expect(view.queryByText('Mélanger doucement', { exact: false })).toBeNull();
    });

    it('adds utensils without duplicates, plating steps and the three durations', async () => {
        const view = await onStep2();
        fireEvent.changeText(view.getByTestId('utensil-input'), 'Fouet');
        fireEvent.press(view.getByTestId('utensil-add'));
        fireEvent.changeText(view.getByTestId('utensil-input'), 'Fouet');
        fireEvent.press(view.getByTestId('utensil-add'));
        expect(view.getAllByText('Fouet')).toHaveLength(1);

        fireEvent.changeText(view.getByTestId('plating-input'), 'Dresser en nid');
        fireEvent.press(view.getByTestId('plating-add'));
        expect(view.getByText('Dresser en nid', { exact: false })).toBeTruthy();

        fireEvent.changeText(view.getByTestId('prep-time'), '15x');
        fireEvent.changeText(view.getByTestId('rest-time'), '30');
        fireEvent.changeText(view.getByTestId('cook-time'), '999');
        expect(view.getByTestId('prep-time').props.value).toBe('15');
        expect(view.getByTestId('rest-time').props.value).toBe('30');
        expect(view.getByTestId('cook-time').props.value).toBe('180'); // timer capped at 3 h
    });
});

describe('StudioScreen - go live now', () => {
    async function ready(title = 'Pasta maison') {
        const view = await renderStudio();
        fireEvent.changeText(view.getByTestId('studio-title'), title);
        goTo(view, 3);
        return view;
    }

    it('sends the host to the broadcast screen with the trimmed title, level and planned duration', async () => {
        const view = await ready('  Pasta   maison  ');
        await act(async () => {
            fireEvent.press(view.getByTestId('go-live'));
        });

        expect(router.push).toHaveBeenCalledTimes(1);
        expect(router.push).toHaveBeenCalledWith({
            pathname: '/live-streaming',
            params: { mode: 'host', title: 'Pasta maison', level: 'Débutant', durationMinutes: '60', draft: expect.any(String) },
        });
        // the description and the thumbnail do not travel in the route
        const params = router.push.mock.calls[0][0].params;
        expect(params).not.toHaveProperty('description');
        expect(getLiveDraft(params.draft)).toEqual({ description: '', thumbnailUrl: undefined });
    });

    it('passes tags, description, recipe and a pasted thumbnail url', async () => {
        const view = await renderStudio();
        fireEvent.changeText(view.getByTestId('studio-title'), 'Pasta maison');
        fireEvent.press(view.getByTestId('tag-Italien'));
        fireEvent.press(view.getByTestId('tag-Français'));
        fireEvent.press(view.getByTestId('step-next'));
        fireEvent.changeText(view.getByTestId('studio-description'), '  Tagliatelles fraîches  ');
        fireEvent.changeText(view.getByTestId('ingredient-name'), 'Farine');
        fireEvent.changeText(view.getByTestId('ingredient-qty'), '200 g');
        fireEvent.press(view.getByTestId('ingredient-add'));
        fireEvent.changeText(view.getByTestId('cook-time'), '12');
        fireEvent.press(view.getByTestId('step-next'));
        fireEvent.changeText(view.getByTestId('thumbnail-url'), ' https://img.example/pasta.jpg ');
        fireEvent.press(view.getByTestId('duration-90'));
        await act(async () => {
            fireEvent.press(view.getByTestId('go-live'));
        });

        const params = router.push.mock.calls[0][0].params;
        expect(params).toMatchObject({
            mode: 'host',
            title: 'Pasta maison',
            tags: 'Italien,Français',
            durationMinutes: '90',
        });
        expect(params).not.toHaveProperty('thumbnailUrl');
        const draft = getLiveDraft(params.draft)!;
        expect(draft.thumbnailUrl).toBe('https://img.example/pasta.jpg');
        const [text, recipe] = draft.description.split(`\n\n${RECIPE_MARKER}\n`);
        expect(text).toBe('Tagliatelles fraîches');
        expect(JSON.parse(recipe)).toMatchObject({ ingredients: [{ name: 'Farine', qty: '200 g' }], cookingTimer: 720 });
        expect(mockedUpload).not.toHaveBeenCalled();
    });

    it('hands a large imported recipe over intact (regression: a live was created with an empty description)', async () => {
        const long = (n: number) => `Étape ${n} : mélanger 50 % du sucre & la farine à 180 °C, puis réserver (100% maison) ; ok ?`.repeat(4);
        mockedScrape.mockResolvedValue({
            title: 'Fini le riz ou les pommes de terre',
            description: 'Une recette avec un “guillemet”, des œufs & du 100 % bon.',
            ingredients: Array.from({ length: 14 }, (_, i) => `${i + 1} c. à soupe de produit n°${i}`),
            steps: Array.from({ length: 12 }, (_, i) => long(i)),
            cook_time_mins: 20,
        });
        const view = await renderStudio();
        fireEvent.changeText(view.getByTestId('marmiton-url'), 'https://www.marmiton.org/recettes/x.aspx');
        await act(async () => {
            fireEvent.press(view.getByTestId('marmiton-import-button'));
        });
        goTo(view, 3);
        await act(async () => {
            fireEvent.press(view.getByTestId('go-live'));
        });

        const params = router.push.mock.calls[0][0].params;
        const draft = getLiveDraft(params.draft)!;
        const [text, json] = draft.description.split(`\n\n${RECIPE_MARKER}\n`);
        expect(text).toBe('Une recette avec un “guillemet”, des œufs & du 100 % bon.');
        const recipe = JSON.parse(json);
        expect(recipe.ingredients).toHaveLength(14);
        expect(recipe.prepSteps).toHaveLength(12);
        expect(recipe.cookingTimer).toBe(1200);
    });

    it('uploads the photo picked on the device and passes the resulting path', async () => {
        mockedPicker.mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///photos/p.heic', mimeType: 'image/heic', fileSize: 1024 * 1024 }],
        });
        const view = await ready();
        await act(async () => {
            fireEvent.press(view.getByTestId('thumbnail-choose'));
        });
        // heic is not accepted by the backend: it is sent as a jpeg (the picker re-encodes)
        expect(view.getByTestId('thumbnail-picked')).toBeTruthy();
        expect(view.getByText('thumbnail.jpg')).toBeTruthy();
        expect(view.getByTestId('preview-image').props.source).toEqual({ uri: 'file:///photos/p.heic' });

        await act(async () => {
            fireEvent.press(view.getByTestId('go-live'));
        });

        expect(mockedUpload).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///photos/p.heic', mimeType: 'image/jpeg', name: 'thumbnail.jpg' }));
        expect(getLiveDraft(router.push.mock.calls[0][0].params.draft)?.thumbnailUrl).toBe('/api/uploads/thumb.jpg');
    });

    it('refuses a photo over 5 MB and a cancelled picker changes nothing', async () => {
        const view = await ready();
        mockedPicker.mockResolvedValueOnce({ canceled: true, assets: null });
        await act(async () => {
            fireEvent.press(view.getByTestId('thumbnail-choose'));
        });
        expect(view.queryByTestId('thumbnail-picked')).toBeNull();

        mockedPicker.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///big.jpg', mimeType: 'image/jpeg', fileSize: 6 * 1024 * 1024 }] });
        await act(async () => {
            fireEvent.press(view.getByTestId('thumbnail-choose'));
        });
        expect(view.getByTestId('thumbnail-error').props.children).toBe('L’image ne doit pas dépasser 5 Mo.');
        expect(view.queryByTestId('thumbnail-picked')).toBeNull();
    });

    it('choosing a photo clears the url and typing a url drops the photo', async () => {
        mockedPicker.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg', mimeType: 'image/jpeg' }] });
        const view = await ready();
        fireEvent.changeText(view.getByTestId('thumbnail-url'), 'https://img.example/x.jpg');
        await act(async () => {
            fireEvent.press(view.getByTestId('thumbnail-choose'));
        });
        expect(view.getByTestId('thumbnail-url').props.value).toBe('');

        fireEvent.changeText(view.getByTestId('thumbnail-url'), 'https://img.example/y.jpg');
        expect(view.queryByTestId('thumbnail-picked')).toBeNull();

        fireEvent.press(view.getByTestId('thumbnail-choose'));
        await waitFor(() => expect(view.getByTestId('thumbnail-picked')).toBeTruthy());
        fireEvent.press(view.getByTestId('thumbnail-remove'));
        expect(view.queryByTestId('thumbnail-picked')).toBeNull();
    });

    it('stays on the form with a message when the upload fails', async () => {
        mockedPicker.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg', mimeType: 'image/jpeg' }] });
        mockedUpload.mockRejectedValue(new Error('boom'));
        const view = await ready();
        await act(async () => {
            fireEvent.press(view.getByTestId('thumbnail-choose'));
        });
        await act(async () => {
            fireEvent.press(view.getByTestId('go-live'));
        });
        expect(view.getByText('Impossible d’envoyer la miniature. Réessaie ou colle l’adresse d’une image.')).toBeTruthy();
        expect(router.push).not.toHaveBeenCalled();
    });

    it('goes back to step 1 with the title error when the title is missing', async () => {
        const view = await renderStudio();
        goTo(view, 3);
        fireEvent.press(view.getByTestId('go-live'));

        expect(view.getByText('Étape 1 sur 3')).toBeTruthy();
        expect(view.getByText('Le titre du live est obligatoire.')).toBeTruthy();
        expect(router.push).not.toHaveBeenCalled();
    });

    it('requires at least 3 characters after trimming', async () => {
        const view = await ready('  ab  ');
        fireEvent.press(view.getByTestId('go-live'));
        expect(view.getByText('Le titre doit contenir au moins 3 caractères.')).toBeTruthy();
        expect(router.push).not.toHaveBeenCalled();
    });

    it('ignores a double tap', async () => {
        const view = await ready();
        await act(async () => {
            fireEvent.press(view.getByTestId('go-live'));
            fireEvent.press(view.getByTestId('go-live'));
        });
        expect(router.push).toHaveBeenCalledTimes(1);
    });

    it('warns that the live is recorded', async () => {
        const view = await ready();
        expect(view.getByText(/enregistré et rediffusé en replay public/)).toBeTruthy();
    });
});

describe('StudioScreen - schedule', () => {
    async function ready() {
        const view = await renderStudio();
        fireEvent.changeText(view.getByTestId('studio-title'), 'Brunch du dimanche');
        goTo(view, 3);
        return view;
    }

    it('creates a scheduled live, resets the form and shows a confirmation', async () => {
        mockedScheduled.mockResolvedValueOnce(null).mockResolvedValueOnce({ room_id: 'room-new', title: 'Brunch du dimanche', scheduled_at: '2030-05-12T07:30:00Z' });
        const view = await ready();
        pickFutureSlot(view);
        fireEvent.press(view.getByTestId('duration-45'));

        await act(async () => {
            fireEvent.press(view.getByTestId('schedule-live'));
        });

        expect(mockedSchedule).toHaveBeenCalledTimes(1);
        expect(mockedSchedule).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Brunch du dimanche',
                durationMinutes: 45,
                level: 'Débutant',
                scheduledAt: new Date(2030, 4, 12, 9, 30).toISOString(),
            })
        );
        expect(router.push).not.toHaveBeenCalled();
        expect(view.getByTestId('schedule-success')).toBeTruthy();
        // the form is empty again and the new scheduled live is on top
        expect(view.getByText('Étape 1 sur 3')).toBeTruthy();
        expect(view.getByTestId('studio-title').props.value).toBe('');
        await waitFor(() => expect(view.getByTestId('scheduled-live')).toBeTruthy());
    });

    it('uploads the picked photo first', async () => {
        mockedPicker.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg', mimeType: 'image/jpeg' }] });
        const view = await ready();
        pickFutureSlot(view);
        await act(async () => {
            fireEvent.press(view.getByTestId('thumbnail-choose'));
        });
        await act(async () => {
            fireEvent.press(view.getByTestId('schedule-live'));
        });
        expect(mockedUpload).toHaveBeenCalledTimes(1);
        expect(mockedSchedule).toHaveBeenCalledWith(expect.objectContaining({ thumbnailUrl: '/api/uploads/thumb.jpg' }));
    });

    it('refuses a slot in the past', async () => {
        const view = await ready();
        fireEvent(view.getByTestId('schedule-date'), 'onChange', {}, new Date(2020, 0, 1, 10, 0));
        await act(async () => {
            fireEvent.press(view.getByTestId('schedule-live'));
        });
        expect(view.getByTestId('schedule-invalid')).toBeTruthy();
        expect(mockedSchedule).not.toHaveBeenCalled();
    });

    it('explains a conflict and can stop the live in progress', async () => {
        mockedSchedule.mockRejectedValueOnce(new ApiError('you already have an active or scheduled live', 409, null));
        const view = await ready();
        pickFutureSlot(view);
        await act(async () => {
            fireEvent.press(view.getByTestId('schedule-live'));
        });
        expect(view.getByText('Tu as déjà un live actif ou planifié. Termine-le avant d’en créer un nouveau.')).toBeTruthy();

        await act(async () => {
            fireEvent.press(view.getByTestId('stop-active-live'));
        });
        expect(mockedStop).toHaveBeenCalledTimes(1);
        expect(view.queryByTestId('studio-error')).toBeNull();
    });

    it('says so when there is no live to stop', async () => {
        mockedSchedule.mockRejectedValueOnce(new ApiError('you already have an active or scheduled live', 409, null));
        mockedStop.mockResolvedValueOnce(false);
        const view = await ready();
        pickFutureSlot(view);
        await act(async () => {
            fireEvent.press(view.getByTestId('schedule-live'));
        });
        await act(async () => {
            fireEvent.press(view.getByTestId('stop-active-live'));
        });
        expect(view.getByText('Aucun live actif trouvé pour ton compte.')).toBeTruthy();
    });

    it('shows the failure message and keeps the form when scheduling fails', async () => {
        mockedSchedule.mockRejectedValueOnce(new ApiError('invalid scheduledAt format', 400, null));
        const view = await ready();
        pickFutureSlot(view);
        await act(async () => {
            fireEvent.press(view.getByTestId('schedule-live'));
        });
        expect(view.getByText('invalid scheduledAt format')).toBeTruthy();
        goTo(view, 1);
        expect(view.getByTestId('studio-title').props.value).toBe('Brunch du dimanche');
    });
});

describe('StudioScreen - scheduled live', () => {
    const scheduled = { room_id: 'room-sched', title: 'Brunch du dimanche', scheduled_at: '2030-05-12T09:30:00Z' };

    it('shows the scheduled live, blocks a second live and starts the existing room', async () => {
        mockedScheduled.mockResolvedValue(scheduled);
        const view = await renderStudio();

        await waitFor(() => expect(view.getByTestId('scheduled-live')).toBeTruthy());
        expect(view.getByText('Brunch du dimanche')).toBeTruthy();
        expect(view.getByText(/Planifié pour le/)).toBeTruthy();
        expect(view.getByText('Vous avez déjà un live actif')).toBeTruthy();

        // creating another live would be rejected by the backend (409): both actions are inert
        fireEvent.changeText(view.getByTestId('studio-title'), 'Autre live');
        goTo(view, 3);
        fireEvent.press(view.getByTestId('go-live'));
        fireEvent.press(view.getByTestId('schedule-live'));
        expect(router.push).not.toHaveBeenCalled();
        expect(mockedSchedule).not.toHaveBeenCalled();

        fireEvent.press(view.getByTestId('start-scheduled'));
        expect(router.push).toHaveBeenCalledWith({
            pathname: '/live-streaming',
            params: { mode: 'host', roomId: 'room-sched' },
        });
    });

    it('copes with a scheduled live that has no date', async () => {
        mockedScheduled.mockResolvedValue({ room_id: 'r', title: 'Sans date', scheduled_at: null });
        const view = await renderStudio();
        await waitFor(() => expect(view.getByText('Date non précisée')).toBeTruthy());
    });

    it('keeps the form usable when the scheduled live cannot be loaded', async () => {
        mockedScheduled.mockRejectedValue(new Error('network'));
        const view = await renderStudio();
        expect(view.queryByTestId('scheduled-live')).toBeNull();

        fireEvent.changeText(view.getByTestId('studio-title'), 'Pasta maison');
        goTo(view, 3);
        await act(async () => {
            fireEvent.press(view.getByTestId('go-live'));
        });
        expect(router.push).toHaveBeenCalledTimes(1);
    });
});
