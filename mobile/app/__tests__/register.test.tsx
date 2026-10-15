import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import apiService from '@/services/api';
import { ApiError } from '@/services/http';
import { toast } from '@/utils/toast';
import RegisterScreen from '../register';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/services/api', () => ({
    __esModule: true,
    default: {
        register: jest.fn(),
        loginWithGoogle: jest.fn(),
        getProfile: jest.fn(),
    },
}));

jest.mock('@/services/auth', () => ({
    __esModule: true,
    authService: { saveAuth: jest.fn(() => Promise.resolve()) },
}));

jest.mock('@/utils/toast', () => ({
    __esModule: true,
    toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
    default: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

const mockedRegister = apiService.register as jest.Mock;

type Utils = ReturnType<typeof render>;

function fillValidForm(utils: Utils, overrides: Partial<Record<'email' | 'password' | 'phone' | 'bio', string>> = {}) {
    fireEvent.changeText(utils.getByPlaceholderText('Adresse e-mail'), overrides.email ?? 'Test@Example.com');
    fireEvent.changeText(utils.getByPlaceholderText('Prénom'), 'John');
    fireEvent.changeText(utils.getByPlaceholderText('Nom'), 'Doe');
    fireEvent.changeText(utils.getByPlaceholderText("Nom d'utilisateur"), 'johnny');
    fireEvent.changeText(utils.getByPlaceholderText('Mot de passe'), overrides.password ?? 'password');
    fireEvent.changeText(utils.getByPlaceholderText('Numéro de téléphone (facultatif)'), overrides.phone ?? '0612345678');
    fireEvent.changeText(
        utils.getByPlaceholderText('Bio / Description (facultatif)'),
        overrides.bio ?? 'This is a long enough description.'
    );
    checkAge(utils);
}

const checkAge = (utils: Utils) => fireEvent.press(utils.getByTestId('register-age-checkbox'));

const submit = (utils: Utils) => fireEvent.press(utils.getByTestId('register-submit'));

describe('RegisterScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders every field with the web wording', () => {
        const { getByText, getByPlaceholderText } = render(<RegisterScreen />);

        expect(getByText('Créer un compte')).toBeTruthy();
        expect(getByText('Inscription')).toBeTruthy();
        expect(getByPlaceholderText('Adresse e-mail')).toBeTruthy();
        expect(getByPlaceholderText('Prénom')).toBeTruthy();
        expect(getByPlaceholderText('Nom')).toBeTruthy();
        expect(getByPlaceholderText("Nom d'utilisateur")).toBeTruthy();
        expect(getByPlaceholderText('Mot de passe')).toBeTruthy();
        expect(getByPlaceholderText('Numéro de téléphone (facultatif)')).toBeTruthy();
        expect(getByPlaceholderText('Bio / Description (facultatif)')).toBeTruthy();
        expect(getByText('Créer mon compte')).toBeTruthy();
    });

    it('links the terms and the privacy policy under the submit button', () => {
        const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
        const { getByTestId } = render(<RegisterScreen />);

        expect(getByTestId('register-legal')).toBeTruthy();
        fireEvent.press(getByTestId('register-terms-link'));
        fireEvent.press(getByTestId('register-privacy-link'));

        expect(open).toHaveBeenCalledWith('https://foodstream.tv/cgu');
        expect(open).toHaveBeenCalledWith('https://foodstream.tv/confidentialite');
    });

    it('sets autofill / keyboard hints on the fields', () => {
        const { getByPlaceholderText } = render(<RegisterScreen />);

        expect(getByPlaceholderText('Adresse e-mail').props).toMatchObject({
            keyboardType: 'email-address',
            autoComplete: 'email',
            textContentType: 'emailAddress',
        });
        expect(getByPlaceholderText('Mot de passe').props).toMatchObject({
            autoComplete: 'new-password',
            textContentType: 'newPassword',
            secureTextEntry: true,
        });
        expect(getByPlaceholderText('Numéro de téléphone (facultatif)').props).toMatchObject({
            keyboardType: 'phone-pad',
            textContentType: 'telephoneNumber',
        });
    });

    it('updates inputs when text changes', () => {
        const { getByPlaceholderText } = render(<RegisterScreen />);
        const email = getByPlaceholderText('Adresse e-mail');
        fireEvent.changeText(email, 'test@example.com');
        expect(getByPlaceholderText('Adresse e-mail').props.value).toBe('test@example.com');
    });

    it('does not call the API and shows every required error on an empty form', async () => {
        const utils = render(<RegisterScreen />);
        submit(utils);

        await waitFor(() => expect(utils.getByText('Veuillez renseigner votre adresse e-mail.')).toBeTruthy());
        expect(utils.getByText('Veuillez renseigner votre prénom.')).toBeTruthy();
        expect(utils.getByText('Veuillez renseigner votre nom.')).toBeTruthy();
        expect(utils.getByText("Veuillez choisir un nom d'utilisateur.")).toBeTruthy();
        expect(utils.getByText('Veuillez saisir un mot de passe.')).toBeTruthy();
        expect(utils.queryByText('Veuillez renseigner votre numéro de téléphone.')).toBeNull();
        expect(utils.queryByText('Veuillez ajouter une description (au moins 10 caractères).')).toBeNull();
        expect(utils.getByTestId('register-age-error')).toBeTruthy();
        expect(utils.getByText('Veuillez remplir correctement les champs indiqués.').props.accessibilityRole).toBe('alert');
        expect(mockedRegister).not.toHaveBeenCalled();
    });

    it('rejects an invalid e-mail', async () => {
        const utils = render(<RegisterScreen />);
        fillValidForm(utils, { email: 'invalid-email' });
        submit(utils);

        await waitFor(() =>
            expect(utils.getByText("L'adresse e-mail n'est pas valide (ex: contact@exemple.com).")).toBeTruthy()
        );
        expect(mockedRegister).not.toHaveBeenCalled();
    });

    it('rejects a password shorter than 8 characters (server minimum)', async () => {
        const utils = render(<RegisterScreen />);
        fillValidForm(utils, { password: 'short' });
        submit(utils);

        await waitFor(() => expect(utils.getByText('Le mot de passe doit faire au moins 8 caractères.')).toBeTruthy());
        expect(mockedRegister).not.toHaveBeenCalled();
    });

    it('accepts an 8 character password without complexity (same rule as web and backend)', async () => {
        mockedRegister.mockResolvedValueOnce({ message: 'ok', userId: 'u1', target: 'j***@e.com' });
        const utils = render(<RegisterScreen />);
        fillValidForm(utils, { password: 'password' });
        submit(utils);

        await waitFor(() => expect(mockedRegister).toHaveBeenCalled());
    });

    it('rejects a too short username and an invalid phone', async () => {
        const utils = render(<RegisterScreen />);
        fillValidForm(utils, { phone: '12345' });
        fireEvent.changeText(utils.getByPlaceholderText("Nom d'utilisateur"), 'ab');
        submit(utils);

        await waitFor(() => expect(utils.getByText("L'identifiant doit faire au moins 3 caractères.")).toBeTruthy());
        expect(utils.getByText('Le numéro de téléphone doit comporter au moins 6 chiffres.')).toBeTruthy();
    });

    it('clears a field error as soon as the user edits the field', async () => {
        const utils = render(<RegisterScreen />);
        submit(utils);
        await waitFor(() => expect(utils.getByText('Veuillez renseigner votre prénom.')).toBeTruthy());

        fireEvent.changeText(utils.getByPlaceholderText('Prénom'), 'John');
        expect(utils.queryByText('Veuillez renseigner votre prénom.')).toBeNull();
    });

    it('has no bio helper and no minimum on the bio', async () => {
        mockedRegister.mockResolvedValueOnce({ message: 'ok', userId: 'u1', target: 'x' });
        const utils = render(<RegisterScreen />);
        fillValidForm(utils, { bio: 'abc' });

        expect(utils.queryByTestId('bio-helper')).toBeNull();
        submit(utils);
        await waitFor(() => expect(mockedRegister).toHaveBeenCalledWith(expect.objectContaining({ description: 'abc' })));
    });

    it('caps the bio at 500 characters', () => {
        const utils = render(<RegisterScreen />);
        expect(utils.getByPlaceholderText('Bio / Description (facultatif)').props.maxLength).toBe(500);
    });

    it('registers without phone nor bio and omits them from the payload', async () => {
        mockedRegister.mockResolvedValueOnce({ message: 'ok', userId: 'user-1', target: 'x' });
        const utils = render(<RegisterScreen />);
        fillValidForm(utils, { phone: '', bio: '' });
        submit(utils);

        await waitFor(() => expect(mockedRegister).toHaveBeenCalledTimes(1));
        const body = mockedRegister.mock.calls[0][0];
        expect(body).toEqual({
            email: 'Test@Example.com',
            password: 'password',
            username: 'johnny',
            firstName: 'John',
            lastName: 'Doe',
            profileImage: '',
            ageConfirmed: true,
        });
        expect(body).not.toHaveProperty('numberPhone');
        expect(body).not.toHaveProperty('countryNumberPhone');
        expect(body).not.toHaveProperty('description');
    });

    it('treats a whitespace-only phone and bio as empty', async () => {
        mockedRegister.mockResolvedValueOnce({ message: 'ok', userId: 'user-1', target: 'x' });
        const utils = render(<RegisterScreen />);
        fillValidForm(utils, { phone: '   ', bio: '   ' });
        submit(utils);

        await waitFor(() => expect(mockedRegister).toHaveBeenCalledTimes(1));
        expect(mockedRegister.mock.calls[0][0]).not.toHaveProperty('numberPhone');
        expect(mockedRegister.mock.calls[0][0]).not.toHaveProperty('description');
    });

    it('blocks the submit and shows the age error while the age box is unchecked', async () => {
        const utils = render(<RegisterScreen />);
        fillValidForm(utils);
        checkAge(utils); // uncheck
        expect(utils.getByTestId('register-age-checkbox').props.accessibilityState).toMatchObject({ checked: false });
        submit(utils);

        await waitFor(() => expect(utils.getByTestId('register-age-error')).toBeTruthy());
        expect(utils.getByTestId('register-age-error').props.accessibilityRole).toBe('alert');
        expect(utils.getByText('Vous devez avoir au moins 15 ans pour créer un compte.')).toBeTruthy();
        expect(mockedRegister).not.toHaveBeenCalled();
    });

    it('exposes the age checkbox with the checkbox role and clears the error once checked', async () => {
        const utils = render(<RegisterScreen />);
        const box = () => utils.getByTestId('register-age-checkbox');
        expect(utils.getByText('Je confirme avoir au moins 15 ans.')).toBeTruthy();
        expect(box().props.accessibilityRole).toBe('checkbox');
        expect(box().props.accessibilityState).toMatchObject({ checked: false });

        submit(utils);
        await waitFor(() => expect(utils.getByTestId('register-age-error')).toBeTruthy());

        checkAge(utils);
        expect(box().props.accessibilityState).toMatchObject({ checked: true });
        expect(utils.queryByTestId('register-age-error')).toBeNull();
    });

    it('sends ageConfirmed: true when the age box is checked', async () => {
        mockedRegister.mockResolvedValueOnce({ message: 'ok', userId: 'user-1', target: 'x' });
        const utils = render(<RegisterScreen />);
        fillValidForm(utils);
        submit(utils);

        await waitFor(() => expect(mockedRegister).toHaveBeenCalledWith(expect.objectContaining({ ageConfirmed: true })));
    });

    it('still validates a typed phone and a too long bio', async () => {
        const utils = render(<RegisterScreen />);
        fillValidForm(utils, { phone: 'abc', bio: 'x'.repeat(501) });
        submit(utils);

        await waitFor(() => expect(utils.getByText('Le numéro de téléphone doit comporter au moins 6 chiffres.')).toBeTruthy());
        expect(utils.getByText('La description ne peut pas dépasser 500 caractères.')).toBeTruthy();
        expect(mockedRegister).not.toHaveBeenCalled();
    });

    it('registers, then goes to /verify (not /login) with userId and the typed e-mail', async () => {
        mockedRegister.mockResolvedValueOnce({ message: 'ok', userId: 'user-1', target: 'T***t@example.com' });
        const utils = render(<RegisterScreen />);
        fillValidForm(utils);
        submit(utils);

        await waitFor(() =>
            expect(mockRouter.replace).toHaveBeenCalledWith({
                pathname: '/verify',
                params: { email: 'test@example.com', userId: 'user-1' },
            })
        );
        expect(mockedRegister).toHaveBeenCalledWith({
            email: 'Test@Example.com',
            password: 'password',
            username: 'johnny',
            firstName: 'John',
            lastName: 'Doe',
            description: 'This is a long enough description.',
            countryNumberPhone: 33,
            numberPhone: '0612345678',
            profileImage: '',
            ageConfirmed: true,
        });
        expect(mockRouter.replace).not.toHaveBeenCalledWith('/login');
    });

    it('forwards the dev code returned by the server in dev mode', async () => {
        mockedRegister.mockResolvedValueOnce({ message: 'ok', userId: 'user-1', target: 'x', devCode: '123456' });
        const utils = render(<RegisterScreen />);
        fillValidForm(utils);
        submit(utils);

        await waitFor(() =>
            expect(mockRouter.replace).toHaveBeenCalledWith({
                pathname: '/verify',
                params: { email: 'test@example.com', userId: 'user-1', devCode: '123456' },
            })
        );
    });

    it('uses the selected country code', async () => {
        mockedRegister.mockResolvedValueOnce({ message: 'ok', userId: 'user-1', target: 'x' });
        const utils = render(<RegisterScreen />);
        fillValidForm(utils);

        fireEvent.press(utils.getByTestId('country-picker-button'));
        fireEvent.press(utils.getByLabelText('Belgique +32'));
        submit(utils);

        await waitFor(() => expect(mockedRegister).toHaveBeenCalledWith(expect.objectContaining({ countryNumberPhone: 32 })));
    });

    it('maps EMAIL_ALREADY_EXISTS to a clear message on the e-mail field', async () => {
        mockedRegister.mockRejectedValueOnce(
            new ApiError('this email is already being used', 400, {
                error: 'this email is already being used',
                code: 'EMAIL_ALREADY_EXISTS',
            })
        );
        const utils = render(<RegisterScreen />);
        fillValidForm(utils);
        submit(utils);

        await waitFor(() => expect(utils.getAllByText('Cette adresse e-mail est déjà utilisée.').length).toBeGreaterThan(0));
        expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('maps USERNAME_ALREADY_EXISTS', async () => {
        mockedRegister.mockRejectedValueOnce(
            new ApiError('this username is already taken', 400, { code: 'USERNAME_ALREADY_EXISTS' })
        );
        const utils = render(<RegisterScreen />);
        fillValidForm(utils);
        submit(utils);

        await waitFor(() => expect(utils.getAllByText("Ce nom d'utilisateur est déjà pris.").length).toBeGreaterThan(0));
    });

    it('shows a generic error and a toast for other failures, without leaking the raw message', async () => {
        mockedRegister.mockRejectedValueOnce(new ApiError('pq: duplicate key value violates', 500, { error: 'pq: duplicate' }));
        const utils = render(<RegisterScreen />);
        fillValidForm(utils);
        submit(utils);

        await waitFor(() => expect(utils.getByText('Impossible de créer le compte. Réessayez.')).toBeTruthy());
        expect(utils.queryByText(/duplicate/)).toBeNull();
        expect(toast.error).toHaveBeenCalledWith('Impossible de créer le compte. Réessayez.');
    });

    it('ignores double submissions while the request is pending', async () => {
        let resolveRegister: (value: unknown) => void = () => {};
        mockedRegister.mockReturnValueOnce(new Promise((resolve) => (resolveRegister = resolve)));
        const utils = render(<RegisterScreen />);
        fillValidForm(utils);
        submit(utils);
        submit(utils);
        submit(utils);

        expect(mockedRegister).toHaveBeenCalledTimes(1);
        await act(async () => {
            resolveRegister({ message: 'ok', userId: 'u', target: 'x' });
        });
    });

    it('goes back to the login screen', () => {
        const { getByTestId, getByText } = render(<RegisterScreen />);

        fireEvent.press(getByTestId('register-back'));
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');

        mockRouter.replace.mockClear();
        fireEvent.press(getByText('Connectez-vous'));
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });

    it('offers Google sign-in (same flow as the login screen)', () => {
        const { getByTestId } = render(<RegisterScreen />);
        expect(getByTestId('google-register-button')).toBeTruthy();
    });

    it('tells Google sign-up users that continuing confirms they are at least 15', () => {
        const { getByTestId } = render(<RegisterScreen />);
        expect(getByTestId('register-google-age-notice').props.children).toBe(
            'En continuant avec Google, vous confirmez avoir au moins 15 ans.'
        );
    });
});
