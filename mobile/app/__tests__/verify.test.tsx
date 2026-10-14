import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import apiService from '@/services/api';
import { authService } from '@/services/auth';
import { ApiError } from '@/services/http';
import VerifyScreen from '../verify';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    useLocalSearchParams: jest.fn(),
}));

jest.mock('@/services/api', () => ({
    __esModule: true,
    default: {
        verifyAccount: jest.fn(),
        resendVerificationCode: jest.fn(),
        getProfile: jest.fn(),
    },
}));

jest.mock('@/services/auth', () => ({
    __esModule: true,
    authService: { saveAuth: jest.fn(() => Promise.resolve()) },
}));

const mockedApi = apiService as unknown as Record<'verifyAccount' | 'resendVerificationCode' | 'getProfile', jest.Mock>;
const mockedSaveAuth = authService.saveAuth as jest.Mock;
const mockedParams = useLocalSearchParams as unknown as jest.Mock;

const PROFILE = {
    id: 'u1',
    email: 'john@mail.com',
    username: 'johnny',
    firstName: 'John',
    lastName: 'Doe',
    description: 'desc',
    profileImageUrl: '',
    role: 'USER',
};

const flush = async () => {
    await act(async () => {
        await Promise.resolve();
    });
};

const advance = async (ms: number) => {
    await act(async () => {
        jest.advanceTimersByTime(ms);
    });
};

describe('VerifyScreen', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockedParams.mockReturnValue({ userId: 'u1', email: 'john@mail.com' });
        mockedSaveAuth.mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders the web wording and the masked e-mail', () => {
        const { getByText, getAllByText, getByTestId } = render(<VerifyScreen />);

        expect(getByText('Vérification')).toBeTruthy();
        expect(getByText('Confirmez votre compte')).toBeTruthy();
        expect(getByText('Entrez le code à 6 chiffres envoyé à j***n@mail.com.')).toBeTruthy();
        expect(getAllByText('j***n@mail.com').length).toBeGreaterThan(0);
        expect(getByText('Valider mon compte')).toBeTruthy();
        expect(getByText('Retour à la connexion')).toBeTruthy();
        expect(getByTestId('verify-code-input')).toBeTruthy();
    });

    it('masks short names and keeps an already masked target', () => {
        mockedParams.mockReturnValue({ userId: 'u1', email: 'ab@mail.com' });
        const first = render(<VerifyScreen />);
        expect(first.getAllByText('a***@mail.com').length).toBeGreaterThan(0);
        first.unmount();

        mockedParams.mockReturnValue({ userId: 'u1', email: 'j***n@mail.com' });
        const second = render(<VerifyScreen />);
        expect(second.getAllByText('j***n@mail.com').length).toBeGreaterThan(0);
    });

    it('configures the code input for one-time codes', () => {
        const { getByTestId } = render(<VerifyScreen />);
        const input = getByTestId('verify-code-input');

        expect(input.props.textContentType).toBe('oneTimeCode');
        expect(input.props.autoComplete).toBe('one-time-code');
        expect(input.props.keyboardType).toBe('number-pad');
        expect(input.props.maxLength).toBe(6);
        expect(input.props.accessibilityLabel).toBe('Code de vérification');
    });

    it('keeps digits only, at most 6', () => {
        const { getByTestId } = render(<VerifyScreen />);
        fireEvent.changeText(getByTestId('verify-code-input'), 'a1-b2 3');
        expect(getByTestId('verify-code-input').props.value).toBe('123');

        mockedApi.verifyAccount.mockReturnValue(new Promise(() => {}));
        fireEvent.changeText(getByTestId('verify-code-input'), '12345678');
        expect(getByTestId('verify-code-input').props.value).toBe('123456');
    });

    it('does not submit before the 6th digit and keeps the button disabled', () => {
        const { getByTestId } = render(<VerifyScreen />);

        fireEvent.changeText(getByTestId('verify-code-input'), '12345');
        expect(mockedApi.verifyAccount).not.toHaveBeenCalled();
        expect(getByTestId('verify-submit').props.accessibilityState.disabled).toBe(true);
    });

    it('auto-submits as soon as 6 digits are typed', async () => {
        mockedApi.verifyAccount.mockResolvedValueOnce({ message: 'ok', token: 'tok', user: { id: 'u1' } });
        mockedApi.getProfile.mockResolvedValueOnce(PROFILE);

        const { getByTestId } = render(<VerifyScreen />);
        fireEvent.changeText(getByTestId('verify-code-input'), '123456');

        expect(mockedApi.verifyAccount).toHaveBeenCalledTimes(1);
        expect(mockedApi.verifyAccount).toHaveBeenCalledWith({ userId: 'u1', email: 'john@mail.com', code: '123456' });
        await flush();
    });

    it('success: profile loaded with the token, session saved, success view, then goes home', async () => {
        mockedApi.verifyAccount.mockResolvedValueOnce({ message: 'ok', token: 'tok', user: { id: 'u1' } });
        mockedApi.getProfile.mockResolvedValueOnce(PROFILE);

        const { getByTestId, getByText } = render(<VerifyScreen />);
        fireEvent.changeText(getByTestId('verify-code-input'), '123456');
        await flush();
        await flush();

        expect(mockedApi.getProfile).toHaveBeenCalledWith('tok');
        expect(mockedSaveAuth).toHaveBeenCalledWith('tok', expect.objectContaining({ id: 'u1', username: 'johnny' }));
        expect(getByText('Compte vérifié avec succès !')).toBeTruthy();
        expect(getByText('Votre compte est désormais activé. Redirection en cours…')).toBeTruthy();
        expect(mockRouter.replace).not.toHaveBeenCalled();

        await advance(1200);
        expect(mockRouter.replace).toHaveBeenCalledWith('/');
    });

    it('goes to the login screen when the server confirms without a token', async () => {
        mockedApi.verifyAccount.mockResolvedValueOnce({ message: 'ok' });

        const { getByTestId } = render(<VerifyScreen />);
        fireEvent.changeText(getByTestId('verify-code-input'), '123456');
        await flush();
        await advance(1200);

        expect(mockedSaveAuth).not.toHaveBeenCalled();
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });

    it('does not redirect after unmount (timer cleared)', async () => {
        mockedApi.verifyAccount.mockResolvedValueOnce({ message: 'ok', token: 'tok' });
        mockedApi.getProfile.mockResolvedValueOnce(PROFILE);

        const { getByTestId, unmount } = render(<VerifyScreen />);
        fireEvent.changeText(getByTestId('verify-code-input'), '123456');
        await flush();
        await flush();
        unmount();
        await advance(5000);

        expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('shows the invalid / expired code message and stores nothing', async () => {
        mockedApi.verifyAccount.mockRejectedValueOnce(
            new ApiError('invalid verification code', 400, { error: 'invalid verification code' })
        );

        const { getByTestId, getByText } = render(<VerifyScreen />);
        fireEvent.changeText(getByTestId('verify-code-input'), '000000');
        await flush();

        const alert = getByText('Code de vérification incorrect ou expiré.');
        expect(alert.props.accessibilityRole).toBe('alert');
        expect(mockedSaveAuth).not.toHaveBeenCalled();
        expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('maps too many attempts (429), unknown user (404) and generic failures', async () => {
        const { getByTestId, getByText } = render(<VerifyScreen />);

        mockedApi.verifyAccount.mockRejectedValueOnce(new ApiError('x', 429, { error: 'too many invalid attempts, please request a new code' }));
        fireEvent.changeText(getByTestId('verify-code-input'), '111111');
        await flush();
        expect(getByText('Trop de tentatives invalides. Demandez un nouveau code.')).toBeTruthy();

        mockedApi.verifyAccount.mockRejectedValueOnce(new ApiError('x', 404, { error: 'user not found' }));
        fireEvent.changeText(getByTestId('verify-code-input'), '11111');
        fireEvent.changeText(getByTestId('verify-code-input'), '111112');
        await flush();
        expect(getByText('Compte introuvable. Reprenez l’inscription ou connectez-vous.')).toBeTruthy();

        mockedApi.verifyAccount.mockRejectedValueOnce(new Error('network'));
        fireEvent.changeText(getByTestId('verify-code-input'), '11111');
        fireEvent.changeText(getByTestId('verify-code-input'), '111113');
        await flush();
        expect(getByText('Une erreur est survenue lors de la vérification.')).toBeTruthy();
    });

    it('clears the error when the user types again', async () => {
        mockedApi.verifyAccount.mockRejectedValueOnce(new ApiError('x', 400, { error: 'invalid verification code' }));
        const { getByTestId, queryByText } = render(<VerifyScreen />);
        fireEvent.changeText(getByTestId('verify-code-input'), '000000');
        await flush();
        expect(queryByText('Code de vérification incorrect ou expiré.')).toBeTruthy();

        fireEvent.changeText(getByTestId('verify-code-input'), '00000');
        expect(queryByText('Code de vérification incorrect ou expiré.')).toBeNull();
    });

    it('does not keep a half-session when the profile cannot be loaded and lets the user retry', async () => {
        mockedApi.verifyAccount.mockResolvedValueOnce({ message: 'ok', token: 'tok' });
        mockedApi.getProfile.mockRejectedValueOnce(new Error('offline'));

        const { getByTestId, getByText } = render(<VerifyScreen />);
        fireEvent.changeText(getByTestId('verify-code-input'), '123456');
        await flush();
        await flush();

        expect(getByText('Impossible de récupérer votre profil.')).toBeTruthy();
        expect(mockedSaveAuth).not.toHaveBeenCalled();
        expect(mockRouter.replace).not.toHaveBeenCalled();

        // second attempt works (the backend answers "already verified" with a fresh token)
        mockedApi.verifyAccount.mockResolvedValueOnce({ message: 'ok', token: 'tok2' });
        mockedApi.getProfile.mockResolvedValueOnce(PROFILE);
        fireEvent.press(getByTestId('verify-submit'));
        await flush();
        await flush();
        expect(mockedSaveAuth).toHaveBeenCalledWith('tok2', expect.objectContaining({ id: 'u1' }));
    });

    it('only submits once while a request is pending', async () => {
        mockedApi.verifyAccount.mockReturnValue(new Promise(() => {}));
        const { getByTestId } = render(<VerifyScreen />);

        fireEvent.changeText(getByTestId('verify-code-input'), '123456');
        fireEvent.press(getByTestId('verify-submit'));
        fireEvent.press(getByTestId('verify-submit'));

        expect(mockedApi.verifyAccount).toHaveBeenCalledTimes(1);
    });

    describe('resend', () => {
        it('is disabled during the 60 second countdown, then enabled', async () => {
            const { getByTestId, getByText, queryByText } = render(<VerifyScreen />);

            expect(getByText('Renvoyer dans 60s')).toBeTruthy();
            expect(getByTestId('verify-resend').props.accessibilityState.disabled).toBe(true);

            await advance(1000);
            expect(getByText('Renvoyer dans 59s')).toBeTruthy();

            await advance(58000);
            expect(getByText('Renvoyer dans 1s')).toBeTruthy();
            expect(getByTestId('verify-resend').props.accessibilityState.disabled).toBe(true);

            await advance(1000);
            expect(getByText('Renvoyer un code')).toBeTruthy();
            expect(queryByText(/Renvoyer dans/)).toBeNull();
            expect(getByTestId('verify-resend').props.accessibilityState.disabled).toBe(false);
        });

        it('does not call the API while the countdown is running', () => {
            const { getByTestId } = render(<VerifyScreen />);
            fireEvent.press(getByTestId('verify-resend'));
            expect(mockedApi.resendVerificationCode).not.toHaveBeenCalled();
        });

        it('resends a code, shows a notice and restarts the countdown', async () => {
            mockedApi.resendVerificationCode.mockResolvedValueOnce({ message: 'ok', userId: 'u1', target: 'j***n@mail.com' });
            const { getByTestId, getByText } = render(<VerifyScreen />);

            await advance(60000);
            fireEvent.press(getByTestId('verify-resend'));
            await flush();

            expect(mockedApi.resendVerificationCode).toHaveBeenCalledWith({ userId: 'u1', email: 'john@mail.com' });
            expect(getByText('Un nouveau code a été envoyé !')).toBeTruthy();
            expect(getByText('Renvoyer dans 60s')).toBeTruthy();
            expect(getByTestId('verify-resend').props.accessibilityState.disabled).toBe(true);
        });

        it('syncs the countdown with a 429 answer', async () => {
            mockedApi.resendVerificationCode.mockRejectedValueOnce(
                new ApiError('wait', 429, { error: 'please wait 12 seconds', retryAfterSec: 12 })
            );
            const { getByTestId, getByText } = render(<VerifyScreen />);

            await advance(60000);
            fireEvent.press(getByTestId('verify-resend'));
            await flush();

            expect(getByText('Veuillez patienter 12s avant de demander un nouveau code.')).toBeTruthy();
            expect(getByText('Renvoyer dans 12s')).toBeTruthy();
        });

        it('tells the user when the account is already verified', async () => {
            mockedApi.resendVerificationCode.mockRejectedValueOnce(
                new ApiError('x', 400, { error: 'account is already verified' })
            );
            const { getByTestId, getByText } = render(<VerifyScreen />);

            await advance(60000);
            fireEvent.press(getByTestId('verify-resend'));
            await flush();

            expect(getByText('Ce compte est déjà vérifié. Vous pouvez vous connecter.')).toBeTruthy();
        });

        it('clears its interval on unmount', async () => {
            const { unmount } = render(<VerifyScreen />);
            expect(jest.getTimerCount()).toBeGreaterThan(0);

            unmount();
            expect(jest.getTimerCount()).toBe(0);
        });

        it('stops ticking once it reaches zero', async () => {
            const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
            const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
            const { getByText } = render(<VerifyScreen />);
            await advance(60000);
            await advance(1000);

            expect(getByText('Renvoyer un code')).toBeTruthy();
            expect(setIntervalSpy).toHaveBeenCalledTimes(1);
            expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
            setIntervalSpy.mockRestore();
            clearIntervalSpy.mockRestore();
        });
    });

    describe('dev code', () => {
        it('is hidden when the server did not return one', () => {
            const { queryByTestId, getByTestId } = render(<VerifyScreen />);
            expect(queryByTestId('verify-dev-code')).toBeNull();
            expect(getByTestId('verify-code-input').props.value).toBe('');
        });

        it('shows the helper and prefills (without submitting) when passed by /register', () => {
            mockedParams.mockReturnValue({ userId: 'u1', email: 'john@mail.com', devCode: '654321' });
            const { getByText, getByTestId } = render(<VerifyScreen />);

            expect(getByText('Code de test (mode dev) : 654321')).toBeTruthy();
            expect(getByTestId('verify-code-input').props.value).toBe('654321');
            expect(mockedApi.verifyAccount).not.toHaveBeenCalled();
        });

        it('the helper button fills and validates', async () => {
            mockedParams.mockReturnValue({ userId: 'u1', email: 'john@mail.com', devCode: '654321' });
            mockedApi.verifyAccount.mockReturnValue(new Promise(() => {}));
            const { getByLabelText } = render(<VerifyScreen />);

            fireEvent.press(getByLabelText('Remplir et valider'));
            expect(mockedApi.verifyAccount).toHaveBeenCalledWith({ userId: 'u1', email: 'john@mail.com', code: '654321' });
        });

        it('appears when a resend returns a devCode', async () => {
            mockedApi.resendVerificationCode.mockResolvedValueOnce({ message: 'ok', devCode: '111222' });
            const { getByTestId, getByText } = render(<VerifyScreen />);

            await advance(60000);
            fireEvent.press(getByTestId('verify-resend'));
            await flush();

            expect(getByText('Code de test (mode dev) : 111222')).toBeTruthy();
            expect(getByTestId('verify-code-input').props.value).toBe('111222');
        });

        it('ignores a non numeric devCode param', () => {
            mockedParams.mockReturnValue({ userId: 'u1', email: 'john@mail.com', devCode: '<script>' });
            const { queryByTestId } = render(<VerifyScreen />);
            expect(queryByTestId('verify-dev-code')).toBeNull();
        });
    });

    it('goes back to the login screen', () => {
        const { getByTestId } = render(<VerifyScreen />);
        fireEvent.press(getByTestId('verify-back'));
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });

    it('works with the e-mail only (no userId)', async () => {
        mockedParams.mockReturnValue({ email: 'john@mail.com' });
        mockedApi.verifyAccount.mockReturnValue(new Promise(() => {}));
        const { getByTestId } = render(<VerifyScreen />);

        fireEvent.changeText(getByTestId('verify-code-input'), '123456');
        expect(mockedApi.verifyAccount).toHaveBeenCalledWith({ userId: undefined, email: 'john@mail.com', code: '123456' });
    });

    it('accepts array params (repeated query keys)', () => {
        mockedParams.mockReturnValue({ userId: ['u1', 'u2'], email: ['john@mail.com'] });
        mockedApi.verifyAccount.mockReturnValue(new Promise(() => {}));
        const { getByTestId } = render(<VerifyScreen />);

        fireEvent.changeText(getByTestId('verify-code-input'), '123456');
        expect(mockedApi.verifyAccount).toHaveBeenCalledWith({ userId: 'u1', email: 'john@mail.com', code: '123456' });
    });

    it('explains the problem and never calls the API when no account is given', () => {
        mockedParams.mockReturnValue({});
        const { getByText, getByTestId } = render(<VerifyScreen />);

        expect(getByText('Compte introuvable. Reprenez l’inscription ou connectez-vous.')).toBeTruthy();
        fireEvent.changeText(getByTestId('verify-code-input'), '123456');
        expect(mockedApi.verifyAccount).not.toHaveBeenCalled();
        expect(getByTestId('verify-resend').props.accessibilityState.disabled).toBe(true);
    });
});
