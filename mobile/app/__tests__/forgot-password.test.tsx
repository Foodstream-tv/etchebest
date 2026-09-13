import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import ForgotPasswordScreen from '../forgot-password';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        replace: mockReplace,
    }),
}));

describe('ForgotPasswordScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);

        expect(getByText('Mot de passe oublie')).toBeTruthy();
        expect(getByText(/Entrez votre e-mail/)).toBeTruthy();
        expect(getByPlaceholderText('Adresse e-mail')).toBeTruthy();
        expect(getByText('Envoyer le lien')).toBeTruthy();
    });

    it('shows error for invalid email format', () => {
        const { getByText, getByPlaceholderText, queryByText } = render(<ForgotPasswordScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        fireEvent.changeText(emailInput, 'invalidemail');

        const submitButton = getByText('Envoyer le lien');
        fireEvent.press(submitButton);

        expect(getByText('Veuillez entrer une adresse e-mail valide')).toBeTruthy();
        expect(queryByText(/Si un compte existe pour/)).toBeNull();
    });

    it('shows success view for valid email', () => {
        const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        fireEvent.changeText(emailInput, 'test@example.com');

        const submitButton = getByText('Envoyer le lien');
        fireEvent.press(submitButton);

        expect(getByText(/Si un compte existe pour/)).toBeTruthy();
        expect(getByText('Retour a la connexion')).toBeTruthy();
    });

    it('navigates back when back to login button is pressed', () => {
        const { getByTestId } = render(<ForgotPasswordScreen />);
        
        const backButton = getByTestId('back-to-login-button');
        fireEvent.press(backButton);

        expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('navigates back when return to login button is pressed on success view', () => {
        const { getByText, getByPlaceholderText, getByTestId } = render(<ForgotPasswordScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        fireEvent.changeText(emailInput, 'test@example.com');

        const submitButton = getByText('Envoyer le lien');
        fireEvent.press(submitButton);

        const returnButton = getByTestId('back-to-login-button');
        fireEvent.press(returnButton);

        expect(mockReplace).toHaveBeenCalledWith('/login');
    });
});
