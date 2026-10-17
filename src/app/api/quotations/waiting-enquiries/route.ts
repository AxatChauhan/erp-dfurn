import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Fetch all existing quotations' enquiryIds
    const existingQuotes = await prisma.quotation.findMany({
      where: { enquiryId: { not: null } },
      select: { enquiryId: true }
    });
    const quotedEnquiryIds = new Set(existingQuotes.map(q => q.enquiryId));

    // 2. Fetch all qualified open enquiries
    const enquiries = await prisma.enquiry.findMany({
      where: {
        stage: 'Qualified',
        outcome: 'Open'
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phones: true,
            emails: true,
            clientType: true
          }
        },
        salesperson: {
          select: {
            id: true,
            name: true
          }
        },
        items: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    // 3. Filter out those that already have a quotation
    const waiting = enquiries
      .filter(e => !quotedEnquiryIds.has(e.id))
      .map(e => ({
        id: e.id,
        code: e.enquiryNumber,
        enquiryNumber: e.enquiryNumber,
        clientId: e.clientId,
        clientName: e.client.name,
        salespersonId: e.salespersonId || null,
        salespersonName: e.salesperson?.name || null,
        brief: e.brief || e.notes || '',
        opportunityValue: e.estimatedBudget || 0,
        itemsCount: e.items.length,
        items: e.items,
        updatedAt: e.updatedAt.toISOString(),
        createdAt: e.createdAt.toISOString()
      }));

    return NextResponse.json({ enquiries: waiting });
  } catch (err: any) {
    console.error('Error fetching waiting enquiries:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch waiting enquiries' },
      { status: 500 }
    );
  }
}
