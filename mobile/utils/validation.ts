export const patterns = {
  email: /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/,
  phone: /^[+]?[\d\s-]{6,}$/,
};

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Adresse e-mail requise' };
  }
  if (!patterns.email.test(trimmed)) {
    return { isValid: false, error: 'Adresse e-mail invalide' };
  }
  return { isValid: true };
}

/**
 * Validate password
 */
export function validatePassword(password: string, minLength = 8): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Mot de passe requis' };
  }
  if (password.length < minLength) {
    return { isValid: false, error: `Le mot de passe doit contenir au moins ${minLength} caractères` };
  }
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  if (!hasLowercase || !hasUppercase || !hasDigit || !hasSpecialChar) {
    return {
      isValid: false,
      error:
        'Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule, un chiffre et un caractère spécial',
    };
  }
  return { isValid: true };
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
    return { isValid: false, error: `${fieldName} requis` };
  }
  if (trimmed.length < minLength) {
    return { isValid: false, error: `${fieldName} doit contenir au moins ${minLength} caractères` };
  }
  return { isValid: true };
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
    return { isValid: false, error: `${fieldName} requis` };
  }
  if (trimmed.length < minLength) {
    return { isValid: false, error: `${fieldName} doit contenir au moins ${minLength} caractères` };
  }
  if (trimmed.length > maxLength) {
    return { isValid: false, error: `${fieldName} ne peut pas dépasser ${maxLength} caractères` };
  }
  return { isValid: true };
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string): ValidationResult {
  const trimmed = phone.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Numéro de téléphone requis' };
  }
  if (!patterns.phone.test(trimmed)) {
    return { isValid: false, error: 'Numéro de téléphone invalide' };
  }
  return { isValid: true };
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
  return { isValid: true };
}
