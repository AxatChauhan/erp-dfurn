/**
 * Product Setup Status Engine
 * Computes live setup indicators (Process · BOM · Packing)
 * Status vocabulary: 'Configured' (Done/Green), 'In Progress' (Orange), 'Not Started' (Grey).
 */

export type SetupStatus = 'Configured' | 'In Progress' | 'Not Started';

export interface ProductProcessEntity {
  departmentIds?: string[] | null;
  processChart?: Record<string, string[]> | any | null;
}

export function processStatusOf(product?: ProductProcessEntity | null): SetupStatus {
  const depts = product?.departmentIds || [];
  const chart = (product?.processChart && typeof product.processChart === 'object') ? product.processChart : {};
  if (!depts.length) return 'Not Started';
  const filled = depts.filter((d) => Array.isArray(chart[d]) && chart[d].length > 0).length;
  if (filled === depts.length) return 'Configured';
  if (filled > 0) return 'In Progress';
  return 'Not Started';
}

export function bomStatusOf(rawBom?: any | null): SetupStatus {
  if (!rawBom || typeof rawBom !== 'object' || !rawBom.sections) return 'Not Started';
  if (rawBom.configured === true) return 'Configured';
  const sections = Object.values(rawBom.sections);
  const touched = sections.some((s: any) => {
    if (!s) return false;
    return s.status !== 'pending' || (Array.isArray(s.parts) && s.parts.length > 0) || (Array.isArray(s.lines) && s.lines.length > 0);
  });
  return touched ? 'In Progress' : 'Not Started';
}

export function packingStatusOf(packingList?: any | null): SetupStatus {
  if (!packingList || !Array.isArray(packingList.boxes) || !packingList.boxes.length) return 'Not Started';
  return packingList.configured === true ? 'Configured' : 'In Progress';
}

/**
 * Strips raw BOM, packing list, and large configuration histories from list responses
 * to maintain the < 400ms High-Performance Architecture mandate.
 */
export function toSlimListRow<T extends Record<string, any>>(record: T): Omit<T, 'bom' | 'packingList'> {
  const { bom, packingList, ...rest } = record;
  return rest;
}
