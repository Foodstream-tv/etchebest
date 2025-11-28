import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Toast } from 'toastify-react-native';
import RegisterScreen from '../register';

describe('RegisterScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        const { getAllByText, getByText, getByPlaceholderText } = render(<RegisterScreen />);

        expect(getAllByText('Inscription').length).toBeGreaterThan(0);
        expect(getByText('Bienvenue')).toBeTruthy();
        expect(getByPlaceholderText('Adresse e-mail')).toBeTruthy();
        expect(getByPlaceholderText('Identifiant')).toBeTruthy();
        expect(getByPlaceholderText('Mot de passe')).toBeTruthy();
    }); it('shows floating labels when inputs have values', async () => {
        const { getByPlaceholderText, getByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const usernameInput = getByPlaceholderText('Identifiant');

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(usernameInput, 'testuser');

        await waitFor(() => {
            expect(getByText('Adresse e-mail')).toBeTruthy();
            expect(getByText('Identifiant')).toBeTruthy();
        });
    });

    it('displays error toast for invalid email', async () => {
        const { getByPlaceholderText, getAllByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const registerButtons = getAllByText('Inscription');
        const registerButton = registerButtons[1]; // Get the button, not the heading

        fireEvent.changeText(emailInput, 'invalid-email');
        fireEvent.press(registerButton);

        await waitFor(() => {
            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    text1: 'Adresse e-mail invalide',
                    position: 'bottom',
                })
            );
        });
    });

    it('displays error toast for short username', async () => {
        const { getByPlaceholderText, getAllByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const usernameInput = getByPlaceholderText('Identifiant');
        const registerButtons = getAllByText('Inscription');
        const registerButton = registerButtons[1];

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(usernameInput, 'ab');
        fireEvent.press(registerButton);

        await waitFor(() => {
            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    text1: "L'identifiant doit contenir au moins 3 caractères",
                    position: 'bottom',
                })
            );
        });
    });

    it('displays error toast for short password', async () => {
        const { getByPlaceholderText, getAllByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const usernameInput = getByPlaceholderText('Identifiant');
        const passwordInput = getByPlaceholderText('Mot de passe');
        const registerButtons = getAllByText('Inscription');
        const registerButton = registerButtons[1];

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(usernameInput, 'testuser');
        fireEvent.changeText(passwordInput, '123');
        fireEvent.press(registerButton);

        await waitFor(() => {
            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    text1: 'Le mot de passe doit contenir au moins 8 caractères',
                    position: 'bottom',
                })
            );
        });
    });

    it('displays error toast for missing birthdate', async () => {
        const { getByPlaceholderText, getAllByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const usernameInput = getByPlaceholderText('Identifiant');
        const passwordInput = getByPlaceholderText('Mot de passe');
        const registerButtons = getAllByText('Inscription');
        const registerButton = registerButtons[1];

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(usernameInput, 'testuser');
        fireEvent.changeText(passwordInput, 'password123');
        fireEvent.press(registerButton);

        await waitFor(() => {
            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    text1: 'Veuillez entrer votre date de naissance',
                    position: 'bottom',
                })
            );
        });
    });

    it('submits form successfully with valid data', async () => {
        const { getByPlaceholderText, getAllByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const usernameInput = getByPlaceholderText('Identifiant');
        const passwordInput = getByPlaceholderText('Mot de passe');
        const dayInput = getByPlaceholderText('Jour');
        const monthInput = getByPlaceholderText('Mois');
        const yearInput = getByPlaceholderText('Année');
        const registerButtons = getAllByText('Inscription');
        const registerButton = registerButtons[1];

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(usernameInput, 'testuser');
        fireEvent.changeText(passwordInput, 'password123');
        fireEvent.changeText(dayInput, '15');
        fireEvent.changeText(monthInput, '06');
        fireEvent.changeText(yearInput, '1990');
        fireEvent.press(registerButton);

        await waitFor(() => {
            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    text1: 'Inscription réussie !',
                    position: 'bottom',
                })
            );
        });
    });

    it('handles date input correctly', () => {
        const { getByPlaceholderText } = render(<RegisterScreen />);

        const dayInput = getByPlaceholderText('Jour');
        const monthInput = getByPlaceholderText('Mois');
        const yearInput = getByPlaceholderText('Année');

        fireEvent.changeText(dayInput, '25');
        fireEvent.changeText(monthInput, '12');
        fireEvent.changeText(yearInput, '2000');

        expect(dayInput.props.value).toBe('25');
        expect(monthInput.props.value).toBe('12');
        expect(yearInput.props.value).toBe('2000');
    });
});
