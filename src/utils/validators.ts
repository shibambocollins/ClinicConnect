// Email

// local-part@domain.tld : no spaces, one "@", a dot in the domain, TLD of 2+ letters.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export function validateEmail(value: string | null | undefined): string | null {
  const email = (value ?? '').trim();
  if (!email) return 'Email is required';
  if (email.length > 254) return 'Email is too long';
  if (!EMAIL_RE.test(email) || email.includes('..')) return 'Enter a valid email address';
  const [local] = email.split('@');
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.')) {
    return 'Enter a valid email address';
  }
  return null;
}

export const isValidEmail = (value: string | null | undefined): boolean =>
  validateEmail(value) === null;

// Phone number (South Africa)
// Accepted: 0821234567, 082 123 4567, 082-123-4567, +27821234567, 27821234567,
//           0027821234567.
// Rules: after removing spaces, dashes, dots and brackets, the number must be 10
// digits starting with 0 (or the same number with +27 / 27 / 0027 instead of the
// leading 0). The first digit after the 0 cannot be 0 or 9.

/** Returns the number in local 10-digit form (0821234567), or null if it isn't valid. */
export function normalizePhoneNumber(value: string | null | undefined): string | null {
  let digits = (value ?? '').trim().replace(/[\s\-().]/g, '');
  if (!digits) return null;

  if (digits.startsWith('+27')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('0027')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('27') && digits.length === 11) digits = '0' + digits.slice(2);

  return /^0[1-8]\d{8}$/.test(digits) ? digits : null;
}

export function validatePhoneNumber(
  value: string | null | undefined,
  label = 'Contact number'
): string | null {
  if (!(value ?? '').trim()) return `${label} is required`;
  if (!normalizePhoneNumber(value)) {
    return `${label} must be a valid South African number (e.g. 0821234567)`;
  }
  return null;
}

export const isValidPhoneNumber = (value: string | null | undefined): boolean =>
  normalizePhoneNumber(value) !== null;

// Strict 10-digit SA local format, e.g. 0821234567.
// Unlike normalizePhoneNumber, this rejects +27 / 0027 / spaces / dashes.
const SA_LOCAL_10_RE = /^0[1-8]\d{8}$/;

export function isStrictSALocalNumber(value: string | null | undefined): boolean {
  return SA_LOCAL_10_RE.test((value ?? '').trim());
}

export function validateStrictSALocalNumber(
  value: string | null | undefined,
  label = 'Contact number'
): string | null {
  const digits = (value ?? '').trim();
  if (!digits) return `${label} is required`;
  if (!/^\d+$/.test(digits)) return `${label} must contain digits only`;
  if (digits.length !== 10) return `${label} must be exactly 10 digits`;
  if (!SA_LOCAL_10_RE.test(digits)) {
    return `${label} must be a valid SA number starting with 0 (e.g. 0821234567)`;
  }
  return null;
}

// South African ID number
// 13 digits:  Y Y M M D D | S S S S | C | A | Z
//   YYMMDD  date of birth
//   SSSS    gender sequence: 0000-4999 female, 5000-9999 male
//   C       citizenship: 0 = SA citizen, 1 = permanent resident
//   A       historical digit (8 or 9 on modern IDs); not enforced
//   Z       Luhn check digit

export interface SAIdInfo {
  dateOfBirth: Date;
  /** YYYY-MM-DD */
  dateOfBirthISO: string;
  gender: 'Male' | 'Female';
  isCitizen: boolean;
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  // Walk from the right; double every second digit starting with the 2nd from the right.
  for (let i = 0; i < digits.length; i++) {
    let n = parseInt(digits[digits.length - 1 - i], 10);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Works out the full birth year from YY: a 2-digit year in the future means 19YY. */
function resolveBirthYear(yy: number, now: Date): number {
  const currentYY = now.getFullYear() % 100;
  return yy > currentYY ? 1900 + yy : 2000 + yy;
}

/** Returns the details encoded in a valid SA ID number, or null if the ID isn't valid. */
export function parseSAIdNumber(
  value: string | null | undefined,
  now: Date = new Date()
): SAIdInfo | null {
  const id = (value ?? '').trim();
  if (!/^\d{13}$/.test(id)) return null;

  const yy = parseInt(id.slice(0, 2), 10);
  const mm = parseInt(id.slice(2, 4), 10);
  const dd = parseInt(id.slice(4, 6), 10);
  const year = resolveBirthYear(yy, now);

  // Rejects things like 31 February by checking the date survives a round trip.
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  if (
    dob.getUTCFullYear() !== year ||
    dob.getUTCMonth() !== mm - 1 ||
    dob.getUTCDate() !== dd
  ) {
    return null;
  }
  if (dob.getTime() > now.getTime()) return null;

  const citizenship = id[10];
  if (citizenship !== '0' && citizenship !== '1') return null;

  if (!passesLuhn(id)) return null;

  return {
    dateOfBirth: dob,
    dateOfBirthISO: dob.toISOString().slice(0, 10),
    gender: parseInt(id.slice(6, 10), 10) >= 5000 ? 'Male' : 'Female',
    isCitizen: citizenship === '0',
  };
}

export function validateSAIdNumber(value: string | null | undefined): string | null {
  const id = (value ?? '').trim();
  if (!id) return 'ID number is required';
  if (!/^\d+$/.test(id)) return 'ID number must contain digits only';
  if (id.length !== 13) return 'ID number must be 13 digits';
  if (!parseSAIdNumber(id)) return 'Enter a valid South African ID number';
  return null;
}

export const isValidSAIdNumber = (value: string | null | undefined): boolean =>
  parseSAIdNumber(value) !== null;