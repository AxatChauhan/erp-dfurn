/**
 * What changed between two versions of a quotation.
 *
 * Computed ONCE on the server when a revision is saved, and stored on the new
 * version as `changes`, so history never depends on re-diffing old data and a
 * later change to the product master cannot rewrite it. Lines are matched on
 * their stable `lineId`, never on position or product.
 *
 * Change item schema:
 * { scope: 'line' | 'quote', lineId?: string, name?: string, field: string, label: string, type: 'added' | 'removed' | 'qty' | 'money' | 'text', from: any, to: any }
 */

import { formatDate } from '@/lib/dates';

export interface VersionChange {
  scope: 'line' | 'quote';
  lineId?: string;
  name?: string;
  field: string;
  label: string;
  type: 'added' | 'removed' | 'qty' | 'money' | 'text';
  from: any;
  to: any;
}

const round2 = (n: number | string | null | undefined): number =>
  Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

const choiceText = (c: any): string => {
  if (!c) return 'None';
  if (c.entryId) return c.name || 'Chosen';
  if (c.pending) return 'Pending from client';
  return 'Not chosen yet';
};

const discountText = (item: any): string => {
  const v = Number(item.discountValue) || 0;
  if (!v) return 'None';
  return item.discountType === 'percent' ? `${v}%` : `₹${v} off per unit`;
};

const nameOf = (line: any): string => {
  return line?.snapshot?.name || line?.description || 'Product';
};

export function lineChanges(prev: any, next: any): VersionChange[] {
  const out: VersionChange[] = [];
  const base = { scope: 'line' as const, lineId: next.lineId, name: nameOf(next) };
  const push = (field: string, label: string, type: VersionChange['type'], from: any, to: any) =>
    out.push({ ...base, field, label, type, from, to });

  if (prev.refId && next.refId && prev.refId !== next.refId) {
    push('product', 'Product', 'text', nameOf(prev), nameOf(next));
  }
  if (Number(prev.quantity) !== Number(next.quantity)) {
    push('quantity', 'Quantity', 'qty', Number(prev.quantity), Number(next.quantity));
  }
  if (round2(prev.unitPrice) !== round2(next.unitPrice)) {
    push('unitPrice', 'Unit rate', 'money', round2(prev.unitPrice), round2(next.unitPrice));
  }
  if (discountText(prev) !== discountText(next)) {
    push('discount', 'Unit discount', 'text', discountText(prev), discountText(next));
  }
  const prevDesc = String(prev.description || '').trim();
  const nextDesc = String(next.description || '').trim();
  if (prevDesc !== nextDesc) {
    push('note', 'Note', 'text', prevDesc || 'None', nextDesc || 'None');
  }

  // Customizable choices
  const prevCustomMap = new Map<string, any>(
    (Array.isArray(prev.customizations) ? prev.customizations : []).map((c: any) => [c.key, c])
  );
  (Array.isArray(next.customizations) ? next.customizations : []).forEach((c: any) => {
    const was = prevCustomMap.get(c.key);
    const a = choiceText(was);
    const b = choiceText(c);
    if (a !== b || (was && was.entryId !== c.entryId)) {
      push(`custom:${c.key}`, c.key, 'text', a, b);
    }
  });

  return out;
}

const termKey = (t: any) => t.id || t.termId || t.title || t.text || '';
const termText = (t: any) => {
  let text = t.text || (t.title && t.body ? `${t.title}: ${t.body}` : t.title || t.body || '');
  if (t.values && typeof t.values === 'object') {
    Object.keys(t.values).forEach(k => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(t.values[k]));
    });
  }
  return text;
};

export function diffVersions(prev: any, next: any): VersionChange[] {
  const changes: VersionChange[] = [];
  const prevLines = new Map<string, any>(
    (Array.isArray(prev.items || prev.lineItems) ? (prev.items || prev.lineItems) : []).map((l: any) => [
      l.lineId || l.id,
      l
    ])
  );
  const nextIds = new Set<string>();

  const nextLines = Array.isArray(next.items || next.lineItems) ? (next.items || next.lineItems) : [];
  nextLines.forEach((line: any) => {
    const lineId = line.lineId || line.id;
    if (lineId) nextIds.add(lineId);
    const was = lineId ? prevLines.get(lineId) : null;
    if (!was) {
      changes.push({
        scope: 'line',
        lineId,
        name: nameOf(line),
        field: 'line',
        label: 'Product',
        type: 'added',
        from: null,
        to: nameOf(line)
      });
    } else {
      changes.push(...lineChanges(was, line));
    }
  });

  prevLines.forEach((line, lineId) => {
    if (!nextIds.has(lineId)) {
      changes.push({
        scope: 'line',
        lineId,
        name: nameOf(line),
        field: 'line',
        label: 'Product',
        type: 'removed',
        from: nameOf(line),
        to: null
      });
    }
  });

  const q = (field: string, label: string, type: VersionChange['type'], from: any, to: any) =>
    changes.push({ scope: 'quote', field, label, type, from, to });

  // Valid until
  const prevValid = prev.validUntil ? (typeof prev.validUntil === 'string' ? prev.validUntil.slice(0, 10) : new Date(prev.validUntil).toISOString().slice(0, 10)) : null;
  const nextValid = next.validUntil ? (typeof next.validUntil === 'string' ? next.validUntil.slice(0, 10) : new Date(next.validUntil).toISOString().slice(0, 10)) : null;
  if (prevValid !== nextValid) {
    q('validUntil', 'Valid until', 'text', prevValid ? formatDate(prevValid) : 'Not set', nextValid ? formatDate(nextValid) : 'Not set');
  }

  // GST
  const gstText = (g: any) => {
    const applicable = g ? (g.applicable ?? g.gstApplicable) : true;
    const rate = g ? (g.ratePct ?? g.gstRatePct ?? 18) : 18;
    return applicable ? `${rate}% applicable` : 'Not applicable';
  };
  const prevGst = prev.gst || { gstApplicable: prev.gstApplicable, gstRatePct: prev.gstRatePct };
  const nextGst = next.gst || { gstApplicable: next.gstApplicable, gstRatePct: next.gstRatePct };
  if (gstText(prevGst) !== gstText(nextGst)) {
    q('gst', 'GST', 'text', gstText(prevGst), gstText(nextGst));
  }

  // Overall discount
  const odText = (d: any) => {
    const type = d ? (d.type ?? d.overallDiscountType) : null;
    const val = Number(d ? (d.value ?? d.overallDiscountVal) : 0) || 0;
    if (!val) return 'None';
    return type === 'percent' ? `${val}%` : `₹${val}`;
  };
  const prevOd = prev.overallDiscount || { overallDiscountType: prev.overallDiscountType, overallDiscountVal: prev.overallDiscountVal };
  const nextOd = next.overallDiscount || { overallDiscountType: next.overallDiscountType, overallDiscountVal: next.overallDiscountVal };
  if (odText(prevOd) !== odText(nextOd)) {
    q('overallDiscount', 'Overall discount', 'text', odText(prevOd), odText(nextOd));
  }

  // Additional charges
  const chargeKey = (e: any) => e.categoryId || e.title || e.categoryName;
  const prevCharges = new Map<string, any>(
    (Array.isArray(prev.additionalCharges || prev.extraCosts) ? (prev.additionalCharges || prev.extraCosts) : []).map((e: any) => [chargeKey(e), e])
  );
  const nextCharges = new Map<string, any>(
    (Array.isArray(next.additionalCharges || next.extraCosts) ? (next.additionalCharges || next.extraCosts) : []).map((e: any) => [chargeKey(e), e])
  );

  nextCharges.forEach((e, k) => {
    const was = prevCharges.get(k);
    const title = e.title || e.categoryName || 'Additional charge';
    if (!was) {
      q(`charge:${k}`, `Additional charge · ${title}`, 'added', null, round2(e.amount));
    } else if (round2(was.amount) !== round2(e.amount)) {
      q(`charge:${k}`, `Additional charge · ${title}`, 'money', round2(was.amount), round2(e.amount));
    }
  });

  prevCharges.forEach((e, k) => {
    if (!nextCharges.has(k)) {
      const title = e.title || e.categoryName || 'Additional charge';
      q(`charge:${k}`, `Additional charge · ${title}`, 'removed', round2(e.amount), null);
    }
  });

  // Terms
  const prevTerms = new Map<string, any>(
    (Array.isArray(prev.terms) ? prev.terms : []).map((t: any) => [termKey(t), t])
  );
  const nextTerms = new Map<string, any>(
    (Array.isArray(next.terms) ? next.terms : []).map((t: any) => [termKey(t), t])
  );

  nextTerms.forEach((t, k) => {
    const was = prevTerms.get(k);
    if (!was) {
      q(`term:${k}`, 'Term', 'added', null, termText(t));
    } else if (termText(was) !== termText(t)) {
      q(`term:${k}`, 'Term', 'text', termText(was), termText(t));
    }
  });

  prevTerms.forEach((t, k) => {
    if (!nextTerms.has(k)) {
      q(`term:${k}`, 'Term', 'removed', termText(t), null);
    }
  });

  return changes;
}
