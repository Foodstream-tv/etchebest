export const patterns = {
  email: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
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
 * Validate phone number
 */
export function validatePhone(phone: string): ValidationResult {
  const trimmed = phone.trim().replace(/\s/g, '');
  if (!trimmed) {
    return { isValid: false, error: 'Numéro de téléphone requis' };
  }
  if (trimmed.length < 6) {
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
