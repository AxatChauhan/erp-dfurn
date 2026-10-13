import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatPhone, normalizePhone, isIndia, GSTIN_REGEX, EMAIL_REGEX, Address } from '@/lib/phone';
import { findCountry, DEFAULT_COUNTRY_ISO2 } from '@/lib/countries';

const BUSINESS_MODES = ['B2B', 'B2B2C', 'B2C'] as const;
type BusinessMode = (typeof BUSINESS_MODES)[number];

function defaultMode(type: string): BusinessMode {
  return type === 'Individual' ? 'B2C' : 'B2B';
}

function modeOf(mode?: string | null, type?: string | null): BusinessMode {
  if (mode && BUSINESS_MODES.includes(mode as BusinessMode)) {
    return mode as BusinessMode;
  }
  return defaultMode(type || 'Business');
}

/**
 * Sequential client code generation: DF/C/<mode>/00001
 * Uses single counter across all modes so sequence numbers are globally unique.
 */
async function generateNextClientCode(mode: BusinessMode): Promise<string> {
  const clients = await prisma.client.findMany({
    where: { clientCode: { not: null } },
    select: { clientCode: true }
  });

  let maxSeq = 0;
  clients.forEach(c => {
    if (!c.clientCode) return;
    // Check new pattern DF/C/<mode>/00001
    if (c.clientCode.startsWith('DF/C/')) {
      const parts = c.clientCode.split('/');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
    // Check old pattern DF_CL_000001
    else if (c.clientCode.startsWith('DF_CL_')) {
      const num = parseInt(c.clientCode.replace('DF_CL_', ''), 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  });

  const nextSeq = maxSeq + 1;
  return `DF/C/${mode}/${String(nextSeq).padStart(5, '0')}`;
}

// Seed default source categories if none exist
async function ensureSourceCategories() {
  const count = await prisma.sourceCategory.count();
  if (count === 0) {
    const defaults = ['Direct', 'Architect/Designer', 'Social Media', 'Website', 'Referral'];
    for (const name of defaults) {
      await prisma.sourceCategory.upsert({
        where: { name },
        update: {},
        create: { name }
      });
    }
  }
  return prisma.sourceCategory.findMany({ orderBy: { name: 'asc' } });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get('type');
    const filterCountry = searchParams.get('country');
    const filterReview = searchParams.get('needsReview') === 'true';

    const sourceCategories = await ensureSourceCategories();

    // Fetch all clients to compute KPIs & filter
    const allClients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { jobOrders: true, quotations: true, enquiries: true }
        },
        jobOrders: {
          select: { grandTotal: true, exchangeRate: true, status: true, orderDate: true }
        }
      }
    });

    // Map computed fields
    const enrichedClients = allClients.map(c => {
      const rawPhones = Array.isArray(c.phones) ? (c.phones as string[]) : [];
      const storedPhoneDetails = Array.isArray(c.phoneDetails) ? (c.phoneDetails as any[]) : [];
      
      const phoneDetails = rawPhones.map((p, idx) => {
        if (storedPhoneDetails[idx]) return storedPhoneDetails[idx];
        return formatPhone(p, c.countryIso2 || 'IN');
      });

      const addresses = Array.isArray(c.addresses) ? (c.addresses as unknown as Address[]) : [];
      const emails = Array.isArray(c.emails) ? (c.emails as string[]) : [];
      const issues = Array.isArray(c.validationIssues) ? (c.validationIssues as string[]) : [];

      // Calculate order rollups
      const liveOrders = c.jobOrders.filter(j => j.status !== 'Cancelled');
      const totalJobOrders = liveOrders.length;
      const totalOrderValue = Math.round(
        liveOrders.reduce((sum, j) => sum + (j.grandTotal || 0) * (j.exchangeRate || 1), 0)
      );

      const dates = liveOrders.map(j => j.orderDate).filter(Boolean).sort();
      const lastOrderDate = dates.length ? dates[dates.length - 1] : null;

      const clientType = c.clientType === 'Individual' ? 'Individual' : 'Business';
      const displayName = clientType === 'Business' ? (c.companyName || c.name) : c.name;

      return {
        id: c.id,
        code: c.clientCode || '',
        clientCode: c.clientCode || '',
        type: clientType,
        clientType,
        businessMode: c.businessMode || defaultMode(clientType),
        displayName,
        name: displayName,
        companyName: c.companyName || (clientType === 'Business' ? c.name : ''),
        contactPerson: c.contactPerson || '',
        phones: rawPhones,
        phoneDetails,
        emails,
        addresses,
        countryIso2: c.countryIso2 || 'IN',
        country: c.country || 'India',
        sourceCategoryId: c.sourceCategoryId || null,
        sourceCategory: c.sourceCategory || '',
        sourceName: c.sourceName || '',
        gstin: c.taxId || '',
        taxId: c.taxId || '',
        pendingValidation: c.pendingValidation || false,
        validationIssues: issues,
        totalJobOrders,
        totalOrderValue,
        lastOrderDate,
        enquiryCount: c._count.enquiries,
        quoteCount: c._count.quotations,
        jobOrderCount: c._count.jobOrders,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString()
      };
    });

    // Compute KPI insights strip matching Photo 1
    const total = enrichedClients.length;
    const business = enrichedClients.filter(c => c.type === 'Business').length;
    const individual = enrichedClients.filter(c => c.type === 'Individual').length;
    const withGstin = enrichedClients.filter(c => c.gstin && c.gstin.trim()).length;

    // Top source category
    const sourceCounts: Record<string, number> = {};
    enrichedClients.forEach(c => {
      if (c.sourceCategoryId) {
        sourceCounts[c.sourceCategoryId] = (sourceCounts[c.sourceCategoryId] || 0) + 1;
      }
    });

    let topSourceId: string | null = null;
    let topSourceCount = 0;
    Object.entries(sourceCounts).forEach(([catId, count]) => {
      if (count > topSourceCount) {
        topSourceCount = count;
        topSourceId = catId;
      }
    });

    const topSourceObj = sourceCategories.find(s => s.id === topSourceId);

    const kpis = {
      total,
      business,
      individual,
      withGstin,
      gstinPct: total ? Math.round((withGstin / total) * 100) : 0,
      topSourceName: topSourceObj ? topSourceObj.name : '–',
      topSourceCount
    };

    // Apply filtering
    let filtered = enrichedClients;
    if (filterType && filterType !== 'ALL') {
      filtered = filtered.filter(c => c.type.toLowerCase() === filterType.toLowerCase());
    }
    if (filterCountry) {
      filtered = filtered.filter(c => c.country.toLowerCase() === filterCountry.toLowerCase());
    }
    if (filterReview) {
      filtered = filtered.filter(c => c.pendingValidation);
    }

    return NextResponse.json({
      clients: filtered,
      allClients: enrichedClients,
      sourceCategories,
      kpis
    });
  } catch (error: any) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const type = body.type === 'Individual' ? 'Individual' : 'Business';
    const businessMode = modeOf(body.businessMode, type);

    const companyName = String(body.companyName || '').trim();
    const name = String(body.name || '').trim();
    const contactPerson = String(body.contactPerson || '').trim();

    // Required fields check matching docs/client.md
    if (type === 'Business' && !companyName) {
      return NextResponse.json({ error: 'Company Name is required for a Business client' }, { status: 400 });
    }
    if (type === 'Individual' && !name) {
      return NextResponse.json({ error: 'Name is required for an Individual client' }, { status: 400 });
    }

    const countryObj = findCountry(body.countryIso2) || findCountry(DEFAULT_COUNTRY_ISO2)!;

    // Normalize phones
    const rawPhones = Array.isArray(body.phones) ? body.phones : (body.phones ? [body.phones] : []);
    if (!rawPhones.length) {
      return NextResponse.json({ error: 'At least one phone number is required' }, { status: 400 });
    }

    const normalizedPhones: string[] = [];
    const phoneDetails: any[] = [];

    for (const p of rawPhones) {
      const norm = normalizePhone(p, countryObj.iso2);
      if (!norm.ok && norm.error) {
        return NextResponse.json({ error: norm.error }, { status: 400 });
      }
      if (norm.e164 && !normalizedPhones.includes(norm.e164)) {
        normalizedPhones.push(norm.e164);
        phoneDetails.push(formatPhone(norm.e164, countryObj.iso2));
      }
    }

    if (!normalizedPhones.length) {
      return NextResponse.json({ error: 'At least one valid phone number is required' }, { status: 400 });
    }

    // Duplicate check on phone numbers
    const existingClients = await prisma.client.findMany({
      select: { id: true, name: true, clientCode: true, phones: true }
    });

    for (const ex of existingClients) {
      const exPhones = Array.isArray(ex.phones) ? (ex.phones as string[]) : [];
      const conflict = normalizedPhones.find(np => exPhones.includes(np));
      if (conflict) {
        return NextResponse.json(
          {
            error: `Phone number ${conflict} is already registered to existing client "${ex.name}" (${ex.clientCode || 'ID: ' + ex.id})`
          },
          { status: 409 }
        );
      }
    }

    // Validate emails
    const rawEmails = Array.isArray(body.emails) ? body.emails : [];
    const emails = rawEmails.map((e: string) => String(e || '').trim()).filter(Boolean);
    for (const e of emails) {
      if (!EMAIL_REGEX.test(e)) {
        return NextResponse.json({ error: `"${e}" does not look like a valid email address` }, { status: 400 });
      }
    }

    // Validate GSTIN if India
    const gstin = String(body.gstin || body.taxId || '').trim().toUpperCase();
    if (gstin && !GSTIN_REGEX.test(gstin)) {
      return NextResponse.json({ error: `"${gstin}" is not a valid 15-character Indian GSTIN` }, { status: 400 });
    }

    // Addresses
    const rawAddresses = Array.isArray(body.addresses) ? body.addresses : [];
    const addresses = rawAddresses.map((a: any, i: number) => ({
      id: a.id || `addr-${Date.now()}-${i}`,
      addressLine1: String(a.addressLine1 || a.street || '').trim(),
      addressLine2: String(a.addressLine2 || '').trim(),
      city: String(a.city || '').trim(),
      state: String(a.state || '').trim(),
      pincode: String(a.pincode || a.zip || '').trim(),
      country: String(a.country || countryObj.name).trim(),
      isBilling: a.isBilling ?? (i === 0)
    }));

    // Generate code
    const clientCode = await generateNextClientCode(businessMode);
    const displayName = type === 'Business' ? companyName : name;

    const newClient = await prisma.client.create({
      data: {
        clientCode,
        clientType: type,
        businessMode,
        name: displayName,
        companyName: type === 'Business' ? companyName : null,
        contactPerson: type === 'Business' ? contactPerson || null : null,
        phones: normalizedPhones,
        phoneDetails,
        emails,
        addresses,
        country: countryObj.name,
        countryIso2: countryObj.iso2,
        sourceCategoryId: body.sourceCategoryId || null,
        sourceName: String(body.sourceName || '').trim() || null,
        taxId: gstin || null,
        pendingValidation: false,
        validationIssues: []
      }
    });

    return NextResponse.json(newClient, { status: 201 });
  } catch (error: any) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create client' },
      { status: 500 }
    );
  }
}
