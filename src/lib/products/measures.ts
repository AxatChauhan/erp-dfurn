/**
 * Product Measures & Dimensional Formulas
 * Follows D'furn Modular Systems Owner UX Mandate:
 * - Dimensions are always L B H (Length, Breadth, Height in mm)
 * - Inches: mm / 25.4 rounded to 2 decimals
 * - CBM: Computed strictly from Box (shipping) dimensions in m³ (4 decimals)
 */

export const DELIVERY_MODES = ['RTA', 'Pre-assembled'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const UNITS = ['Nos', 'Sq.Ft', 'R.Ft', 'kg'] as const;
export type UnitOfMeasurement = (typeof UNITS)[number];

export const CREATION_MODES = ['In-house', 'Outsource'] as const;
export type CreationMode = (typeof CREATION_MODES)[number];

export interface DimensionsMm {
  l: number;
  w: number; // breadth/depth stored as 'w'
  h: number;
}

export interface DimensionsInches {
  l: number;
  w: number;
  h: number;
}

export function mmToInches(mm: number): number {
  if (typeof mm !== 'number' || isNaN(mm)) return 0;
  return Math.round((mm / 25.4) * 100) / 100;
}

export function dimensionsInInches(dim?: DimensionsMm | null): DimensionsInches | null {
  if (!dim || typeof dim.l !== 'number' || typeof dim.w !== 'number' || typeof dim.h !== 'number') {
    return null;
  }
  return {
    l: mmToInches(dim.l),
    w: mmToInches(dim.w),
    h: mmToInches(dim.h),
  };
}

/**
 * CBM (Cubic Meters) computed strictly from Box (packed/shipping) dimensions.
 * Owner mandate: (l/1000) * (b/1000) * (h/1000) rounded to 4 decimals.
 */
export function computeCbm(boxMm?: DimensionsMm | null): number | null {
  if (!boxMm || typeof boxMm.l !== 'number' || typeof boxMm.w !== 'number' || typeof boxMm.h !== 'number') {
    return null;
  }
  const m3 = (boxMm.l / 1000) * (boxMm.w / 1000) * (boxMm.h / 1000);
  return Math.round(m3 * 10000) / 10000;
}

export function isPositiveDimensions(dim?: DimensionsMm | null): boolean {
  if (!dim) return false;
  return [dim.l, dim.w, dim.h].every((v) => typeof v === 'number' && !isNaN(v) && v > 0);
}

/**
 * Formats dimensions according to Owner Rule 4:
 * "Dimensions ALWAYS Say L B H" -> e.g. "L 1400 × B 700 × H 750 mm"
 */
export function formatLbh(dim?: DimensionsMm | null): string {
  if (!dim || !isPositiveDimensions(dim)) return '–';
  return `L ${dim.l} × B ${dim.w} × H ${dim.h} mm`;
}
