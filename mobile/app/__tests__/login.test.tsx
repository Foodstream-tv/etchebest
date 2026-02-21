import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Toast } from 'toastify-react-native';
import LoginScreen from '../login';

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
    }),
}));

describe('LoginScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        const { getByText, getByPlaceholderText } = render(<LoginScreen />);

        expect(getByText('Connexion')).toBeTruthy();
        expect(getByText('Bonjour,')).toBeTruthy();
        expect(getByPlaceholderText('Adresse e-mail')).toBeTruthy();
        expect(getByPlaceholderText('Mot de passe')).toBeTruthy();
        expect(getByText('Se connecter')).toBeTruthy();
    });

    it('shows floating label when email input is focused', () => {
        const { getByPlaceholderText, queryByText } = render(<LoginScreen />);
        const emailInput = getByPlaceholderText('Adresse e-mail');

        // Label should not be visible initially
        expect(queryByText('Adresse e-mail')).toBeNull();

        // Focus the input
        fireEvent(emailInput, 'focus');

        // Label should now be visible
        expect(queryByText('Adresse e-mail')).toBeTruthy();
    });

    it('shows floating label when password input has value', () => {
        const { getByPlaceholderText, getByText } = render(<LoginScreen />);
        const passwordInput = getByPlaceholderText('Mot de passe');

        // Type in the password field
        fireEvent.changeText(passwordInput, 'test123');

        // Label should be visible
        waitFor(() => {
            expect(getByText('Mot de passe')).toBeTruthy();
        });
    });

    it('displays error toast for invalid email', async () => {
        const { getByPlaceholderText, getByText } = render(<LoginScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const loginButton = getByText('Se connecter');

        fireEvent.changeText(emailInput, 'invalid-email');
        fireEvent.press(loginButton);

        await waitFor(() => {
            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    text1: 'Adresse e-mail invalide',
                    position: 'bottom',
                })
            );
        });
    });

    it('displays error toast for short password', async () => {
        const { getByPlaceholderText, getByText } = render(<LoginScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const passwordInput = getByPlaceholderText('Mot de passe');
        const loginButton = getByText('Se connecter');

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(passwordInput, '123');
        fireEvent.press(loginButton);

        await waitFor(() => {
            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    text1: 'Le mot de passe doit contenir au moins 8 caractères',
                    position: 'bottom',
                })
            );
        });
    });

    it('password is obscured by default', () => {
        const { getByPlaceholderText } = render(<LoginScreen />);
        const passwordInput = getByPlaceholderText('Mot de passe');

        // Password should be obscured by default
        expect(passwordInput.props.secureTextEntry).toBe(true);
    }); it('renders forgot password link', () => {
        const { getByText } = render(<LoginScreen />);
        const forgotPasswordLink = getByText('Mot de passe oublié ?');

        expect(forgotPasswordLink).toBeTruthy();
        fireEvent.press(forgotPasswordLink);
    }); it('renders register link', () => {
        const { getByText } = render(<LoginScreen />);
        const registerLink = getByText('Inscrivez-vous');

        expect(registerLink).toBeTruthy();
        fireEvent.press(registerLink);
    }); it('shows success toast on valid login', async () => {
        const { getByPlaceholderText, getByText } = render(<LoginScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const passwordInput = getByPlaceholderText('Mot de passe');
        const loginButton = getByText('Se connecter');

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(passwordInput, 'password123');
        fireEvent.press(loginButton);

        await waitFor(() => {
            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    text1: 'Connexion réussie !',
                    position: 'bottom',
                })
            );
        });
    }); it('shows toast when Google login is pressed', () => {
        const { getByText } = render(<LoginScreen />);
        const googleButton = getByText('Continuer avec Google');

        fireEvent.press(googleButton);

        expect(Toast.show).toHaveBeenCalledWith(
            expect.objectContaining({
                text1: 'Tentative de connexion avec Google',
                position: 'bottom',
            })
        );
    });

    it('shows toast when Apple login is pressed', () => {
        const { getByText } = render(<LoginScreen />);
        const appleButton = getByText('Continuer avec Apple');

        fireEvent.press(appleButton);

        expect(Toast.show).toHaveBeenCalledWith(
            expect.objectContaining({
                text1: 'Tentative de connexion avec Apple',
                position: 'bottom',
            })
        );
    });
});
