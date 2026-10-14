import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ApiError } from '@/services/http';
import apiService from '@/services/api';
import { authService } from '@/services/auth';
import LoginScreen from '../login';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/services/api', () => ({
    __esModule: true,
    default: {
        login: jest.fn(),
        getProfile: jest.fn(),
        loginWithGoogle: jest.fn(),
    },
}));

jest.mock('@/services/auth', () => ({
    __esModule: true,
    authService: {
        saveAuth: jest.fn(() => Promise.resolve()),
    },
}));

const mockGoogleSignin = {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(),
    getTokens: jest.fn(),
};
jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: {
        configure: (...args: unknown[]) => mockGoogleSignin.configure(...args),
        hasPlayServices: () => mockGoogleSignin.hasPlayServices(),
        signIn: () => mockGoogleSignin.signIn(),
        getTokens: () => mockGoogleSignin.getTokens(),
    },
    statusCodes: {
        SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
        IN_PROGRESS: 'IN_PROGRESS',
        PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    },
}));

const mockedApi = apiService as unknown as Record<'login' | 'getProfile' | 'loginWithGoogle', jest.Mock>;
const mockedSaveAuth = authService.saveAuth as jest.Mock;

const PROFILE = {
    id: 'u1',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    description: 'A test user',
    profileImageUrl: '',
    role: 'USER',
};

function fillAndSubmit(utils: ReturnType<typeof render>, email: string, password: string) {
    fireEvent.changeText(utils.getByPlaceholderText('Adresse e-mail'), email);
    fireEvent.changeText(utils.getByPlaceholderText('Mot de passe'), password);
    fireEvent.press(utils.getByTestId('login-submit'));
}

describe('LoginScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedSaveAuth.mockImplementation(() => Promise.resolve());
    });

    it('renders the web wording and the hero', () => {
        const { getByText, getByPlaceholderText, getByTestId } = render(<LoginScreen />);

        expect(getByText('Connexion')).toBeTruthy();
        expect(getByText('Bienvenue')).toBeTruthy();
        expect(getByText(/Cuisinez en live/)).toBeTruthy();
        expect(getByPlaceholderText('Adresse e-mail')).toBeTruthy();
        expect(getByPlaceholderText('Mot de passe')).toBeTruthy();
        expect(getByText('Se connecter')).toBeTruthy();
        expect(getByText('Mot de passe oublié ?')).toBeTruthy();
        expect(getByText('Continuer avec Google')).toBeTruthy();
        expect(getByTestId('google-login-button')).toBeTruthy();
    });

    it('configures the fields for autofill and keyboards', () => {
        const { getByPlaceholderText } = render(<LoginScreen />);
        const email = getByPlaceholderText('Adresse e-mail');
        const password = getByPlaceholderText('Mot de passe');

        expect(email.props.keyboardType).toBe('email-address');
        expect(email.props.autoCapitalize).toBe('none');
        expect(email.props.autoComplete).toBe('email');
        expect(email.props.textContentType).toBe('emailAddress');
        expect(email.props.returnKeyType).toBe('next');
        expect(password.props.autoComplete).toBe('current-password');
        expect(password.props.textContentType).toBe('password');
        expect(password.props.returnKeyType).toBe('go');
    });

    it('obscures the password by default and toggles it with an accessible button', () => {
        const { getByPlaceholderText, getByLabelText } = render(<LoginScreen />);
        expect(getByPlaceholderText('Mot de passe').props.secureTextEntry).toBe(true);

        fireEvent.press(getByLabelText('Afficher le mot de passe'));
        expect(getByPlaceholderText('Mot de passe').props.secureTextEntry).toBe(false);
        expect(getByLabelText('Masquer le mot de passe')).toBeTruthy();
    });

    it('shows an invalid e-mail error and does not call the API', async () => {
        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'invalid-email', 'whatever');

        await waitFor(() => expect(utils.getByText('Adresse e-mail invalide.')).toBeTruthy());
        expect(mockedApi.login).not.toHaveBeenCalled();
    });

    it('requires a password but nothing more (no complexity rules)', async () => {
        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', '');

        await waitFor(() => expect(utils.getByText('Veuillez entrer votre mot de passe.')).toBeTruthy());
        expect(mockedApi.login).not.toHaveBeenCalled();
    });

    it.each(['abc', 'password', '12345678', 'ALLUPPERCASE'])(
        'sends a legacy password that does not satisfy today\'s rules (%p)',
        async (password) => {
            mockedApi.login.mockRejectedValueOnce(new ApiError('invalid email or password', 401, { error: 'x' }));
            const utils = render(<LoginScreen />);
            fillAndSubmit(utils, 'test@example.com', password);

            await waitFor(() => expect(mockedApi.login).toHaveBeenCalledWith({ email: 'test@example.com', password }));
            expect(utils.queryByText(/au moins 8 caractères/)).toBeNull();
        }
    );

    it('logs in: loads the profile with the explicit token, saves the session, then goes home', async () => {
        mockedApi.login.mockResolvedValueOnce({ token: 'tok' });
        mockedApi.getProfile.mockResolvedValueOnce(PROFILE);

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'Password123!');

        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
        expect(mockedApi.getProfile).toHaveBeenCalledWith('tok');
        expect(mockedSaveAuth).toHaveBeenCalledTimes(1);
        expect(mockedSaveAuth).toHaveBeenCalledWith('tok', expect.objectContaining({ id: 'u1', username: 'testuser' }));
    });

    it('does not keep a half-session when the profile cannot be loaded', async () => {
        mockedApi.login.mockResolvedValueOnce({ token: 'tok' });
        mockedApi.getProfile.mockRejectedValueOnce(new Error('network down'));

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'Password123!');

        await waitFor(() => expect(utils.getByText('Impossible de récupérer votre profil.')).toBeTruthy());
        expect(mockedSaveAuth).not.toHaveBeenCalled();
        expect(mockRouter.replace).not.toHaveBeenCalled();
        // the form is usable again
        expect(utils.getByTestId('login-submit').props.accessibilityState.disabled).toBe(false);
    });

    it('treats a profile without id as a failure', async () => {
        mockedApi.login.mockResolvedValueOnce({ token: 'tok' });
        mockedApi.getProfile.mockResolvedValueOnce({});

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'Password123!');

        await waitFor(() => expect(utils.getByText('Impossible de récupérer votre profil.')).toBeTruthy());
        expect(mockedSaveAuth).not.toHaveBeenCalled();
    });

    it('shows an error when the server does not return a token', async () => {
        mockedApi.login.mockResolvedValueOnce({});

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'Password123!');

        await waitFor(() => expect(utils.getByText('Réponse invalide du serveur.')).toBeTruthy());
        expect(mockedApi.getProfile).not.toHaveBeenCalled();
    });

    it('sends an unverified account to /verify with its userId and email', async () => {
        mockedApi.login.mockRejectedValueOnce(
            new ApiError('your account is not verified yet', 403, {
                error: 'your account is not verified yet',
                code: 'ACCOUNT_NOT_VERIFIED',
                userId: 'user-42',
                email: 'Test@Example.com',
            })
        );

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'Password123!');

        await waitFor(() =>
            expect(mockRouter.push).toHaveBeenCalledWith({
                pathname: '/verify',
                params: { email: 'Test@Example.com', userId: 'user-42' },
            })
        );
        expect(utils.getByText("Votre compte n'est pas encore vérifié.")).toBeTruthy();
        expect(mockedSaveAuth).not.toHaveBeenCalled();

        // the "validate my account" link is a way back to the verification screen
        mockRouter.push.mockClear();
        fireEvent.press(utils.getByLabelText('Valider mon compte'));
        expect(mockRouter.push).toHaveBeenCalledWith({
            pathname: '/verify',
            params: { email: 'Test@Example.com', userId: 'user-42' },
        });
    });

    it('falls back to the typed e-mail when the server does not echo it', async () => {
        mockedApi.login.mockRejectedValueOnce(new ApiError('nv', 403, { code: 'ACCOUNT_NOT_VERIFIED' }));

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, '  me@example.com ', 'Password123!');

        await waitFor(() =>
            expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/verify', params: { email: 'me@example.com' } })
        );
    });

    it('shows the permanent ban message', async () => {
        mockedApi.login.mockRejectedValueOnce(
            new ApiError('your account is banned', 403, { error: 'your account is banned', banReason: 'spam', bannedUntil: null })
        );

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'Password123!');

        await waitFor(() => expect(utils.getByText('Votre compte a été banni définitivement.')).toBeTruthy());
        expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('shows the temporary ban message', async () => {
        const until = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
        mockedApi.login.mockRejectedValueOnce(
            new ApiError('your account is banned', 403, { error: 'your account is banned', bannedUntil: until })
        );

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'Password123!');

        await waitFor(() => expect(utils.getByText(/Votre compte est temporairement banni/)).toBeTruthy());
    });

    it('shows the invalid credentials message on 401', async () => {
        mockedApi.login.mockRejectedValueOnce(new ApiError('invalid email or password', 401, { error: 'invalid email or password' }));

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'wrong-password');

        await waitFor(() => expect(utils.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeTruthy());
        expect(utils.getByText('Adresse e-mail ou mot de passe incorrect.').props.accessibilityRole).toBe('alert');
    });

    it('treats a 400 (password shorter than the server minimum) as invalid credentials', async () => {
        mockedApi.login.mockRejectedValueOnce(new ApiError('invalid request', 400, { error: 'invalid request' }));

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'abc');

        await waitFor(() => expect(utils.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeTruthy());
    });

    it('shows a generic error for server and network failures', async () => {
        mockedApi.login.mockRejectedValueOnce(new ApiError('boom', 500, { error: 'boom' }));
        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'Password123!');
        await waitFor(() => expect(utils.getByText('Une erreur est survenue lors de la connexion.')).toBeTruthy());

        mockedApi.login.mockRejectedValueOnce(new Error('Erreur réseau.'));
        fireEvent.press(utils.getByTestId('login-submit'));
        await waitFor(() => expect(utils.getByText('Une erreur est survenue lors de la connexion.')).toBeTruthy());
        expect(utils.queryByText('Erreur réseau.')).toBeNull();
    });

    it('ignores a second press while a login is in flight', async () => {
        let resolveLogin: (value: { token: string }) => void = () => {};
        mockedApi.login.mockReturnValueOnce(new Promise((resolve) => (resolveLogin = resolve)));
        mockedApi.getProfile.mockResolvedValueOnce(PROFILE);

        const utils = render(<LoginScreen />);
        fillAndSubmit(utils, 'test@example.com', 'Password123!');
        fireEvent.press(utils.getByTestId('login-submit'));
        fireEvent.press(utils.getByTestId('login-submit'));

        expect(mockedApi.login).toHaveBeenCalledTimes(1);
        await act(async () => {
            resolveLogin({ token: 'tok' });
        });
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    });

    it('navigates to register and forgot-password', () => {
        const { getByText } = render(<LoginScreen />);

        fireEvent.press(getByText('Inscrivez-vous'));
        expect(mockRouter.push).toHaveBeenCalledWith('/register');

        fireEvent.press(getByText('Mot de passe oublié ?'));
        expect(mockRouter.push).toHaveBeenCalledWith('/forgot-password');
    });

    describe('Google sign-in', () => {
        it('signs in with the native Google token, then loads the profile and goes home', async () => {
            mockGoogleSignin.signIn.mockResolvedValueOnce({});
            mockGoogleSignin.getTokens.mockResolvedValueOnce({ accessToken: 'google-access' });
            mockedApi.loginWithGoogle.mockResolvedValueOnce({ token: 'app-token' });
            mockedApi.getProfile.mockResolvedValueOnce(PROFILE);

            const { getByTestId } = render(<LoginScreen />);
            fireEvent.press(getByTestId('google-login-button'));

            await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
            expect(mockedApi.loginWithGoogle).toHaveBeenCalledWith('google-access');
            expect(mockedApi.getProfile).toHaveBeenCalledWith('app-token');
            expect(mockedSaveAuth).toHaveBeenCalledWith('app-token', expect.objectContaining({ id: 'u1' }));
        });

        it('shows a neutral message when the user cancels', async () => {
            mockGoogleSignin.signIn.mockRejectedValueOnce({ code: 'SIGN_IN_CANCELLED' });

            const { getByTestId, getByText } = render(<LoginScreen />);
            fireEvent.press(getByTestId('google-login-button'));

            await waitFor(() => expect(getByText('Connexion annulée.')).toBeTruthy());
            expect(mockedApi.loginWithGoogle).not.toHaveBeenCalled();
        });

        it('reports an in-progress sign-in and missing Play Services', async () => {
            mockGoogleSignin.signIn.mockRejectedValueOnce({ code: 'IN_PROGRESS' });
            const { getByTestId, getByText } = render(<LoginScreen />);
            fireEvent.press(getByTestId('google-login-button'));
            await waitFor(() => expect(getByText('Connexion déjà en cours.')).toBeTruthy());

            mockGoogleSignin.hasPlayServices.mockRejectedValueOnce({ code: 'PLAY_SERVICES_NOT_AVAILABLE' });
            fireEvent.press(getByTestId('google-login-button'));
            await waitFor(() => expect(getByText('Google Play Services indisponible sur cet appareil.')).toBeTruthy());
        });

        it('shows a generic message (never the raw error) on unexpected failures', async () => {
            mockGoogleSignin.signIn.mockRejectedValueOnce(new Error('secret-token-abc leaked in message'));

            const { getByTestId, getByText, queryByText } = render(<LoginScreen />);
            fireEvent.press(getByTestId('google-login-button'));

            await waitFor(() => expect(getByText('Erreur inattendue de connexion avec Google.')).toBeTruthy());
            expect(queryByText(/secret-token/)).toBeNull();
            expect(console.warn).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining('secret-token'));
        });

        it('fails when Google gives no access token', async () => {
            mockGoogleSignin.signIn.mockResolvedValueOnce({});
            mockGoogleSignin.getTokens.mockResolvedValueOnce({ accessToken: '' });

            const { getByTestId, getByText } = render(<LoginScreen />);
            fireEvent.press(getByTestId('google-login-button'));

            await waitFor(() => expect(getByText("Impossible de récupérer le jeton d’accès Google.")).toBeTruthy());
            expect(mockedApi.loginWithGoogle).not.toHaveBeenCalled();
        });

        it('shows the ban message when the backend refuses a banned Google account', async () => {
            mockGoogleSignin.signIn.mockResolvedValueOnce({});
            mockGoogleSignin.getTokens.mockResolvedValueOnce({ accessToken: 'google-access' });
            mockedApi.loginWithGoogle.mockRejectedValueOnce(
                new ApiError('your account is banned', 403, { error: 'your account is banned', bannedUntil: null })
            );

            const { getByTestId, getByText } = render(<LoginScreen />);
            fireEvent.press(getByTestId('google-login-button'));

            await waitFor(() => expect(getByText('Votre compte a été banni définitivement.')).toBeTruthy());
        });

        it('ignores a second tap while a sign-in is running', async () => {
            let resolveSignIn: (value: unknown) => void = () => {};
            mockGoogleSignin.signIn.mockReturnValueOnce(new Promise((resolve) => (resolveSignIn = resolve)));
            mockGoogleSignin.getTokens.mockResolvedValueOnce({ accessToken: '' });

            const { getByTestId } = render(<LoginScreen />);
            fireEvent.press(getByTestId('google-login-button'));
            fireEvent.press(getByTestId('google-login-button'));
            await act(async () => {
                resolveSignIn({});
            });

            expect(mockGoogleSignin.signIn).toHaveBeenCalledTimes(1);
        });
    });
});
