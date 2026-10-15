import {
    LIMITS,
    validateAll,
    validateEmail,
    validateLengthRange,
    validateLoginEmail,
    validateLoginPassword,
    validateMinLength,
    validateNewPassword,
    validatePassword,
    validateOptionalMaxLength,
    validatePhone,
    validateRegisterForm,
} from '../validation';

describe('validateEmail (signup)', () => {
    it.each(['john@example.com', 'john.doe+tag@sub.example.co', '  padded@example.com  ', '_under@example.com', 'a@b.io'])(
        'accepts %p',
        (value) => {
            expect(validateEmail(value).isValid).toBe(true);
        }
    );

    it.each(['plainaddress', '@example.com', 'john@', 'john@example', 'john@example.c', 'john doe@example.com', 'a..b@example.com', 'a@b..com'])(
        'rejects %p as invalid',
        (value) => {
            const result = validateEmail(value);
            expect(result.isValid).toBe(false);
            expect(result.code).toBe('invalid');
            expect(result.error).toBe('Adresse e-mail invalide');
        }
    );

    it('flags empty / blank values as required', () => {
        expect(validateEmail('')).toMatchObject({ isValid: false, code: 'required' });
        expect(validateEmail('   ')).toMatchObject({ isValid: false, code: 'required' });
    });
});

describe('validateLoginEmail (sign-in)', () => {
    it('is lenient so existing accounts are never locked out', () => {
        expect(validateLoginEmail('a..b@example.com').isValid).toBe(true);
        expect(validateLoginEmail('x@y.z').isValid).toBe(true);
    });

    it('still catches obvious typos', () => {
        expect(validateLoginEmail('nope')).toMatchObject({ isValid: false, code: 'invalid' });
        expect(validateLoginEmail('a b@c.com').isValid).toBe(false);
        expect(validateLoginEmail('')).toMatchObject({ isValid: false, code: 'required' });
    });
});

describe('validateLoginPassword', () => {
    it('only requires a non-empty password (no complexity, no minimum length)', () => {
        expect(validateLoginPassword('a').isValid).toBe(true);
        expect(validateLoginPassword('password').isValid).toBe(true);
        expect(validateLoginPassword('Abcdef1!').isValid).toBe(true);
    });

    it('rejects empty and whitespace-only values', () => {
        expect(validateLoginPassword('')).toMatchObject({ isValid: false, code: 'required' });
        expect(validateLoginPassword('    ')).toMatchObject({ isValid: false, code: 'required' });
    });
});

describe('validateNewPassword (signup, same rule as web + backend)', () => {
    it('accepts any password of at least 8 characters', () => {
        expect(validateNewPassword('password').isValid).toBe(true);
        expect(validateNewPassword('12345678').isValid).toBe(true);
    });

    it('does not trim the password (spaces count)', () => {
        expect(validateNewPassword('       a').isValid).toBe(true);
    });

    it('rejects short and empty passwords', () => {
        expect(validateNewPassword('1234567')).toMatchObject({ isValid: false, code: 'tooShort' });
        expect(validateNewPassword('')).toMatchObject({ isValid: false, code: 'required' });
    });

    it('supports a custom minimum length', () => {
        expect(validateNewPassword('abcd', 4).isValid).toBe(true);
        expect(validateNewPassword('abc', 4).isValid).toBe(false);
    });
});

describe('validatePassword (strict policy, kept for optional use)', () => {
    it('requires lower, upper, digit and special character', () => {
        expect(validatePassword('Password1!').isValid).toBe(true);
        expect(validatePassword('password1!')).toMatchObject({ isValid: false, code: 'invalid' });
        expect(validatePassword('PASSWORD1!').isValid).toBe(false);
        expect(validatePassword('Password!!').isValid).toBe(false);
        expect(validatePassword('Password11').isValid).toBe(false);
    });

    it('checks the length first', () => {
        expect(validatePassword('Aa1!')).toMatchObject({ isValid: false, code: 'tooShort' });
        expect(validatePassword('')).toMatchObject({ isValid: false, code: 'required' });
    });
});

describe('validateMinLength / validateLengthRange', () => {
    it('trims before measuring', () => {
        expect(validateMinLength('  ab  ', 3, 'Nom').isValid).toBe(false);
        expect(validateMinLength('  abc  ', 3, 'Nom').isValid).toBe(true);
    });

    it('reports required vs too short with the field name', () => {
        expect(validateMinLength('   ', 2, 'Nom')).toMatchObject({ code: 'required', error: 'Nom requis' });
        expect(validateMinLength('a', 2, 'Nom')).toMatchObject({
            code: 'tooShort',
            error: 'Nom doit contenir au moins 2 caractères',
        });
    });

    it('enforces both bounds on ranges (inclusive)', () => {
        expect(validateLengthRange('x'.repeat(10), 10, 500, 'Bio').isValid).toBe(true);
        expect(validateLengthRange('x'.repeat(500), 10, 500, 'Bio').isValid).toBe(true);
        expect(validateLengthRange('x'.repeat(9), 10, 500, 'Bio')).toMatchObject({ code: 'tooShort' });
        expect(validateLengthRange('x'.repeat(501), 10, 500, 'Bio')).toMatchObject({ code: 'tooLong' });
        expect(validateLengthRange('', 10, 500, 'Bio')).toMatchObject({ code: 'required' });
    });
});

describe('validateOptionalMaxLength', () => {
    it('accepts empty values and anything up to the max', () => {
        expect(validateOptionalMaxLength('', 500, 'Bio').isValid).toBe(true);
        expect(validateOptionalMaxLength('x', 500, 'Bio').isValid).toBe(true);
        expect(validateOptionalMaxLength('x'.repeat(500), 500, 'Bio').isValid).toBe(true);
    });

    it('rejects values past the max', () => {
        expect(validateOptionalMaxLength('x'.repeat(501), 500, 'Bio')).toMatchObject({ code: 'tooLong' });
    });
});

describe('validatePhone', () => {
    it.each(['0612345678', '+33 6 12 34 56 78', '06-12-34-56-78', '(555) 123-4567', '123456', '1'.repeat(15)])('accepts %p', (value) => {
        expect(validatePhone(value).isValid).toBe(true);
    });

    it.each(['12345', '1'.repeat(16), '------', '      ', 'abcdefgh', '0612345678a', '06 12 ab 34 56'])('rejects %p', (value) => {
        expect(validatePhone(value).isValid).toBe(false);
    });

    it('distinguishes required from invalid', () => {
        expect(validatePhone('')).toMatchObject({ code: 'required' });
        expect(validatePhone('12')).toMatchObject({ code: 'invalid' });
    });
});

describe('validateAll', () => {
    it('returns the first failure', () => {
        const first = { isValid: false, error: 'first' };
        const second = { isValid: false, error: 'second' };
        expect(validateAll([{ isValid: true }, first, second])).toBe(first);
    });

    it('is valid when everything is', () => {
        expect(validateAll([{ isValid: true }, { isValid: true }])).toEqual({ isValid: true });
        expect(validateAll([])).toEqual({ isValid: true });
    });
});

describe('validateRegisterForm', () => {
    const valid = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johnny',
        password: 'password',
        phone: '0612345678',
        description: 'A long enough description.',
    };

    it('returns no error for a valid form', () => {
        expect(validateRegisterForm(valid)).toEqual({});
    });

    it('matches the web minimums (first/last name 2, username 3, bio max 500)', () => {
        expect(validateRegisterForm({ ...valid, firstName: 'J', lastName: 'D', username: 'ab' })).toEqual({
            firstName: 'tooShort',
            lastName: 'tooShort',
            username: 'tooShort',
        });
        expect(validateRegisterForm({ ...valid, description: 'x' })).toEqual({});
        expect(validateRegisterForm({ ...valid, description: 'x'.repeat(LIMITS.descriptionMax + 1) })).toEqual({
            description: 'tooLong',
        });
    });

    it('collects every invalid field at once', () => {
        expect(
            validateRegisterForm({
                email: '',
                firstName: '',
                lastName: '',
                username: '',
                password: '',
                phone: '',
                description: '',
            })
        ).toEqual({
            email: 'required',
            firstName: 'required',
            lastName: 'required',
            username: 'required',
            password: 'required',
        });
    });

    it('accepts an empty or blank phone and bio (optional fields)', () => {
        expect(validateRegisterForm({ ...valid, phone: '', description: '' })).toEqual({});
        expect(validateRegisterForm({ ...valid, phone: '  ', description: '   ' })).toEqual({});
    });

    it('validates the phone format only when typed', () => {
        expect(validateRegisterForm({ ...valid, phone: '12' })).toEqual({ phone: 'invalid' });
        expect(validateRegisterForm({ ...valid, phone: 'abcdefg' })).toEqual({ phone: 'invalid' });
    });

    it('accepts a bio of exactly 500 characters', () => {
        expect(validateRegisterForm({ ...valid, description: 'x'.repeat(LIMITS.descriptionMax) })).toEqual({});
    });

    it('does not require password complexity (server does not)', () => {
        expect(validateRegisterForm({ ...valid, password: 'alllowercase' })).toEqual({});
    });
});
