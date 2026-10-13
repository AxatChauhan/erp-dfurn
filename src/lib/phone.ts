import { COUNTRIES, findCountry, DEFAULT_COUNTRY_ISO2, Country } from './countries';

export interface PhoneDetail {
  e164: string;
  dial: string;
  number: string;
  iso2: string | null;
  valid: boolean;
  kind: string | null; // 'Mobile' | 'Landline' | 'Mobile or landline' | 'Toll free' | 'Internet phone'
}

export interface RawPhone {
  iso2: string;
  number: string;
  serverIssue?: string | null;
}

const MAIN_FOR_CODE: Record<string, string> = {
  '+1': 'US',
  '+7': 'RU',
  '+44': 'GB',
  '+61': 'AU',
  '+47': 'NO',
  '+39': 'IT',
  '+358': 'FI',
  '+212': 'MA',
  '+262': 'RE',
  '+590': 'GP',
  '+599': 'CW'
};

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function lengthsText(lengths?: number[]): string {
  if (!lengths || !lengths.length) return '';
  if (lengths.length === 1) return String(lengths[0]);
  const contiguous = lengths.every((n, i) => !i || n === lengths[i - 1] + 1);
  return contiguous
    ? `${lengths[0]} to ${lengths[lengths.length - 1]}`
    : `${lengths.slice(0, -1).join(', ')} or ${lengths[lengths.length - 1]}`;
}

export function phoneHint(iso2?: string): string {
  const c = findCountry(iso2) || COUNTRIES[0];
  return c.lengths ? `${lengthsText(c.lengths)} digits` : 'Phone number';
}

/**
 * Instant digit-count check while typing, from the country list's lengths
 */
export function phoneIssue(number: string, iso2: string): string | null {
  const raw = String(number || '').trim();
  if (!raw) return null;
  if (/[^\d\s()+\-.]/.test(raw)) return 'Use digits only';

  const c = findCountry(iso2) || COUNTRIES[0];
  let digits = raw.replace(/\D/g, '');

  if (raw.startsWith('+')) {
    const code = c.dialCode.slice(1);
    if (!digits.startsWith(code)) {
      return `This starts with a different country code than ${c.dialCode}`;
    }
    digits = digits.slice(code.length);
  }

  const l = c.lengths || [];
  if (!l.length || l.includes(digits.length)) return null;
  if (digits.startsWith('0') && l.includes(digits.length - 1)) {
    return 'Leave out the leading 0';
  }
  return `${c.name} numbers have ${lengthsText(l)} digits; this has ${digits.length}`;
}

export function emailIssue(email?: string | null): string | null {
  const v = String(email || '').trim();
  return v && !EMAIL_REGEX.test(v) ? 'This does not look like an email address' : null;
}

/**
 * Splits E.164 phone into country code and local number
 */
export function splitPhone(
  e164?: string | null,
  fallbackIso2: string = 'IN',
  preferIso2?: string | null
): { iso2: string; number: string; dial: string } {
  const s = String(e164 || '').trim();
  if (!s.startsWith('+')) {
    const fallbackCountry = findCountry(fallbackIso2) || COUNTRIES[0];
    return {
      iso2: fallbackCountry.iso2,
      number: s,
      dial: fallbackCountry.dialCode
    };
  }

  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const first = sorted.find(c => s.startsWith(c.dialCode));
  if (!first) {
    const fallbackCountry = findCountry(fallbackIso2) || COUNTRIES[0];
    return {
      iso2: fallbackCountry.iso2,
      number: s,
      dial: fallbackCountry.dialCode
    };
  }

  const tied = sorted.filter(c => c.dialCode === first.dialCode);
  const pick =
    tied.find(c => c.iso2 === preferIso2) ||
    tied.find(c => c.iso2 === fallbackIso2) ||
    tied.find(c => c.iso2 === MAIN_FOR_CODE[first.dialCode]) ||
    first;

  return {
    iso2: pick.iso2,
    number: s.slice(first.dialCode.length).trim(),
    dial: pick.dialCode
  };
}

/**
 * Normalizes phone number to E.164 and checks validity against digit lengths
 */
export function normalizePhone(
  rawInput: string | { iso2?: string; number?: string },
  defaultIso2: string = DEFAULT_COUNTRY_ISO2
): { ok: boolean; e164?: string; error?: string; iso2?: string; dial?: string; number?: string } {
  let iso2 = defaultIso2;
  let rawNumber = '';

  if (typeof rawInput === 'object' && rawInput !== null) {
    iso2 = rawInput.iso2 || defaultIso2;
    rawNumber = String(rawInput.number || '').trim();
  } else {
    rawNumber = String(rawInput || '').trim();
  }

  if (!rawNumber) {
    return { ok: false, error: 'Phone number is required' };
  }

  let digits = rawNumber.replace(/\D/g, '');
  let country = findCountry(iso2) || COUNTRIES[0];

  if (rawNumber.startsWith('+')) {
    const split = splitPhone(rawNumber, defaultIso2);
    iso2 = split.iso2;
    country = findCountry(iso2) || COUNTRIES[0];
    rawNumber = split.number;
    digits = rawNumber.replace(/\D/g, '');
  }

  if (digits.startsWith('0') && country.lengths?.includes(digits.length - 1)) {
    digits = digits.slice(1);
  }

  const lengths = country.lengths || [10];
  const valid = lengths.length === 0 || lengths.includes(digits.length);

  if (!valid) {
    return {
      ok: false,
      error: `"${rawNumber}" is not a valid ${country.name} phone number (${lengthsText(lengths)} digits expected)`,
      iso2: country.iso2,
      dial: country.dialCode,
      number: digits
    };
  }

  const e164 = `${country.dialCode}${digits}`;
  return {
    ok: true,
    e164,
    iso2: country.iso2,
    dial: country.dialCode,
    number: digits
  };
}

/**
 * Formats E.164 phone for display and metadata
 */
export function formatPhone(rawOrE164?: string | null, defaultIso2: string = 'IN'): PhoneDetail {
  const raw = String(rawOrE164 || '').trim();
  if (!raw) {
    return {
      e164: '',
      dial: '',
      number: '',
      iso2: null,
      valid: false,
      kind: null
    };
  }

  const split = splitPhone(raw, defaultIso2);
  const country = findCountry(split.iso2);
  const digits = split.number.replace(/\D/g, '');
  const lengths = country?.lengths || [10];
  const valid = lengths.length === 0 || lengths.includes(digits.length);

  // Group formatting based on length
  let formattedNumber = digits;
  if (country?.iso2 === 'IN' && digits.length === 10) {
    formattedNumber = `${digits.slice(0, 5)} ${digits.slice(5)}`;
  } else if (country?.iso2 === 'US' && digits.length === 10) {
    formattedNumber = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  } else if (digits.length >= 8) {
    formattedNumber = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  return {
    e164: raw.startsWith('+') ? raw : `${split.dial}${digits}`,
    dial: split.dial,
    number: formattedNumber || raw,
    iso2: split.iso2,
    valid,
    kind: valid ? 'Mobile' : null
  };
}

export function isIndia(country?: string | null): boolean {
  return String(country || '').trim().toLowerCase() === 'india' || String(country || '').trim().toUpperCase() === 'IN';
}

export interface Address {
  id?: string;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country: string;
  isBilling?: boolean;
}

export function blankAddress(countryName: string = 'India', isBilling: boolean = false): Address {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: countryName,
    isBilling
  };
}

export function addressLines(a: Partial<Address>): string[] {
  if (!a) return [];
  const lines: string[] = [];
  if (a.addressLine1?.trim()) lines.push(a.addressLine1.trim());
  if (a.addressLine2?.trim()) lines.push(a.addressLine2.trim());

  const cityStateZip = [
    a.city?.trim(),
    [a.state?.trim(), a.pincode?.trim()].filter(Boolean).join(' ')
  ].filter(Boolean).join(', ');

  if (cityStateZip) lines.push(cityStateZip);
  if (a.country?.trim()) lines.push(a.country.trim());
  return lines;
}

export function addressProblem(addresses: Address[]): string | null {
  for (let i = 0; i < addresses.length; i++) {
    const a = addresses[i];
    const label = `Address ${i + 1}`;
    if (!a.addressLine1?.trim()) return `${label}: address line 1 is required`;
    if (!a.country?.trim()) return `${label}: country is required`;
    if (isIndia(a.country)) {
      if (!a.state?.trim()) return `${label}: state is required for an Indian address`;
      if (!a.pincode?.trim()) return `${label}: pincode is required for an Indian address`;
    }
  }
  return null;
}
