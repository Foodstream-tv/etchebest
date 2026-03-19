import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import ForgotPasswordScreen from '../forgot-password';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        back: mockBack,
    }),
}));

describe('ForgotPasswordScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);

        expect(getByText('Récupération')).toBeTruthy();
        expect(getByText('Entrez votre adresse e-mail pour recevoir un lien de réinitialisation.')).toBeTruthy();
        expect(getByPlaceholderText('Adresse e-mail')).toBeTruthy();
        expect(getByText('Envoyer le lien')).toBeTruthy();
    });

    it('shows error for invalid email format', () => {
        const { getByText, getByPlaceholderText, queryByText } = render(<ForgotPasswordScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        fireEvent.changeText(emailInput, 'invalidemail');

        const submitButton = getByText('Envoyer le lien');
        fireEvent.press(submitButton);

        expect(getByText('Adresse e-mail invalide')).toBeTruthy();
        expect(queryByText('Vérifiez votre boîte mail')).toBeNull();
    });

    it('shows success view for valid email', () => {
        const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        fireEvent.changeText(emailInput, 'test@example.com');

        const submitButton = getByText('Envoyer le lien');
        fireEvent.press(submitButton);

        expect(getByText('Vérifiez votre boîte mail')).toBeTruthy();
        expect(getByText('Retour à la connexion')).toBeTruthy();
    });

    it('navigates back when back button is pressed', () => {
        const { getByTestId } = render(<ForgotPasswordScreen />);
        
        const backButton = getByTestId('back-button');
        fireEvent.press(backButton);

        expect(mockBack).toHaveBeenCalled();
    });

    it('navigates back when return to login button is pressed on success view', () => {
        const { getByText, getByPlaceholderText, getByTestId } = render(<ForgotPasswordScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        fireEvent.changeText(emailInput, 'test@example.com');

        const submitButton = getByText('Envoyer le lien');
        fireEvent.press(submitButton);

        const returnButton = getByTestId('return-to-login-button');
        fireEvent.press(returnButton);

        expect(mockBack).toHaveBeenCalled();
    });
});
