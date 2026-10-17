export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

export function formatDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '–';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '–';
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
}

export function formatDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '–';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '–';
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}, ${hour12}:${m} ${ampm}`;
}

export function shortDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/**
 * FY 2026-27 = 1 Apr 2026 – 31 Mar 2027.
 * Month index 3 = April (0-based).
 */
export function fiscalYearOf(dateInput: string | Date): {
  key: string;
  startYear: number;
  endYear: number;
  label: string;
} {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return {
    key: `${startYear}-${endYearShort}`,
    startYear,
    endYear: startYear + 1,
    label: `FY ${startYear}-${endYearShort}`
  };
}

export function currentFiscalYearKey(): string {
  return fiscalYearOf(new Date()).key;
}

export function listFiscalYears(dates: (string | Date | null | undefined)[]): { key: string; label: string }[] {
  const keys = new Map<string, { key: string; label: string }>();

  const add = (input: string | Date) => {
    const fy = fiscalYearOf(input);
    keys.set(fy.key, { key: fy.key, label: `FY ${fy.key}` });
  };

  add(new Date());
  (Array.isArray(dates) ? dates : []).forEach(d => {
    if (d) add(d);
  });

  return [...keys.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function todayCodeDate(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`;
}
