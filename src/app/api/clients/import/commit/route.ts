import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { invalidateClientKpiCache } from '@/app/api/clients/route';
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
    const headerMapping: Record<number, string> = {};

    headers.forEach((h, idx) => {
      const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      for (const [key, variants] of Object.entries(RECOGNISED_HEADERS)) {
        if (variants.some(v => v === cleanH || cleanH.includes(v))) {
          headerMapping[idx] = key;
          break;
        }
      }
    });

    const dataRows = rows.slice(1);

    // Get current max sequential code number
    const existingClients = await prisma.client.findMany({
      select: { clientCode: true, phones: true }
    });

    let maxSeq = 0;
    const dbPhones = new Set<string>();
    existingClients.forEach(c => {
      if (c.clientCode) {
        const parts = c.clientCode.split('/');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
        else if (c.clientCode.startsWith('DF_CL_')) {
          const oldNum = parseInt(c.clientCode.replace('DF_CL_', ''), 10);
          if (!isNaN(oldNum) && oldNum > maxSeq) maxSeq = oldNum;
        }
      }
      const phones = Array.isArray(c.phones) ? (c.phones as string[]) : [];
      phones.forEach(p => dbPhones.add(p));
    });

    const seenPhones = new Set<string>();
    let imported = 0;
    let needsReview = 0;

    for (const r of dataRows) {
      const obj: Record<string, string> = {};
      r.forEach((val, idx) => {
        const key = headerMapping[idx];
        if (key) obj[key] = val;
      });

      if (!Object.values(obj).some(v => v && v.trim())) {
        continue;
      }

      const issues: string[] = [];
      const type = (obj.type || '').toLowerCase().includes('indiv') ? 'Individual' : 'Business';
      const businessMode = type === 'Individual' ? 'B2C' : 'B2B';
      const name = obj.name?.trim() || 'Imported Client';

      // Validate/normalize phone
      const rawPhone = obj.phone?.trim() || '';
      let phones: string[] = [];
      let phoneDetails: any[] = [];

      if (!rawPhone) {
        issues.push('No phone number provided');
        phones = ['+910000000000'];
        phoneDetails = [formatPhone('+910000000000')];
      } else {
        const norm = normalizePhone(rawPhone, DEFAULT_COUNTRY_ISO2);
        if (!norm.ok) {
          issues.push(`Phone "${rawPhone}" does not match standard numbering plan: ${norm.error}`);
          phones = [rawPhone];
          phoneDetails = [formatPhone(rawPhone)];
        } else if (norm.e164) {
          if (dbPhones.has(norm.e164) || seenPhones.has(norm.e164)) {
            // Duplicate phone - skip per rule
            continue;
          }
          dbPhones.add(norm.e164);
          seenPhones.add(norm.e164);
          phones = [norm.e164];
          phoneDetails = [formatPhone(norm.e164)];
        }
      }

      // Email
      const email = obj.email?.trim() || '';
      const emails: string[] = [];
      if (email) {
        if (!EMAIL_REGEX.test(email)) {
          issues.push(`Email "${email}" does not look like a valid email address`);
        } else {
          emails.push(email);
        }
      }

      // GSTIN
      const gstin = obj.gstin?.trim().toUpperCase() || '';
      let validGstin = '';
      if (gstin) {
        if (!GSTIN_REGEX.test(gstin)) {
          issues.push(`GSTIN "${gstin}" is invalid`);
        } else {
          validGstin = gstin;
        }
      }

      // Country
      const countryObj = findCountry(obj.country) || findCountry(DEFAULT_COUNTRY_ISO2)!;

      // Address
      const addresses = [
        {
          id: `addr-import-${Date.now()}-${imported}`,
          addressLine1: obj.addressLine1?.trim() || '',
          addressLine2: '',
          city: obj.city?.trim() || '',
          state: obj.state?.trim() || '',
          pincode: obj.pincode?.trim() || '',
          country: countryObj.name,
          isBilling: true
        }
      ];

      maxSeq++;
      const clientCode = `DF/C/${businessMode}/${String(maxSeq).padStart(5, '0')}`;
      const hasIssues = issues.length > 0;
      if (hasIssues) needsReview++;

      await prisma.client.create({
        data: {
          clientCode,
          clientType: type,
          businessMode,
          name,
          companyName: type === 'Business' ? name : null,
          contactPerson: type === 'Business' ? obj.contactPerson?.trim() || null : null,
          phones,
          phoneDetails,
          emails,
          addresses,
          country: countryObj.name,
          countryIso2: countryObj.iso2,
          taxId: validGstin || null,
          sourceName: obj.referredBy?.trim() || null,
          pendingValidation: hasIssues,
          validationIssues: issues
        }
      });

      imported++;
    }

    invalidateClientKpiCache();
    try {
      revalidateTag('clients', { expire: 0 });
    } catch {}

    return NextResponse.json({
      result: {
        imported,
        needsReview
      }
    });
  } catch (error: any) {
    console.error('Error committing CSV import:', error);
    return NextResponse.json({ error: error.message || 'Failed to import CSV' }, { status: 500 });
  }
}
