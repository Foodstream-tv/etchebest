import { ApiError } from '@/services/http';

import { countFromIds, displayNameOf, followersCountOf, followingCountOf, formatActivityDate, parseRouteId, safeImageUrl } from '../profileUtils';
import { passwordErrorMessage, profileErrorMessage, utf8ByteLength, validatePasswordForm, validateProfileForm } from '../profileValidation';

const t = (key: string, values?: Record<string, string | number>) => (values ? `${key}:${JSON.stringify(values)}` : key);

describe('profileUtils', () => {
    it('reads the follow counts from either backend or client spelling, then falls back to followerCount', () => {
        expect(followersCountOf({ id: '1', followersIds: ['a', 'b'] })).toBe(2);
        expect(followersCountOf({ id: '1', followersIDS: ['a'] })).toBe(1);
        expect(followersCountOf({ id: '1', followerCount: 9 })).toBe(9);
        expect(followersCountOf(null)).toBe(0);
        expect(followingCountOf({ id: '1', followingIds: [] })).toBe(0);
        expect(followingCountOf({ id: '1', followingIDS: ['x', 'y', 'z'] })).toBe(3);
        expect(countFromIds(undefined, null)).toBeUndefined();
    });

    it('builds a display name', () => {
        expect(displayNameOf({ firstName: ' Ada ', lastName: 'Lovelace', username: 'ada' })).toBe('Ada Lovelace');
        expect(displayNameOf({ username: 'ada', email: 'a@b.c' })).toBe('ada');
        expect(displayNameOf({ email: 'a@b.c' })).toBe('a@b.c');
        expect(displayNameOf(undefined, 'Utilisateur')).toBe('Utilisateur');
    });

    it('only accepts http(s) image urls', () => {
        expect(safeImageUrl('https://cdn.test/a.png')).toBe('https://cdn.test/a.png');
        expect(safeImageUrl('  http://cdn.test/a.png ')).toBe('http://cdn.test/a.png');
        expect(safeImageUrl('javascript:alert(1)')).toBeUndefined();
        expect(safeImageUrl('file:///etc/passwd')).toBeUndefined();
        expect(safeImageUrl('data:image/png;base64,AAAA')).toBeUndefined();
        expect(safeImageUrl('//evil.test/a.png')).toBeUndefined();
        expect(safeImageUrl('https://cdn.test/a b.png')).toBeUndefined();
        expect(safeImageUrl('')).toBeUndefined();
        expect(safeImageUrl(undefined)).toBeUndefined();
        // uploaded pictures are served as relative paths by the API host
        expect(safeImageUrl('/api/uploads/avatar.png')).toMatch(/^https?:\/\/.+\/api\/uploads\/avatar\.png$/);
    });

    it('normalizes route ids', () => {
        expect(parseRouteId('abc')).toBe('abc');
        expect(parseRouteId(' abc ')).toBe('abc');
        expect(parseRouteId(['abc', 'def'])).toBe('abc');
        expect(parseRouteId('')).toBeNull();
        expect(parseRouteId('   ')).toBeNull();
        expect(parseRouteId(undefined)).toBeNull();
        expect(parseRouteId([])).toBeNull();
        expect(parseRouteId('x'.repeat(129))).toBeNull();
    });

    it('formats activity dates and tolerates garbage', () => {
        expect(formatActivityDate('2026-10-01T10:00:00Z', 'fr')).toMatch(/oct/i);
        expect(formatActivityDate('nope', 'fr')).toBe('');
        expect(formatActivityDate(undefined, 'en')).toBe('');
    });
});

describe('profileValidation', () => {
    const valid = { firstName: 'Ada', lastName: 'Lovelace', username: 'ada', email: 'ada@example.com', description: '' };

    it('accepts a valid profile form', () => {
        expect(validateProfileForm(valid, t)).toEqual({});
    });

    it('reports each invalid field', () => {
        const errors = validateProfileForm({ firstName: ' ', lastName: '', username: 'ab', email: 'a@b', description: 'x'.repeat(501) }, t);
        expect(Object.keys(errors).sort()).toEqual(['description', 'email', 'firstName', 'lastName', 'username']);
        expect(validateProfileForm({ ...valid, email: '' }, t).email).toBe('profile.edit.error.emailRequired');
        expect(validateProfileForm({ ...valid, email: 'a..b@c.com' }, t).email).toBe('profile.edit.error.emailInvalid');
    });

    it('maps profile API errors', () => {
        expect(profileErrorMessage(new ApiError('x', 409, {}), t)).toBe('profile.edit.error.conflict');
        expect(profileErrorMessage(new ApiError('x', 400, {}), t)).toBe('profile.edit.error.invalid');
        expect(profileErrorMessage(new ApiError('x', 401, {}), t)).toBe('profile.edit.error.session');
        expect(profileErrorMessage(new Error('x'), t)).toBe('profile.edit.error.updateFailed');
    });

    it('computes UTF-8 byte lengths', () => {
        expect(utf8ByteLength('abc')).toBe(3);
        expect(utf8ByteLength('é')).toBe(2);
        expect(utf8ByteLength('€')).toBe(3);
        expect(utf8ByteLength('😀')).toBe(4);
    });

    it('validates the password change like the backend', () => {
        expect(validatePasswordForm({ current: 'old', next: 'longenough', confirm: 'longenough' }, t)).toEqual({});
        expect(validatePasswordForm({ current: '', next: 'longenough', confirm: 'longenough' }, t).current).toBeDefined();
        expect(validatePasswordForm({ current: 'old', next: '1234567', confirm: '1234567' }, t).next).toBe('settings.password.error.min');
        expect(validatePasswordForm({ current: 'same-pass', next: 'same-pass', confirm: 'same-pass' }, t).next).toBe('settings.password.error.same');
        expect(validatePasswordForm({ current: 'old', next: 'longenough', confirm: 'different' }, t).confirm).toBe('settings.password.error.mismatch');
        expect(validatePasswordForm({ current: 'old', next: 'a'.repeat(72), confirm: 'a'.repeat(72) }, t)).toEqual({});
        expect(validatePasswordForm({ current: 'old', next: 'a'.repeat(73), confirm: 'a'.repeat(73) }, t).next).toBe('settings.password.error.max');
    });

    it('maps password API errors', () => {
        expect(passwordErrorMessage(new ApiError('invalid current password', 401, {}), t)).toBe('settings.password.error.wrongCurrent');
        expect(passwordErrorMessage(new ApiError('Session expirée', 401, {}), t)).toBe('settings.password.error.session');
        expect(passwordErrorMessage(new ApiError('new password must be different from current password', 400, {}), t)).toBe('settings.password.error.same');
        expect(passwordErrorMessage(new ApiError('Key: min', 400, {}), t)).toBe('settings.password.error.min');
        expect(passwordErrorMessage(new Error('x'), t)).toBe('settings.password.error.generic');
    });
});
