import * as SecureStore from 'expo-secure-store';

import storage from '../storage';

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

const secure = SecureStore as unknown as { getItemAsync: jest.Mock; setItemAsync: jest.Mock; deleteItemAsync: jest.Mock };

describe('services/storage (native)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('reads, writes and removes through SecureStore', async () => {
        secure.getItemAsync.mockResolvedValue('v');
        await expect(storage.getItem('k')).resolves.toBe('v');
        await storage.setItem('k', 'v2');
        await storage.removeItem('k');

        expect(secure.setItemAsync).toHaveBeenCalledWith('k', 'v2');
        expect(secure.deleteItemAsync).toHaveBeenCalledWith('k');
    });

    it('never throws when the keychain is unavailable', async () => {
        secure.getItemAsync.mockRejectedValue(new Error('locked'));
        secure.setItemAsync.mockRejectedValue(new Error('locked'));
        secure.deleteItemAsync.mockRejectedValue(new Error('locked'));

        await expect(storage.getItem('k')).resolves.toBeNull();
        await expect(storage.setItem('k', 'v')).resolves.toBeUndefined();
        await expect(storage.removeItem('k')).resolves.toBeUndefined();
    });
});
