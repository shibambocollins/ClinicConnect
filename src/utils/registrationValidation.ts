// src/utils/registrationValidation.ts
import {
  validateEmail,
  validateSAIdNumber,
  validateStrictSALocalNumber,
} from './validators';

export interface RegistrationPersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  contactNumber: string;
  idNumber: string;
  gender: string;
  ethnicity: string;
  sms: boolean;
  notifyEmail: boolean;
  inApp: boolean;
}

export interface RegistrationAddressInfo {
  streetNumber: string;
  streetName: string;
  city: string;
  postalCode: string;
  province: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinContactNumber: string;
}

export const PASSWORD_RULES =
  'At least 8 characters, with a number and a special character.';

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/\d/.test(password)) return 'Password must contain a number';
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\/;']/.test(password)) {
    return 'Password must contain a special character';
  }
  return null;
}

/** Step 1. Returns a map of field -> error message (empty when valid). */
export function validatePersonalInfo(form: RegistrationPersonalInfo): Record<string, string> {
  const errors: Record<string, string> = {};

  const first = form.firstName.trim();
  const last = form.lastName.trim();
  if (!first) errors.firstName = 'First name is required';
  else if (!/^[A-Za-z][A-Za-z'\- ]{0,49}$/.test(first)) {
    errors.firstName = 'Use letters, spaces, hyphens or apostrophes only';
  }

  if (!last) errors.lastName = 'Last name is required';
  else if (!/^[A-Za-z][A-Za-z'\- ]{0,49}$/.test(last)) {
    errors.lastName = 'Use letters, spaces, hyphens or apostrophes only';
  }

  const emailError = validateEmail(form.email);
  if (emailError) errors.email = emailError;

  const passwordError = validatePassword(form.password);
  if (passwordError) errors.password = passwordError;

  if (!form.confirmPassword) errors.confirmPassword = 'Confirm your password';
  else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  // Contact number: strict 10-digit SA local format (0XXXXXXXXX).
  const phoneError = validateStrictSALocalNumber(form.contactNumber, 'Contact number');
  if (phoneError) errors.contactNumber = phoneError;

  // SA ID: 13 digits, real date, valid citizenship digit, valid Luhn checksum.
  const idError = validateSAIdNumber(form.idNumber);
  if (idError) errors.idNumber = idError;

  if (!form.gender) errors.gender = 'Please select your gender';
  if (!form.ethnicity) errors.ethnicity = 'Please select your ethnicity';

  if (!form.sms && !form.notifyEmail && !form.inApp) {
    errors.notifications = 'Select at least one notification preference';
  }

  return errors;
}

/** Step 2. */
export function validateAddressInfo(form: RegistrationAddressInfo): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.streetNumber.trim()) errors.streetNumber = 'Street number is required';
  if (!form.streetName.trim()) errors.streetName = 'Street name is required';
  if (!form.city.trim()) errors.city = 'City is required';

  if (!form.postalCode.trim()) errors.postalCode = 'Postal code is required';
  else if (!/^\d{4}$/.test(form.postalCode.trim())) errors.postalCode = 'Postal code must be 4 digits';

  if (!form.province) errors.province = 'Please select your province';

  if (!form.nextOfKinName.trim()) errors.nextOfKinName = 'Next of kin name is required';
  if (!form.nextOfKinRelationship.trim()) errors.nextOfKinRelationship = 'Relationship is required';

  // Strict 10-digit SA local format (0XXXXXXXXX).
  const nokPhoneError = validateStrictSALocalNumber(
    form.nextOfKinContactNumber,
    'Next of kin contact number'
  );
  if (nokPhoneError) errors.nextOfKinContactNumber = nokPhoneError;

  return errors;
}