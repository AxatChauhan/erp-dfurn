import { prisma } from '@/lib/prisma';
import { fiscalYearOf, formatDate } from '@/lib/dates';
import { diffVersions } from './quoteChanges';

export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DEFAULT_GST_RATE = 18.0;

export const versionLabelOf = (versionNo: number): string => `v${Math.max(0, versionNo - 1)}`;

export type CanonicalQuoteStatus =
  | 'Draft'
  | 'Verification Required'
  | 'Admin Approval Required'
  | 'Approved'
  | 'Sent'
  | 'Followup Needed'
  | 'Converted'
  | 'Not Approved'
  | 'Not Converted';

export function normalizeQuoteStatus(rawStatus?: string | null): CanonicalQuoteStatus {
  if (!rawStatus) return 'Draft';
  const s = rawStatus.trim().toUpperCase();
  switch (s) {
    case 'DRAFT':
    case 'GENERATED':
      return 'Draft';
    case 'VERIFICATION_REQUIRED':
    case 'PENDING_VERIFICATION':
    case 'VERIFICATION REQUIRED':
      return 'Verification Required';
    case 'ADMIN_APPROVAL_REQUIRED':
    case 'PENDING_APPROVAL':
    case 'ADMIN APPROVAL REQUIRED':
      return 'Admin Approval Required';
    case 'APPROVED':
      return 'Approved';
    case 'SENT':
      return 'Sent';
    case 'CONVERTED':
    case 'WON':
      return 'Converted';
    case 'NOT_APPROVED':
    case 'REJECTED':
    case 'NOT APPROVED':
      return 'Not Approved';
    case 'NOT_CONVERTED':
    case 'DROPPED':
    case 'LOST':
    case 'CLIENT_REJECTED':
    case 'NOT CONVERTED':
      return 'Not Converted';
    default:
      return (rawStatus as CanonicalQuoteStatus) || 'Draft';
  }
}

export const round2 = (n: number | string | null | undefined): number =>
  Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

export function billingAddressOf(client: any) {
  if (!client || !Array.isArray(client.addresses)) return null;
  return client.addresses.find((a: any) => a.isBilling) || client.addresses[0] || null;
}

export function isIndianBusiness(client: any): boolean {
  if (!client) return false;
  const cType = client.clientType || client.type;
  if (cType !== 'Business') return false;
  const billing = billingAddressOf(client);
  if (billing && billing.country) {
    return String(billing.country).trim().toLowerCase() === 'india';
  }
  return client.countryIso2 ? client.countryIso2 === 'IN' : true;
}

export function clientChecks(client: any) {
  if (!client) {
    return [{ key: 'client', label: 'Client', ok: false, msg: 'This client could not be found' }];
  }
  const out: Array<{ key: string; label: string; ok: boolean; msg: string }> = [];

  // 1. Contact Person
  const cType = client.clientType || client.type;
  if (cType === 'Business') {
    out.push({
      key: 'contact',
      label: 'Contact person',
      ok: Boolean(client.contactPerson && client.contactPerson.trim()),
      msg: client.contactPerson && client.contactPerson.trim() ? '' : 'Missing contact person'
    });
  }

  // 2. Phone
  const phones = Array.isArray(client.phones) ? client.phones : [];
  const hasPhone = phones.length > 0 && phones.some((p: string) => p && p.trim().length >= 8);
  out.push({
    key: 'phone',
    label: 'Phone',
    ok: hasPhone,
    msg: hasPhone ? '' : 'Missing valid phone number'
  });

  // 3. Email
  const emails = Array.isArray(client.emails) ? client.emails : [];
  const validEmail = emails.length > 0 && emails.some((e: string) => EMAIL_REGEX.test(e.trim()));
  out.push({
    key: 'email',
    label: 'Email',
    ok: validEmail,
    msg: validEmail ? '' : 'Missing or invalid email address'
  });

  // 4. Billing Address
  const billing = billingAddressOf(client);
  const hasBilling = Boolean(billing && (billing.street || billing.city || billing.addressLine));
  out.push({
    key: 'billing',
    label: 'Billing address',
    ok: hasBilling,
    msg: hasBilling ? '' : 'Missing billing address'
  });

  // 5. GSTIN for Indian Business
  if (isIndianBusiness(client)) {
    const gstin = String(client.taxId || client.gstin || '').trim().toUpperCase();
    const gstinValid = GSTIN_REGEX.test(gstin);
    out.push({
      key: 'gstin',
      label: 'GST number (GSTIN)',
      ok: gstinValid,
      msg: !gstin
        ? 'Missing GSTIN (mandatory for Indian business)'
        : gstinValid
          ? ''
          : 'Invalid GSTIN format (e.g. 24AAAAA0000A1Z5)'
    });
  }

  return out;
}

export function readinessOf(quote: any, client: any) {
  const version = quote.latestVersion || (quote.versions && quote.versions[0]) || {};
  const items = version.items || [];
  const checklist: Array<{ key: string; fix: string; label: string; done: boolean; detail: string }> = [];
  const add = (key: string, fix: string, label: string, done: boolean, detail: string) =>
    checklist.push({ key, fix, label, done: Boolean(done), detail });

  // 1. Client Details
  const checks = clientChecks(client);
  const missingClient = checks.filter(c => !c.ok && c.key !== 'gstin');
  add(
    'client',
    'client',
    'Client details',
    missingClient.length === 0,
    missingClient.length === 0
      ? 'Billing address, contact, email and phone are complete'
      : `Needs ${missingClient.map(m => m.label.toLowerCase()).join(', ')}`
  );

  // 2. GST
  const indian = isIndianBusiness(client);
  const gstin = String(client?.taxId || client?.gstin || '').trim().toUpperCase();
  const gstinValid = GSTIN_REGEX.test(gstin);
  const gstCharged = version.gstApplicable !== false;
  let gstOk = true;
  let gstDetail = 'Not required for this client';
  let gstFix = 'client';

  if (indian) {
    if (!gstin) {
      gstOk = false;
      gstDetail = 'The client needs a GST number (GSTIN)';
      gstFix = 'client';
    } else if (!gstinValid) {
      gstOk = false;
      gstDetail = 'GST number does not look right: 15 characters, e.g. 24AAAAA0000A1Z5';
      gstFix = 'client';
    } else if (!gstCharged) {
      gstOk = false;
      gstDetail = 'GST must be charged on a quotation to an Indian business';
      gstFix = 'commercial';
    } else {
      gstDetail = `GSTIN ${gstin}, GST charged`;
    }
  }
  add('gst', gstFix, 'GST', gstOk, gstDetail);

  // 3. Products
  const hasProducts = items.length > 0;
  const generalCount = items.filter((it: any) => it.refType === 'MasterProduct').length;
  add(
    'lines',
    'products',
    'Products',
    hasProducts && generalCount === 0,
    !hasProducts
      ? 'Add at least one product'
      : generalCount > 0
        ? `${generalCount} general product${generalCount === 1 ? ' needs' : 's need'} a variant chosen`
        : `${items.length} product${items.length === 1 ? '' : 's'}`
  );

  // 4. Quantities and Rates
  const unpriced = items.filter((it: any) => !(Number(it.quantity) > 0) || !(Number(it.unitPrice) > 0)).length;
  add(
    'prices',
    'products',
    'Quantities and rates',
    hasProducts && unpriced === 0,
    !hasProducts
      ? 'No products yet'
      : unpriced > 0
        ? `${unpriced} product${unpriced === 1 ? ' has' : 's have'} no quantity or rate`
        : 'All above zero'
  );

  // 5. Customizable Choices
  let openChoices = 0;
  let pendingChoices = 0;
  items.forEach((it: any) => {
    const customizations = Array.isArray(it.customizations) ? it.customizations : [];
    customizations.forEach((c: any) => {
      if (!c.entryId && !c.pending) openChoices++;
      else if (c.pending) pendingChoices++;
    });
  });
  add(
    'choices',
    'products',
    'Customizable choices',
    openChoices === 0,
    openChoices > 0
      ? `${openChoices} choice${openChoices === 1 ? '' : 's'} left: choose it, or mark it "Pending from client"`
      : pendingChoices > 0
        ? `All decided or marked pending (${pendingChoices} pending from the client)`
        : 'All chosen'
  );

  // 6. Valid Until
  const today = new Date().toISOString().slice(0, 10);
  const validUntilStr = version.validUntil
    ? (typeof version.validUntil === 'string' ? version.validUntil.slice(0, 10) : new Date(version.validUntil).toISOString().slice(0, 10))
    : '';
  const validOk = Boolean(validUntilStr && validUntilStr >= today);
  add(
    'valid',
    'commercial',
    'Valid until',
    validOk,
    !validUntilStr
      ? 'The date the offer expires'
      : validUntilStr < today
        ? 'That date has passed'
        : `Valid until ${formatDate(validUntilStr)}`
  );

  // 7. Payment and Delivery Terms
  const terms = Array.isArray(version.terms) ? version.terms : [];
  const hasCommercial = terms.some((t: any) => t.group === 'commercial' || (t.title && t.title.toLowerCase().includes('payment')));
  const hasDelivery = terms.some((t: any) => t.group === 'delivery' || (t.title && t.title.toLowerCase().includes('delivery')));
  add(
    'terms',
    'terms',
    'Payment and delivery terms',
    hasCommercial && hasDelivery,
    !hasCommercial && !hasDelivery
      ? 'Add a payment (commercial) term and a delivery term'
      : !hasCommercial
        ? 'Add a payment (commercial) term'
        : !hasDelivery
          ? 'Add a delivery term'
          : 'In place'
  );

  // 8. Salesperson
  const spId = quote.salespersonId || quote.enquiry?.salespersonId;
  const spName = quote.salespersonName || quote.enquiry?.salesperson?.name;
  add(
    'salesperson',
    'details',
    'Salesperson',
    Boolean(spId),
    spId ? (spName || 'Assigned') : 'Choose who owns this quotation'
  );

  const doneCount = checklist.filter(c => c.done).length;
  return {
    ready: doneCount === checklist.length,
    left: checklist.length - doneCount,
    items: checklist
  };
}

export function computeLineTotal(item: {
  unitPrice: number;
  quantity: number;
  discountType?: 'flat' | 'percent' | null;
  discountValue?: number | null;
}) {
  const price = Math.max(0, Number(item.unitPrice) || 0);
  const qty = Math.max(1, Number(item.quantity) || 1);
  const discType = item.discountType === 'percent' ? 'percent' : item.discountType === 'flat' ? 'flat' : null;
  let discVal = Math.max(0, Number(item.discountValue) || 0);

  let unitDiscount = 0;
  if (discType === 'percent') {
    discVal = Math.min(100, discVal);
    unitDiscount = round2((price * discVal) / 100);
  } else if (discType === 'flat') {
    discVal = Math.min(price, discVal);
    unitDiscount = discVal;
  }

  const lineTotal = round2((price - unitDiscount) * qty);
  return {
    unitDiscount,
    discountAmount: round2(unitDiscount * qty),
    lineTotal
  };
}

export function buildVersionComputedFields(payload: {
  items: any[];
  additionalCharges?: any[];
  gstApplicable?: boolean;
  gstRatePct?: number;
  overallDiscountType?: 'flat' | 'percent' | null;
  overallDiscountVal?: number | null;
}) {
  const computedItems = payload.items.map((item, idx) => {
    const { unitDiscount, discountAmount, lineTotal } = computeLineTotal(item);
    return {
      lineId: item.lineId || `line-${Date.now()}-${idx}`,
      refType: item.refType || 'Variant',
      refId: item.refId || null,
      snapshot: item.snapshot || { name: item.description || 'Custom Unit', code: item.code || null, unit: item.unit || 'pcs' },
      description: item.description?.trim() || '',
      quantity: Math.max(1, Number(item.quantity) || 1),
      unitPrice: Math.max(0, Number(item.unitPrice) || 0),
      discountType: item.discountType || null,
      discountValue: Number(item.discountValue) || 0,
      discountAmount,
      total: lineTotal,
      customizations: Array.isArray(item.customizations) ? item.customizations : [],
      expectedDimensions: item.expectedDimensions || null,
      materialPreference: item.materialPreference || null,
      clientComment: item.clientComment || null
    };
  });

  const grossTotal = round2(computedItems.reduce((acc, it) => acc + it.total, 0));

  let discountAmount = 0;
  const oType = payload.overallDiscountType === 'percent' ? 'percent' : payload.overallDiscountType === 'flat' ? 'flat' : null;
  let oVal = Number(payload.overallDiscountVal) || 0;
  if (oType === 'percent') {
    oVal = Math.min(100, Math.max(0, oVal));
    discountAmount = round2(grossTotal * (oVal / 100));
  } else if (oType === 'flat') {
    oVal = Math.min(grossTotal, Math.max(0, oVal));
    discountAmount = oVal;
  }
  const discountedGross = round2(Math.max(0, grossTotal - discountAmount));

  const additionalCharges = (payload.additionalCharges || []).map(c => ({
    title: c.title || c.categoryName || 'Additional Service',
    amount: round2(Math.max(0, Number(c.amount) || 0)),
    taxable: c.taxable !== false
  }));

  const extraCostsTotal = round2(additionalCharges.reduce((acc, c) => acc + c.amount, 0));
  const taxableExtra = round2(additionalCharges.filter(c => c.taxable).reduce((acc, c) => acc + c.amount, 0));

  const gstApplicable = payload.gstApplicable !== false;
  const gstRatePct = payload.gstRatePct != null ? Number(payload.gstRatePct) : DEFAULT_GST_RATE;
  const gstAmount = gstApplicable ? round2((gstRatePct / 100) * (discountedGross + taxableExtra)) : 0;
  const grandTotal = round2(discountedGross + extraCostsTotal + gstAmount);

  return {
    items: computedItems,
    grossTotal,
    overallDiscountType: oType,
    overallDiscountVal: oVal,
    overallDiscountAmt: discountAmount,
    discountedGross,
    additionalCharges,
    extraCostsTotal,
    gstApplicable,
    gstRatePct,
    gstAmount,
    grandTotal
  };
}

export function followupInfo(version: any) {
  if (!version || normalizeQuoteStatus(version.status) !== 'Sent' || !version.sentAt) {
    const followupCount = Array.isArray(version?.followupDoneAt) ? version.followupDoneAt.length : 0;
    return { followupNeeded: false, followupCount };
  }
  const followups = Array.isArray(version.followupDoneAt) ? (version.followupDoneAt as string[]) : [];
  const lastTime = followups.length > 0 ? new Date(followups[followups.length - 1]).getTime() : new Date(version.sentAt).getTime();
  const diffDays = (Date.now() - lastTime) / (1000 * 60 * 60 * 24);
  const threshold = followups.length === 0 ? 2 : 1;
  return {
    followupNeeded: diffDays >= threshold,
    followupCount: followups.length
  };
}

export async function nextQuoteNumber(): Promise<string> {
  const fyKey = fiscalYearOf(new Date()).key;
  const prefix = `DF/Q/${fyKey}/`;

  const latestQuote = await prisma.quotation.findFirst({
    where: {
      code: { startsWith: prefix }
    },
    orderBy: { code: 'desc' },
    select: { code: true }
  });

  let nextSeq = 1;
  if (latestQuote?.code) {
    const part = latestQuote.code.replace(prefix, '');
    const num = parseInt(part, 10);
    if (!isNaN(num)) nextSeq = num + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

export const standardTerms = [
  {
    id: 'term-payment-std',
    termId: 'TERM_PAYMENT',
    group: 'commercial',
    title: 'Payment Terms',
    text: '{advance}% advance with order, {dispatch}% prior to factory dispatch, {install}% upon installation completion.',
    values: { advance: 50, dispatch: 40, install: 10 }
  },
  {
    id: 'term-delivery-std',
    termId: 'TERM_DELIVERY',
    group: 'delivery',
    title: 'Delivery Timeline',
    text: '{weeks} weeks from approval of final production drawings and receipt of advance payment.',
    values: { weeks: 3 }
  },
  {
    id: 'term-validity-std',
    termId: 'TERM_VALIDITY',
    group: 'commercial',
    title: 'Validity',
    text: 'This proposal is valid for {days} days from the date of issue.',
    values: { days: 15 }
  },
  {
    id: 'term-warranty-std',
    termId: 'TERM_WARRANTY',
    group: 'commercial',
    title: 'Warranty',
    text: '{years} years comprehensive factory warranty against manufacturing defects on structural hardware.',
    values: { years: 5 }
  }
];
