import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhone, formatPhone, GSTIN_REGEX, EMAIL_REGEX } from '@/lib/phone';
import { findCountry, DEFAULT_COUNTRY_ISO2 } from '@/lib/countries';

const RECOGNISED_HEADERS: Record<string, string[]> = {
  name: ['client name', 'customer name', 'name', 'client', 'company name', 'customer'],
  type: ['type', 'client type', 'customer type'],
  contactPerson: ['contact person', 'contact', 'point of contact', 'poc'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'tel', 'telephone'],
  email: ['email', 'email id', 'email address', 'mail'],
  addressLine1: ['address', 'address line 1', 'street', 'billing address'],
  city: ['city', 'town'],
  state: ['state', 'province', 'region'],
  pincode: ['pincode', 'pin code', 'pin', 'postal code', 'zip', 'zip code'],
  country: ['country', 'nation'],
  gstin: ['gstin', 'gst', 'gst no', 'gst number', 'tax id'],
  source: ['source', 'source category', 'lead source'],
  referredBy: ['referred by', 'referrer', 'source name']
};

function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let cell = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some(c => c.length > 0)) lines.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c.length > 0)) lines.push(row);
  }

  return lines;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or missing headers' }, { status: 400 });
    }

    const headers = rows[0].map(h => h.trim());
    const matchedColumns: { file: string; as: string }[] = [];
    const unknownColumns: string[] = [];
    const headerMapping: Record<number, string> = {};

    headers.forEach((h, idx) => {
      const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      let matchedKey: string | null = null;

      for (const [key, variants] of Object.entries(RECOGNISED_HEADERS)) {
        if (variants.some(v => v === cleanH || cleanH.includes(v))) {
          matchedKey = key;
          break;
        }
      }

      if (matchedKey) {
        matchedColumns.push({ file: h, as: matchedKey });
        headerMapping[idx] = matchedKey;
      } else {
        unknownColumns.push(h);
      }
    });

    const dataRows = rows.slice(1);
    let totalRows = 0;
    let emptyRows = 0;
    const duplicates: { rowNumber: number; name: string; reason: string }[] = [];
    const issues: { rowNumber: number; name: string; issues: string[] }[] = [];
    let readyCount = 0;
    let needsReviewCount = 0;

    const seenPhones = new Set<string>();
    const existingClients = await prisma.client.findMany({
      select: { phones: true, name: true }
    });

    const dbPhones = new Set<string>();
    existingClients.forEach(c => {
      const phones = Array.isArray(c.phones) ? (c.phones as string[]) : [];
      phones.forEach(p => dbPhones.add(p));
    });

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const rowNum = i + 2;

      const obj: Record<string, string> = {};
      r.forEach((val, idx) => {
        const key = headerMapping[idx];
        if (key) obj[key] = val;
      });

      if (!Object.values(obj).some(v => v && v.trim())) {
        emptyRows++;
        continue;
      }

      totalRows++;
      const name = obj.name || `Client row ${rowNum}`;
      const rowIssues: string[] = [];

      // Check phone
      const rawPhone = obj.phone || '';
      let normPhone: string | null = null;

      if (!rawPhone.trim()) {
        rowIssues.push('No phone number provided');
      } else {
        const norm = normalizePhone(rawPhone, DEFAULT_COUNTRY_ISO2);
        if (!norm.ok) {
          rowIssues.push(`Phone "${rawPhone}" is not valid: ${norm.error}`);
        } else if (norm.e164) {
          normPhone = norm.e164;
          if (dbPhones.has(normPhone)) {
            duplicates.push({ rowNumber: rowNum, name, reason: `Phone ${normPhone} already exists in database` });
            continue;
          }
          if (seenPhones.has(normPhone)) {
            duplicates.push({ rowNumber: rowNum, name, reason: `Duplicate phone ${normPhone} within file` });
            continue;
          }
          seenPhones.add(normPhone);
        }
      }

      // Check email
      if (obj.email && !EMAIL_REGEX.test(obj.email.trim())) {
        rowIssues.push(`Email "${obj.email}" does not look like a valid email address`);
      }

      // Check GSTIN
      if (obj.gstin && !GSTIN_REGEX.test(obj.gstin.trim().toUpperCase())) {
        rowIssues.push(`GSTIN "${obj.gstin}" is not a valid 15-character Indian GSTIN`);
      }

      if (rowIssues.length > 0) {
        needsReviewCount++;
        issues.push({ rowNumber: rowNum, name, issues: rowIssues });
      } else {
        readyCount++;
      }
    }

    const willImport = readyCount + needsReviewCount;

    return NextResponse.json({
      report: {
        totalRows,
        willImport,
        ready: readyCount,
        needsReview: needsReviewCount,
        duplicates,
        emptyRows,
        columns: matchedColumns,
        unknownColumns,
        issues
      }
    });
  } catch (error: any) {
    console.error('Error previewing CSV import:', error);
    return NextResponse.json({ error: error.message || 'Failed to process CSV file' }, { status: 500 });
  }
}
