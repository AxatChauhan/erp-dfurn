/**
 * Auto-Code Generation & Formatting Engine
 * Replicates the authoritative algorithm from Utsav ERP:
 * - autoCode(name): First 2-3 letters, uppercase, ignoring word boundaries and non-letters.
 * - Master Product Code: CategoryCode-SubCategoryCode-NameInitials (e.g. WKSPC-PEDU-AMB).
 * - Variant Code: {MasterCode}-{seq} 3-digit zero-padded, monotonic max + 1.
 */

export function autoCode(name: string): string {
  if (!name || typeof name !== 'string') return 'PRD';
  // Strip all non-letters and spaces before slicing
  const cleaned = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (!cleaned) return 'PRD';
  // Use first 3 letters if available, otherwise first 2
  return cleaned.length >= 3 ? cleaned.slice(0, 3) : cleaned.padEnd(2, 'X');
}

export function formatMasterProductCode(categoryCode: string, subCategoryCode: string, name: string): string {
  const cat = (categoryCode || 'CAT').trim().toUpperCase();
  const sub = (subCategoryCode || 'SUB').trim().toUpperCase();
  const init = autoCode(name);
  return `${cat}-${sub}-${init}`;
}

export function parseVariantSequence(variantCode: string): number | null {
  const match = variantCode.match(/-(\d+)$/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return isNaN(num) ? null : num;
}

export function nextVariantCode(masterProductCode: string, existingVariantCodes: string[]): string {
  const numbers = existingVariantCodes
    .map((code) => parseVariantSequence(code))
    .filter((n): n is number => n !== null);
  const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `${masterProductCode.trim().toUpperCase()}-${String(nextNum).padStart(3, '0')}`;
}
