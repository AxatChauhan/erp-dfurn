import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeGstin, formatClientCode, normalizePhoneNumber } from '@/lib/clientUtils';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const type = url.searchParams.get('type');

    // Fetch clients
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Check if any clients are missing clientCode and backfill them sequentially
    const clientsWithoutCode = clients.filter(c => !c.clientCode);
    if (clientsWithoutCode.length > 0) {
      // Find highest existing sequence
      let maxSeq = 0;
      clients.forEach(c => {
        if (c.clientCode && c.clientCode.startsWith('DF_CL_')) {
          const num = parseInt(c.clientCode.replace('DF_CL_', ''), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });

      // Update clients in background / sequential
      for (const client of clientsWithoutCode) {
        maxSeq++;
        const newCode = formatClientCode(maxSeq);
        await prisma.client.update({
          where: { id: client.id },
          data: { clientCode: newCode }
        });
        client.clientCode = newCode;
      }
    }

    return NextResponse.json(clients);
  } catch (error: any) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Client / Company Name is required' }, { status: 400 });
    }

    // 1. Phone number normalization & duplicate detection
    const rawPhones: string[] = Array.isArray(body.phones) ? body.phones : (body.phones ? [body.phones] : []);
    const normalizedPhones = rawPhones.map(p => normalizePhoneNumber(p)).filter(Boolean);

    if (normalizedPhones.length > 0 && !body.ignoreDuplicatePhone) {
      // Find if any client has any of these phones
      const allClients = await prisma.client.findMany({
        select: { id: true, name: true, clientCode: true, phones: true }
      });

      for (const existing of allClients) {
        const existingPhones = Array.isArray(existing.phones) ? (existing.phones as string[]).map(p => normalizePhoneNumber(p)) : [];
        const conflict = normalizedPhones.find(p => existingPhones.includes(p));
        if (conflict) {
          return NextResponse.json({
            error: `Phone number ${conflict} is already registered to existing client "${existing.name}" (${existing.clientCode || 'ID: ' + existing.id})`,
            duplicateClientId: existing.id,
            duplicateClientName: existing.name,
            duplicateClientCode: existing.clientCode,
            conflictPhone: conflict
          }, { status: 409 });
        }
      }
    }

    // 2. Determine Next Sequential Client Code
    let nextCode = body.clientCode;
    if (!nextCode) {
      const allClientsWithCode = await prisma.client.findMany({
        where: { clientCode: { not: null } },
        select: { clientCode: true }
      });

      let maxSeq = 0;
      allClientsWithCode.forEach(c => {
        if (c.clientCode && c.clientCode.startsWith('DF_CL_')) {
          const num = parseInt(c.clientCode.replace('DF_CL_', ''), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
      nextCode = formatClientCode(maxSeq + 1);
    }

    // 3. GSTIN & PAN Intelligence
    let pan = body.pan;
    let state = body.state;
    if (body.taxId) {
      const gstinAnalysis = analyzeGstin(body.taxId);
      if (gstinAnalysis.pan && !pan) pan = gstinAnalysis.pan;
      if (gstinAnalysis.stateName && !state) state = gstinAnalysis.stateName;
    }

    // 4. Create Client
    const newClient = await prisma.client.create({
      data: {
        clientCode: nextCode,
        name: body.name.trim(),
        clientType: body.clientType || 'BUSINESS',
        contactPerson: body.contactPerson?.trim() || null,
        emails: body.emails || [],
        phones: body.phones || [],
        addresses: body.addresses || [],
        sourceCategory: body.sourceCategory || null,
        sourceName: body.sourceName || null,
        taxId: body.taxId?.trim().toUpperCase() || null,
        pan: pan?.trim().toUpperCase() || null,
        state: state?.trim() || null,
        country: body.country?.trim() || 'IN',
        paymentTerms: body.paymentTerms?.trim() || null,
        creditLimit: body.creditLimit ? parseFloat(body.creditLimit) : 0,
        outstandingBalance: body.outstandingBalance ? parseFloat(body.outstandingBalance) : 0,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true
      }
    });

    return NextResponse.json(newClient, { status: 201 });
  } catch (error: any) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: error.message || 'Failed to create client' }, { status: 500 });
  }
}
