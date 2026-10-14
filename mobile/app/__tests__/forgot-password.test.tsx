import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import apiService from '@/services/api';
import { ApiError } from '@/services/http';
import ForgotPasswordScreen from '../forgot-password';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/services/api', () => ({
    __esModule: true,
    default: { forgotPassword: jest.fn() },
}));

const mockedForgot = apiService.forgotPassword as jest.Mock;

describe('ForgotPasswordScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);

        expect(getByText('Réinitialisation')).toBeTruthy();
        expect(getByText('Mot de passe oublié')).toBeTruthy();
        expect(getByText(/Entrez votre adresse e-mail/)).toBeTruthy();
        expect(getByPlaceholderText('Adresse e-mail')).toBeTruthy();
        expect(getByText('Envoyer le lien')).toBeTruthy();
    });

    it('sets e-mail autofill hints', () => {
        const { getByPlaceholderText } = render(<ForgotPasswordScreen />);
        expect(getByPlaceholderText('Adresse e-mail').props).toMatchObject({
            keyboardType: 'email-address',
            autoComplete: 'email',
            textContentType: 'emailAddress',
            autoCapitalize: 'none',
        });
    });

    it('shows an error for an invalid e-mail and does not call the API', async () => {
        const { getByText, getByPlaceholderText, queryByText } = render(<ForgotPasswordScreen />);

        fireEvent.changeText(getByPlaceholderText('Adresse e-mail'), 'invalidemail');
        fireEvent.press(getByText('Envoyer le lien'));

        await waitFor(() => expect(getByText('Adresse e-mail invalide.')).toBeTruthy());
        expect(getByText('Adresse e-mail invalide.').props.accessibilityRole).toBe('alert');
        expect(queryByText('Un email de réinitialisation a été envoyé.')).toBeNull();
        expect(mockedForgot).not.toHaveBeenCalled();
    });

    it('shows an error for an empty e-mail', async () => {
        const { getByText } = render(<ForgotPasswordScreen />);
        fireEvent.press(getByText('Envoyer le lien'));
        await waitFor(() => expect(getByText('Adresse e-mail invalide.')).toBeTruthy());
        expect(mockedForgot).not.toHaveBeenCalled();
    });

    it('really calls the backend and then shows the success view', async () => {
        mockedForgot.mockResolvedValueOnce({ message: 'If an account exists...' });
        const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(<ForgotPasswordScreen />);

        fireEvent.changeText(getByPlaceholderText('Adresse e-mail'), 'test@example.com');
        fireEvent.press(getByText('Envoyer le lien'));

        await waitFor(() => expect(getByText('Un email de réinitialisation a été envoyé.')).toBeTruthy());
        expect(mockedForgot).toHaveBeenCalledWith('test@example.com');
        expect(getByText('Email envoyé')).toBeTruthy();
        expect(queryByPlaceholderText('Adresse e-mail')).toBeNull();
    });

    it('shows the web error when the backend refuses the request', async () => {
        mockedForgot.mockRejectedValueOnce(new ApiError('invalid request body', 400, { error: 'invalid request body' }));
        const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);

        fireEvent.changeText(getByPlaceholderText('Adresse e-mail'), 'test@example.com');
        fireEvent.press(getByText('Envoyer le lien'));

        await waitFor(() => expect(getByText('Envoi impossible.')).toBeTruthy());
    });

    it('shows a generic error on network failures', async () => {
        mockedForgot.mockRejectedValueOnce(new Error('Erreur réseau'));
        const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);

        fireEvent.changeText(getByPlaceholderText('Adresse e-mail'), 'test@example.com');
        fireEvent.press(getByText('Envoyer le lien'));

        await waitFor(() => expect(getByText('Une erreur est survenue.')).toBeTruthy());
    });

    it('sends only one request when pressed repeatedly', async () => {
        let resolveRequest: (value: unknown) => void = () => {};
        mockedForgot.mockReturnValueOnce(new Promise((resolve) => (resolveRequest = resolve)));
        const { getByText, getByPlaceholderText, getByTestId } = render(<ForgotPasswordScreen />);

        fireEvent.changeText(getByPlaceholderText('Adresse e-mail'), 'test@example.com');
        fireEvent.press(getByTestId('forgot-submit'));
        fireEvent.press(getByTestId('forgot-submit'));

        expect(mockedForgot).toHaveBeenCalledTimes(1);
        await act(async () => {
            resolveRequest({});
        });
        await waitFor(() => expect(getByText('Email envoyé')).toBeTruthy());
    });

    it('navigates back to login from the form', () => {
        const { getByTestId } = render(<ForgotPasswordScreen />);
        fireEvent.press(getByTestId('back-to-login-button'));
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });

    it('navigates back to login from the success view', async () => {
        mockedForgot.mockResolvedValueOnce({});
        const { getByText, getByPlaceholderText, getByTestId } = render(<ForgotPasswordScreen />);

        fireEvent.changeText(getByPlaceholderText('Adresse e-mail'), 'test@example.com');
        fireEvent.press(getByText('Envoyer le lien'));
        await waitFor(() => expect(getByText('Email envoyé')).toBeTruthy());

        fireEvent.press(getByTestId('back-to-login-button'));
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });
});
