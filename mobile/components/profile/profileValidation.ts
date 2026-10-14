import { ApiError } from '@/services/http';
import { validateEmail } from '@/utils/validation';

type Translate = (key: any, values?: Record<string, string | number>) => string;

export const USERNAME_MIN = 3;
export const BIO_MAX = 500;
/** bcrypt ignores (or the backend rejects) anything past 72 bytes. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72;

export type ProfileFormValues = {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    description: string;
};

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>;

export function validateProfileForm(values: ProfileFormValues, t: Translate): ProfileFormErrors {
    const errors: ProfileFormErrors = {};
    const email = values.email.trim();

    if (!values.firstName.trim()) errors.firstName = t('profile.edit.error.firstNameRequired');
    if (!values.lastName.trim()) errors.lastName = t('profile.edit.error.lastNameRequired');
    if (values.username.trim().length < USERNAME_MIN) errors.username = t('profile.edit.error.usernameMin');
    if (!email) errors.email = t('profile.edit.error.emailRequired');
    else if (!validateEmail(email).isValid) errors.email = t('profile.edit.error.emailInvalid');
    if (values.description.trim().length > BIO_MAX) errors.description = t('profile.edit.error.bioMax', { max: BIO_MAX });

    return errors;
}

/** Maps an update-profile failure to a user-facing message (409/400 get a dedicated one). */
export function profileErrorMessage(error: unknown, t: Translate): string {
    if (error instanceof ApiError) {
        if (error.status === 409) return t('profile.edit.error.conflict');
        if (error.status === 400) return t('profile.edit.error.invalid');
        if (error.status === 401) return t('profile.edit.error.session');
    }
    return t('profile.edit.error.updateFailed');
}

export function utf8ByteLength(value: string): number {
    let bytes = 0;
    for (const char of value) {
        const code = char.codePointAt(0) ?? 0;
        if (code <= 0x7f) bytes += 1;
        else if (code <= 0x7ff) bytes += 2;
        else if (code <= 0xffff) bytes += 3;
        else bytes += 4;
    }
    return bytes;
}

export type PasswordFormValues = { current: string; next: string; confirm: string };
export type PasswordFormErrors = Partial<Record<keyof PasswordFormValues, string>>;

/** Rules of `PATCH /users/me/password`: new >= 8, different from the current one. */
export function validatePasswordForm(values: PasswordFormValues, t: Translate): PasswordFormErrors {
    const errors: PasswordFormErrors = {};

    if (!values.current) errors.current = t('settings.password.error.currentRequired');

    if (values.next.length < PASSWORD_MIN) errors.next = t('settings.password.error.min');
    else if (utf8ByteLength(values.next) > PASSWORD_MAX_BYTES) errors.next = t('settings.password.error.max');
    else if (values.next === values.current) errors.next = t('settings.password.error.same');

    if (!errors.next && values.confirm !== values.next) errors.confirm = t('settings.password.error.mismatch');

    return errors;
}

export function passwordErrorMessage(error: unknown, t: Translate): string {
    if (error instanceof ApiError) {
        if (error.status === 401) {
            return /current password/i.test(error.message)
                ? t('settings.password.error.wrongCurrent')
                : t('settings.password.error.session');
        }
        if (error.status === 400 && /different/i.test(error.message)) return t('settings.password.error.same');
        if (error.status === 400) return t('settings.password.error.min');
    }
    return t('settings.password.error.generic');
}
