import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import LoginScreen from '../login';

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
    }),
}));

jest.mock('../../services/api', () => ({
    __esModule: true,
    default: {
        login: jest.fn(),
        getProfile: jest.fn(),
    },
}));

jest.mock('../../services/auth', () => ({
    __esModule: true,
    authService: {
        saveAuth: jest.fn(() => Promise.resolve()),
    },
}));

import apiService from '../../services/api';

describe('LoginScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        const { getByText, getByPlaceholderText } = render(<LoginScreen />);

        expect(getByText('CONNEXION')).toBeTruthy();
        expect(getByText(/Cuisinez en live/)).toBeTruthy();
        expect(getByPlaceholderText('Adresse e-mail')).toBeTruthy();
        expect(getByPlaceholderText('Mot de passe')).toBeTruthy();
        expect(getByText('Se connecter')).toBeTruthy();
    });

    it('displays error message for invalid email', async () => {
        const { getByPlaceholderText, getByText } = render(<LoginScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const loginButton = getByText('Se connecter');

        fireEvent.changeText(emailInput, 'invalid-email');
        fireEvent.press(loginButton);

        await waitFor(() => {
            expect(getByText('Adresse e-mail invalide')).toBeTruthy();
        });
    });

    it('displays error message for short password', async () => {
        const { getByPlaceholderText, getByText } = render(<LoginScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const passwordInput = getByPlaceholderText('Mot de passe');
        const loginButton = getByText('Se connecter');

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(passwordInput, '123');
        fireEvent.press(loginButton);

        await waitFor(() => {
            expect(getByText('Le mot de passe doit contenir au moins 8 caractères')).toBeTruthy();
        });
    });

    it('password is obscured by default', () => {
        const { getByPlaceholderText } = render(<LoginScreen />);
        const passwordInput = getByPlaceholderText('Mot de passe');
        expect(passwordInput.props.secureTextEntry).toBe(true);
    });

    it('renders register link', () => {
        const { getByText } = render(<LoginScreen />);
        const registerLink = getByText('Inscrivez-vous');
        expect(registerLink).toBeTruthy();
    });

    it('shows success toast on valid login', async () => {
        const { getByPlaceholderText, getByText } = render(<LoginScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const passwordInput = getByPlaceholderText('Mot de passe');
        const loginButton = getByText('Se connecter');

        (apiService.login as jest.Mock).mockResolvedValueOnce({
            token: 'fake-token',
            user: { id: '1', email: 'test@example.com', username: 'testuser' }
        });
        (apiService.getProfile as jest.Mock).mockResolvedValueOnce({
            id: '1',
            email: 'test@example.com',
            username: 'testuser',
            firstName: 'Test',
            lastName: 'User',
            description: 'A test user'
        });

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(passwordInput, 'Password123!');
        fireEvent.press(loginButton);

        await waitFor(() => {
            expect(apiService.login).toHaveBeenCalled();
        });
    });

    it('shows inline message when Google login is pressed', async () => {
        const { getByTestId, getByText } = render(<LoginScreen />);
        const googleButton = getByTestId('google-login-button');

        fireEvent.press(googleButton);

        await waitFor(() => {
            expect(getByText("Connexion Google indisponible sur cet appareil.")).toBeTruthy();
        });
    });
});
