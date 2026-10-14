/**
 * Form validation shared by the auth / profile screens.
 *
 * Rules mirror the web signup page (front-web/src/app/(auth)/signup/page.tsx) and
 * the backend bindings (backend/internal/auth/auth.go): the client must never be
 * stricter than the server (it would block valid users) nor looser (it would send
 * requests that are guaranteed to fail).
 *
 * Every result carries a machine readable `code` so screens can show localized
 * wording (`t()`); `error` is a French fallback kept for simple callers.
 */

export const patterns = {
  /** Web signup regex (+ consecutive dots are rejected below, the server refuses them too). */
  email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  /** Web signin regex: only used to catch obvious typos when logging in. */
  looseEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

export const LIMITS = {
  firstNameMin: 2,
  lastNameMin: 2,
  usernameMin: 3,
  passwordMin: 8,
  descriptionMin: 10,
  descriptionMax: 500,
  phoneDigitsMin: 6,
  phoneDigitsMax: 15,
} as const;

export type ValidationCode = 'required' | 'invalid' | 'tooShort' | 'tooLong';

export interface ValidationResult {
  isValid: boolean;
  /** French fallback message */
  error?: string;
  code?: ValidationCode;
}

const OK: ValidationResult = { isValid: true };

/**
 * Validate email format (signup / profile).
 */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, code: 'required', error: 'Adresse e-mail requise' };
  }
  if (trimmed.includes('..') || !patterns.email.test(trimmed)) {
    return { isValid: false, code: 'invalid', error: 'Adresse e-mail invalide' };
  }
  return OK;
}

/**
 * Lenient email check for sign-in: accounts created elsewhere (web, older rules)
 * must still be able to log in, so only obvious typos are rejected.
 */
export function validateLoginEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, code: 'required', error: 'Adresse e-mail requise' };
  }
  if (!patterns.looseEmail.test(trimmed)) {
    return { isValid: false, code: 'invalid', error: 'Adresse e-mail invalide' };
  }
  return OK;
}

/**
 * Sign-in only requires a non-empty password (web parity). Complexity rules are
 * a registration concern: an existing account must be able to log in whatever
 * rules were enforced when it was created.
 */
export function validateLoginPassword(password: string): ValidationResult {
  if (!password || !password.trim()) {
    return { isValid: false, code: 'required', error: 'Mot de passe requis' };
  }
  return OK;
}

/**
 * Registration password: same rule as the web signup and the backend
 * (`binding:"required,min=8"`), the password itself is never trimmed.
 */
export function validateNewPassword(password: string, minLength: number = LIMITS.passwordMin): ValidationResult {
  if (!password) {
    return { isValid: false, code: 'required', error: 'Mot de passe requis' };
  }
  if (password.length < minLength) {
    return {
      isValid: false,
      code: 'tooShort',
      error: `Le mot de passe doit contenir au moins ${minLength} caractères`,
    };
  }
  return OK;
}

/**
 * Strict password policy (length + lower + upper + digit + special character).
 * NOT enforced by the backend nor the web: available for screens that want a
 * stronger policy, never use it on sign-in.
 */
export function validatePassword(password: string, minLength = 8): ValidationResult {
  if (!password) {
    return { isValid: false, code: 'required', error: 'Mot de passe requis' };
  }
  if (password.length < minLength) {
    return {
      isValid: false,
      code: 'tooShort',
      error: `Le mot de passe doit contenir au moins ${minLength} caractères`,
    };
  }
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  if (!hasLowercase || !hasUppercase || !hasDigit || !hasSpecialChar) {
    return {
      isValid: false,
      code: 'invalid',
      error:
        'Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule, un chiffre et un caractère spécial',
    };
  }
  return OK;
}

/**
 * Validate minimum length for text fields
 */
export function validateMinLength(
  value: string,
  minLength: number,
  fieldName: string
): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: false, code: 'required', error: `${fieldName} requis` };
  }
  if (trimmed.length < minLength) {
    return {
      isValid: false,
      code: 'tooShort',
      error: `${fieldName} doit contenir au moins ${minLength} caractères`,
    };
  }
  return OK;
}

/**
 * Validate length range for text fields
 */
export function validateLengthRange(
  value: string,
  minLength: number,
  maxLength: number,
  fieldName: string
): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: false, code: 'required', error: `${fieldName} requis` };
  }
  if (trimmed.length < minLength) {
    return {
      isValid: false,
      code: 'tooShort',
      error: `${fieldName} doit contenir au moins ${minLength} caractères`,
    };
  }
  if (trimmed.length > maxLength) {
    return {
      isValid: false,
      code: 'tooLong',
      error: `${fieldName} ne peut pas dépasser ${maxLength} caractères`,
    };
  }
  return OK;
}

/**
 * Validate phone number: 6 to 15 digits (web parity), spaces, dots, dashes,
 * parentheses and a leading "+" are tolerated, letters are not.
 */
export function validatePhone(phone: string): ValidationResult {
  const trimmed = phone.trim();
  if (!trimmed) {
    return { isValid: false, code: 'required', error: 'Numéro de téléphone requis' };
  }
  const digits = trimmed.replace(/\D/g, '');
  const onlyPhoneChars = /^\+?[\d\s().-]+$/.test(trimmed);
  if (!onlyPhoneChars || digits.length < LIMITS.phoneDigitsMin || digits.length > LIMITS.phoneDigitsMax) {
    return { isValid: false, code: 'invalid', error: 'Numéro de téléphone invalide' };
  }
  return OK;
}

/**
 * Run multiple validations and return first error
 */
export function validateAll(validations: ValidationResult[]): ValidationResult {
  for (const result of validations) {
    if (!result.isValid) {
      return result;
    }
  }
  return OK;
}

export type RegisterFieldName =
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'username'
  | 'password'
  | 'phone'
  | 'description';

export type RegisterValues = Record<RegisterFieldName, string>;

export type RegisterFieldErrors = Partial<Record<RegisterFieldName, ValidationCode>>;

/** Validates the whole signup form; returns an error code per invalid field (empty object when valid). */
export function validateRegisterForm(values: RegisterValues): RegisterFieldErrors {
  const checks: Record<RegisterFieldName, ValidationResult> = {
    email: validateEmail(values.email),
    firstName: validateMinLength(values.firstName, LIMITS.firstNameMin, 'firstName'),
    lastName: validateMinLength(values.lastName, LIMITS.lastNameMin, 'lastName'),
    username: validateMinLength(values.username, LIMITS.usernameMin, 'username'),
    password: validateNewPassword(values.password),
    phone: validatePhone(values.phone),
    description: validateLengthRange(values.description, LIMITS.descriptionMin, LIMITS.descriptionMax, 'description'),
  };

  const errors: RegisterFieldErrors = {};
  (Object.keys(checks) as RegisterFieldName[]).forEach((field) => {
    const result = checks[field];
    if (!result.isValid && result.code) {
      errors[field] = result.code;
    }
  });
  return errors;
}
