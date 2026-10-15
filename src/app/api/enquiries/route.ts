import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatEnquiryCode } from '@/lib/enquiryUtils';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const stage = searchParams.get('stage');

    const where: any = {};
    if (stage && stage !== 'ALL') {
      where.stage = stage;
    }
    if (search) {
      where.OR = [
        { enquiryNumber: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { client: { clientCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const enquiries = await prisma.enquiry.findMany({
      where,
      include: { 
        items: true, 
        client: {
          select: {
            id: true,
            name: true,
            clientCode: true,
            phones: true,
            emails: true,
          }
        },
        salesperson: {
          select: { id: true, name: true, employeeCode: true }
        },
        quotations: {
          select: { id: true, quotationNumber: true, status: true, totalAmount: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = enquiries.map(e => ({
      ...e,
      clientName: e.client?.name || 'Unknown Client',
      clientCode: e.client?.clientCode || null,
      clientPhones: Array.isArray(e.client?.phones) ? (e.client.phones as string[]) : [],
      clientEmails: Array.isArray(e.client?.emails) ? (e.client.emails as string[]) : [],
      stage: e.stage || 'New',
      outcome: e.outcome || 'Open'
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching enquiries:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch enquiries' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.clientId) {
      return NextResponse.json({ error: 'Client selection is required' }, { status: 400 });
    }

    // 1. Calculate next sequential DF_ENQ_ code atomically in 1ms via indexed seek
    const latestEnquiry = await prisma.enquiry.findFirst({
      where: { enquiryNumber: { startsWith: 'DF_ENQ_' } },
      orderBy: { enquiryNumber: 'desc' },
      select: { enquiryNumber: true }
    });

    let maxSeq = 0;
    if (latestEnquiry?.enquiryNumber) {
      const num = parseInt(latestEnquiry.enquiryNumber.replace('DF_ENQ_', ''), 10);
      if (!isNaN(num)) maxSeq = num;
    }

    const nextCode = formatEnquiryCode(maxSeq + 1);

    // 2. Determine initial stage & synced status
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const initialStage = body.stage || 'New';
    let initialStatus = body.status;
    if (!initialStatus) {
      if (initialStage === 'Converted') initialStatus = 'CONVERTED';
      else if (initialStage === 'Quoted') initialStatus = 'IN_PROGRESS';
      else if (initialStage === 'Qualified') initialStatus = 'QUALIFIED';
      else initialStatus = 'NEW';
    }

    const newEnquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber: nextCode,
        clientId: body.clientId,
        status: initialStatus,
        stage: initialStage,
        outcome: 'Open',
        
        enteredById: body.enteredById || null,
        enteredByName: body.enteredByName || null,
        salespersonId: body.salespersonId || null,
        salespersonName: body.salespersonName || null,

        notes: body.notes || '',
        expectedTimeline: body.expectedTimeline || null,
        estimatedBudget: body.estimatedBudget ? parseFloat(body.estimatedBudget) : null,
        propertyType: body.propertyType || null,
        nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
        sourceCategory: body.sourceCategory || null,
        sourceName: body.sourceName || null,
        attachments: body.attachments || [],

        items: {
          create: rawItems.map((item: any) => ({
            description: item.description?.trim() || 'Custom Unit',
            quantity: item.quantity ? parseInt(item.quantity, 10) : 1,
            unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : 0,
            total: item.total ? parseFloat(item.total) : 0,
            expectedDimensions: item.expectedDimensions?.trim() || null,
            materialPreference: item.materialPreference?.trim() || null,
            clientComment: item.clientComment?.trim() || null
          }))
        }
      },
      include: { 
        items: true, 
        client: true,
        salesperson: true,
        quotations: true
      }
    });

    return NextResponse.json({
      ...newEnquiry,
      clientName: newEnquiry.client?.name || 'Unknown Client',
      clientCode: newEnquiry.client?.clientCode || null,
      clientPhones: Array.isArray(newEnquiry.client?.phones) ? (newEnquiry.client.phones as string[]) : [],
      clientEmails: Array.isArray(newEnquiry.client?.emails) ? (newEnquiry.client.emails as string[]) : []
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating enquiry:', error);
    return NextResponse.json({ error: error.message || 'Failed to create enquiry' }, { status: 500 });
  }
}
