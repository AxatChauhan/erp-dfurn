// Utility functions for Client Intelligence, GSTIN, and Phone validation

export const GSTIN_STATE_MAP: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh'
};

export const COMMON_COUNTRIES = [
  { code: 'IN', dial: '+91', name: 'India', flag: '🇮🇳' },
  { code: 'AE', dial: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'US', dial: '+1', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', dial: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'SG', dial: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: 'HK', dial: '+852', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'CN', dial: '+86', name: 'China', flag: '🇨🇳' },
  { code: 'AU', dial: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: 'CA', dial: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: 'DE', dial: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
];

/**
 * Validates 15-character Indian GSTIN and extracts state & PAN.
 */
export function analyzeGstin(gstin: string): {
  isValid: boolean;
  stateCode?: string;
  stateName?: string;
  pan?: string;
  error?: string;
} {
  const clean = gstin.trim().toUpperCase();
  if (!clean) return { isValid: false };

  // Indian GSTIN regex
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (clean.length !== 15) {
    return { isValid: false, error: 'GSTIN must be exactly 15 characters' };
  }

  const stateCode = clean.slice(0, 2);
  const pan = clean.slice(2, 12);
  const stateName = GSTIN_STATE_MAP[stateCode] || 'Unknown State';

  if (!gstinRegex.test(clean)) {
    return {
      isValid: false,
      stateCode,
      stateName,
      pan,
      error: 'GSTIN format is invalid (e.g. 24AAAAA0000A1Z5)'
    };
  }

  return {
    isValid: true,
    stateCode,
    stateName,
    pan
  };
}

/**
 * Normalizes a phone number for indexing and de-duplication.
 */
export function normalizePhoneNumber(rawPhone: string, defaultCountryDial = '+91'): string {
  if (!rawPhone) return '';
  // Remove non-digit characters except leading plus
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    // If it's a 10 digit Indian number
    if (cleaned.length === 10) {
      cleaned = defaultCountryDial + cleaned;
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = defaultCountryDial + cleaned.slice(1);
    } else {
      cleaned = defaultCountryDial + cleaned;
    }
  }
  return cleaned;
}

/**
 * Formats client code with padding: 1 -> DF_CL_000001
 */
export function formatClientCode(seqNumber: number): string {
  return `DF_CL_${String(seqNumber).padStart(6, '0')}`;
}
