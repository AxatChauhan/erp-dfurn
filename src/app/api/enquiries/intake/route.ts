import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { findCountry, DEFAULT_COUNTRY_ISO2 } from '@/lib/countries';
import { todayCodeDate } from '@/lib/dates';
import { generateNextClientCode } from '@/app/api/clients/route';

const INTAKE_MAX_PAYLOAD_CHARS = 50000;

async function generateNextEnquiryCode(): Promise<string> {
  const dateStr = todayCodeDate();
  const prefix = `DF_ENQ_${dateStr}_`;

  const latestToday = await prisma.enquiry.findFirst({
    where: { enquiryNumber: { startsWith: prefix } },
    orderBy: { enquiryNumber: 'desc' },
    select: { enquiryNumber: true }
  });

  let nextSeq = 1;
  if (latestToday?.enquiryNumber) {
    const parts = latestToday.enquiryNumber.split('_');
    const lastPart = parts[parts.length - 1];
    const parsed = parseInt(lastPart, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channel = String(body.channel || '').trim();
    const externalId = String(body.externalId || '').trim();

    const errors: string[] = [];
    if (!channel) errors.push('Channel is required (for example IndiaMART)');
    if (!externalId) errors.push('External id is required, so a retry cannot make a second enquiry');
    if (channel.length > 60 || externalId.length > 200) errors.push('Channel or external id is too long');

    const rawPayload = body.payload !== undefined ? body.payload : null;
    if (rawPayload !== null && JSON.stringify(rawPayload).length > INTAKE_MAX_PAYLOAD_CHARS) {
      errors.push('The raw payload is too large to keep');
    }

    if (!body.clientId) {
      if (!body.clientName || !body.clientName.trim()) errors.push('Client name is required');
      if (!body.clientPhone || !body.clientPhone.trim()) errors.push('Client phone is required');
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    const originKey = `${channel.toLowerCase()}:${externalId.toLowerCase()}`;

    // 1. Idempotency Check: lookup by originKey
    const existing = await prisma.enquiry.findUnique({
      where: { originKey },
      include: { client: true, category: true, salesperson: true, items: true }
    });

    if (existing) {
      return NextResponse.json({
        enquiry: {
          ...existing,
          code: existing.enquiryNumber,
          clientName: existing.client?.name || '',
          clientCode: existing.client?.clientCode || null,
        },
        client: existing.client,
        existing: true
      }, { status: 200 });
    }

    // 2. Resolve or create client
    let client: any = null;
    const isoCountry = body.clientCountry ? body.clientCountry.toUpperCase() : DEFAULT_COUNTRY_ISO2;
    let normalizedPhone: string | null = null;
    let phoneDetail: any = null;

    if (body.clientId) {
      client = await prisma.client.findUnique({ where: { id: body.clientId } });
      if (!client) {
        return NextResponse.json({ error: 'Selected client not found' }, { status: 400 });
      }
    } else {
      const phoneRes = normalizePhone(body.clientPhone, isoCountry);
      if (!phoneRes.ok || !phoneRes.e164) {
        return NextResponse.json({ error: phoneRes.error || 'Invalid phone number' }, { status: 400 });
      }
      normalizedPhone = phoneRes.e164;
      phoneDetail = {
        e164: phoneRes.e164,
        dial: phoneRes.dial || '+91',
        number: phoneRes.number || '',
        iso2: phoneRes.iso2 || isoCountry,
        valid: true,
        kind: 'Mobile'
      };

      // Dedup by phone
      const allActiveClients = await prisma.client.findMany({
        where: { isActive: true },
        select: { id: true, name: true, clientCode: true, phones: true, phoneDetails: true, emails: true, clientType: true }
      });

      const matchedClient = allActiveClients.find(c => {
        if (Array.isArray(c.phones)) {
          return (c.phones as string[]).includes(normalizedPhone!);
        }
        return false;
      });

      if (matchedClient) {
        client = matchedClient;
      } else {
        const nextCode = await generateNextClientCode('B2C');
        const countryObj = findCountry(isoCountry) || findCountry(DEFAULT_COUNTRY_ISO2);

        client = await prisma.client.create({
          data: {
            clientCode: nextCode || null,
            clientType: 'Individual',
            businessMode: 'B2C',
            name: body.clientName.trim(),
            phones: [normalizedPhone],
            phoneDetails: phoneDetail ? [phoneDetail] : [],
            emails: body.clientEmail && body.clientEmail.trim() ? [body.clientEmail.trim()] : [],
            country: countryObj ? countryObj.name : 'India',
            countryIso2: isoCountry,
          }
        });
      }
    }

    // Match channel to source category if not provided
    let sourceCategoryId = body.sourceCategoryId || null;
    if (!sourceCategoryId) {
      const want = String(body.sourceCategory || channel).trim().toLowerCase();
      const allSourceCats = await prisma.sourceCategory.findMany();
      const hit = allSourceCats.find(s => s.name.trim().toLowerCase() === want);
      sourceCategoryId = hit ? hit.id : null;
    }

    let salesperson = null;
    if (body.salespersonId) {
      salesperson = await prisma.employee.findUnique({ where: { id: body.salespersonId } });
    }

    const receivedAt = body.receivedAt && !isNaN(Date.parse(body.receivedAt))
      ? new Date(body.receivedAt).toISOString()
      : new Date().toISOString();

    const enquiryNumber = await generateNextEnquiryCode();

    const created = await prisma.enquiry.create({
      data: {
        enquiryNumber,
        clientId: client.id,
        categoryId: body.categoryId || null,
        sourceCategoryId,
        sourceName: body.sourceName ? body.sourceName.trim() : null,
        salespersonId: salesperson ? salesperson.id : null,
        salespersonName: salesperson ? salesperson.name : null,
        brief: body.brief ? body.brief.trim() : '',
        origin: {
          channel,
          externalId,
          receivedAt,
          payload: rawPayload
        },
        originKey,
        stage: 'New',
        outcome: 'Open',
        status: 'NEW',
        hasCommunication: false,
        history: [],
        stageDates: {},
        opportunityValue: null,
      },
      include: {
        client: true,
        category: true,
        salesperson: true,
        items: true,
      }
    });

    return NextResponse.json({
      enquiry: {
        ...created,
        code: created.enquiryNumber,
        clientName: client.name,
        clientCode: client.clientCode,
      },
      client,
      existing: false
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/enquiries/intake:', error);
    return NextResponse.json({ error: error.message || 'Failed to intake enquiry' }, { status: 500 });
  }
}
