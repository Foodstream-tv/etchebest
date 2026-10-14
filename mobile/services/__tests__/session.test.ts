import { BANNED_ERROR, emitSessionTerminated, formatBanMessage, onSessionTerminated } from '../session';

describe('services/session', () => {
    it('notifies listeners and stops after unsubscribe', () => {
        const listener = jest.fn();
        const off = onSessionTerminated(listener);

        emitSessionTerminated({ reason: 'revoked' });
        off();
        emitSessionTerminated({ reason: 'revoked' });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith({ reason: 'revoked' });
    });

    it('keeps notifying other listeners when one throws', () => {
        const bad = onSessionTerminated(() => {
            throw new Error('boom');
        });
        const good = jest.fn();
        const off = onSessionTerminated(good);

        expect(() => emitSessionTerminated({ reason: 'banned' })).not.toThrow();
        expect(good).toHaveBeenCalled();

        bad();
        off();
    });

    it('exposes the exact error string used by the backend', () => {
        expect(BANNED_ERROR).toBe('your account is banned');
    });

    describe('formatBanMessage', () => {
        const now = Date.UTC(2030, 0, 1, 12, 0, 0);

        it('is permanent without a date or with an invalid one', () => {
            expect(formatBanMessage(null, 'fr', now)).toBe('Votre compte a été banni définitivement.');
            expect(formatBanMessage(undefined, 'en', now)).toBe('Your account has been permanently banned.');
            expect(formatBanMessage('not-a-date', 'fr', now)).toBe('Votre compte a été banni définitivement.');
        });

        it('describes the remaining time of a temporary ban', () => {
            const until = new Date(now + (2 * 24 * 60 + 3 * 60) * 60_000).toISOString(); // 2 days 3 hours
            const message = formatBanMessage(until, 'fr', now);
            expect(message).toContain('2 jours 3 heures');
            expect(message).toContain('temporairement banni');
        });

        it('shows minutes only for bans shorter than a day, with English plurals', () => {
            const until = new Date(now + 90 * 60_000).toISOString();
            expect(formatBanMessage(until, 'en', now)).toContain('1 hour 30 minutes');
        });

        it('falls back to the date when the ban already expired', () => {
            const until = new Date(now - 60_000).toISOString();
            const message = formatBanMessage(until, 'fr', now);
            expect(message).toContain('jusqu\'au');
            expect(message).not.toContain('Il reste');
        });
    });
});
