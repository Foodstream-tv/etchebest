import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import RegisterScreen from '../register';

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
    }),
}));

jest.mock('../../services/api', () => ({
    __esModule: true,
    default: {
        register: jest.fn(),
    },
}));

import apiService from '../../services/api';

describe('RegisterScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly', () => {
        const { getAllByText, getByText, getByPlaceholderText } = render(<RegisterScreen />);

        expect(getAllByText('Inscription').length).toBeGreaterThan(0);
        expect(getByText('Créez votre compte pour commencer !')).toBeTruthy();
        expect(getByPlaceholderText('Adresse e-mail')).toBeTruthy();
        expect(getByPlaceholderText('Prénom')).toBeTruthy();
        expect(getByPlaceholderText('Nom')).toBeTruthy();
        expect(getByPlaceholderText('Identifiant')).toBeTruthy();
        expect(getByPlaceholderText('Mot de passe')).toBeTruthy();
        expect(getByPlaceholderText('Numéro de téléphone')).toBeTruthy();
        expect(getByPlaceholderText('Description')).toBeTruthy();
    });

    it('shows floating labels when inputs have values', async () => {
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

    it('displays error message for invalid email', async () => {
        const { getByPlaceholderText, getAllByText, getByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const registerButton = getAllByText('Inscription')[1];

        fireEvent.changeText(emailInput, 'invalid-email');
        fireEvent.press(registerButton);

        await waitFor(() => {
            expect(getByText('Adresse e-mail invalide')).toBeTruthy();
        });
    });

    it('displays error message for short username', async () => {
        const { getByPlaceholderText, getAllByText, getByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const usernameInput = getByPlaceholderText('Identifiant');
        const registerButton = getAllByText('Inscription')[1];

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(usernameInput, 'ab');
        fireEvent.press(registerButton);

        await waitFor(() => {
            expect(getByText("L'identifiant doit contenir au moins 3 caractères")).toBeTruthy();
        });
    });

    it('displays error message for weak password', async () => {
        const { getByPlaceholderText, getAllByText, getByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const usernameInput = getByPlaceholderText('Identifiant');
        const passwordInput = getByPlaceholderText('Mot de passe');
        const registerButton = getAllByText('Inscription')[1];

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(usernameInput, 'testuser');
        fireEvent.changeText(passwordInput, 'password123'); // No uppercase, no special char
        fireEvent.press(registerButton);

        await waitFor(() => {
            expect(getByText('Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule, un chiffre et un caractère spécial')).toBeTruthy();
        });
    });

    it('displays error message for missing phone', async () => {
        const { getByPlaceholderText, getAllByText, getByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const firstNameInput = getByPlaceholderText('Prénom');
        const lastNameInput = getByPlaceholderText('Nom');
        const usernameInput = getByPlaceholderText('Identifiant');
        const passwordInput = getByPlaceholderText('Mot de passe');
        const registerButton = getAllByText('Inscription')[1];

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(firstNameInput, 'John');
        fireEvent.changeText(lastNameInput, 'Doe');
        fireEvent.changeText(usernameInput, 'testuser');
        fireEvent.changeText(passwordInput, 'Password123!');
        fireEvent.press(registerButton);

        await waitFor(() => {
            expect(getByText('Numéro de téléphone requis')).toBeTruthy();
        });
    });

    it('submits form successfully with valid data', async () => {
        const { getByPlaceholderText, getAllByText } = render(<RegisterScreen />);

        const emailInput = getByPlaceholderText('Adresse e-mail');
        const firstNameInput = getByPlaceholderText('Prénom');
        const lastNameInput = getByPlaceholderText('Nom');
        const usernameInput = getByPlaceholderText('Identifiant');
        const passwordInput = getByPlaceholderText('Mot de passe');
        const phoneInput = getByPlaceholderText('Numéro de téléphone');
        const descriptionInput = getByPlaceholderText('Description');
        const registerButton = getAllByText('Inscription')[1];

        (apiService.register as jest.Mock).mockResolvedValueOnce({
            token: 'fake-token',
            user: { id: '1', email: 'test@example.com', username: 'testuser' }
        });

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(firstNameInput, 'John');
        fireEvent.changeText(lastNameInput, 'Doe');
        fireEvent.changeText(usernameInput, 'testuser');
        fireEvent.changeText(passwordInput, 'Password123!');
        fireEvent.changeText(phoneInput, '0612345678');
        fireEvent.changeText(descriptionInput, 'This is a long enough description for the test.');
        fireEvent.press(registerButton);

        await waitFor(() => {
            expect(apiService.register).toHaveBeenCalled();
        });
    });
});
