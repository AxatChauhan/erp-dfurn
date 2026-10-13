import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatPhone, normalizePhone, GSTIN_REGEX, EMAIL_REGEX, Address } from '@/lib/phone';
import { findCountry, DEFAULT_COUNTRY_ISO2 } from '@/lib/countries';

const BUSINESS_MODES = ['B2B', 'B2B2C', 'B2C'] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        enquiries: {
          select: { id: true, enquiryNumber: true, status: true, estimatedBudget: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        },
        quotations: {
          select: { id: true, quotationNumber: true, status: true, totalAmount: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        },
        jobOrders: {
          select: { id: true, jobNumber: true, status: true, grandTotal: true, orderDate: true },
          orderBy: { orderDate: 'desc' }
        }
      }
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const rawPhones = Array.isArray(client.phones) ? (client.phones as string[]) : [];
    const phoneDetails = rawPhones.map(p => formatPhone(p, client.countryIso2 || 'IN'));

    return NextResponse.json({
      ...client,
      phones: rawPhones,
      phoneDetails,
      emails: Array.isArray(client.emails) ? client.emails : [],
      addresses: Array.isArray(client.addresses) ? client.addresses : [],
      validationIssues: Array.isArray(client.validationIssues) ? client.validationIssues : []
    });
  } catch (error: any) {
    console.error('Error fetching client by id:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(req, params);
}

async function handleUpdate(
  req: NextRequest,
  paramsPromise: Promise<{ id: string }>
) {
  try {
    const { id } = await paramsPromise;
    const body = await req.json();

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const type = body.type || (body.clientType ? (body.clientType === 'Individual' ? 'Individual' : 'Business') : existing.clientType);
    const countryObj = findCountry(body.countryIso2 || existing.countryIso2) || findCountry(DEFAULT_COUNTRY_ISO2)!;

    const companyName = body.companyName !== undefined ? String(body.companyName).trim() : (existing.companyName || '');
    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    const contactPerson = body.contactPerson !== undefined ? String(body.contactPerson).trim() : (existing.contactPerson || '');

    if (type === 'Business' && !companyName) {
      return NextResponse.json({ error: 'Company Name is required for a Business client' }, { status: 400 });
    }
    if (type === 'Individual' && !name) {
      return NextResponse.json({ error: 'Name is required for an Individual client' }, { status: 400 });
    }

    // Phone normalization
    let normalizedPhones = existing.phones ? (existing.phones as string[]) : [];
    let phoneDetails = existing.phoneDetails ? (existing.phoneDetails as any[]) : [];

    if (body.phones !== undefined) {
      const rawPhones = Array.isArray(body.phones) ? body.phones : (body.phones ? [body.phones] : []);
      if (!rawPhones.length) {
        return NextResponse.json({ error: 'At least one phone number is required' }, { status: 400 });
      }

      normalizedPhones = [];
      phoneDetails = [];

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
    }

    // Email validation
    let emails = existing.emails ? (existing.emails as string[]) : [];
    if (body.emails !== undefined) {
      const rawEmails = Array.isArray(body.emails) ? body.emails : [];
      emails = rawEmails.map((e: string) => String(e || '').trim()).filter(Boolean);
      for (const e of emails) {
        if (!EMAIL_REGEX.test(e)) {
          return NextResponse.json({ error: `"${e}" does not look like a valid email address` }, { status: 400 });
        }
      }
    }

    // GSTIN validation
    let gstin = body.gstin !== undefined ? String(body.gstin).trim().toUpperCase() : (existing.taxId || '');
    if (gstin && !GSTIN_REGEX.test(gstin)) {
      return NextResponse.json({ error: `"${gstin}" is not a valid 15-character Indian GSTIN` }, { status: 400 });
    }

    // Addresses
    let addresses = existing.addresses ? (existing.addresses as any[]) : [];
    if (body.addresses !== undefined) {
      const rawAddresses = Array.isArray(body.addresses) ? body.addresses : [];
      addresses = rawAddresses.map((a: any, i: number) => ({
        id: a.id || `addr-${Date.now()}-${i}`,
        addressLine1: String(a.addressLine1 || a.street || '').trim(),
        addressLine2: String(a.addressLine2 || '').trim(),
        city: String(a.city || '').trim(),
        state: String(a.state || '').trim(),
        pincode: String(a.pincode || a.zip || '').trim(),
        country: String(a.country || countryObj.name).trim(),
        isBilling: a.isBilling ?? (i === 0)
      }));
    }

    // Business mode: changing mode DOES NOT change clientCode (code keeps mode it was created with)
    const businessMode = body.businessMode !== undefined && BUSINESS_MODES.includes(body.businessMode)
      ? body.businessMode
      : existing.businessMode;

    const displayName = type === 'Business' ? companyName : name;

    const updated = await prisma.client.update({
      where: { id },
      data: {
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
        sourceCategoryId: body.sourceCategoryId !== undefined ? body.sourceCategoryId || null : existing.sourceCategoryId,
        sourceName: body.sourceName !== undefined ? String(body.sourceName).trim() || null : existing.sourceName,
        taxId: gstin || null,
        // Clears pending review when successfully updated
        pendingValidation: false,
        validationIssues: []
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: error.message || 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check transactions
    const [jobsCount, quotesCount, enqsCount] = await Promise.all([
      prisma.jobOrder.count({ where: { clientId: id } }),
      prisma.quotation.count({ where: { clientId: id } }),
      prisma.enquiry.count({ where: { clientId: id } })
    ]);

    const held: string[] = [];
    if (jobsCount > 0) held.push(`${jobsCount} job order${jobsCount === 1 ? '' : 's'}`);
    if (quotesCount > 0) held.push(`${quotesCount} quotation${quotesCount === 1 ? '' : 's'}`);
    if (enqsCount > 0) held.push(`${enqsCount} enquir${enqsCount === 1 ? 'y' : 'ies'}`);

    if (held.length > 0) {
      return NextResponse.json(
        {
          error: `This client has ${held.join(', ')}, so it cannot be deleted. Edit it instead.`
        },
        { status: 409 }
      );
    }

    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Client deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete client' }, { status: 500 });
  }
}
