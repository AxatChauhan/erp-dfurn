import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;

  const whereClause = role === 'SUPER_ADMIN' ? {} : { status: { not: 'REJECTED' } };

  const quotations = await prisma.quotation.findMany({
    where: whereClause,
    include: { items: true, client: true },
    orderBy: { createdAt: 'desc' }
  });
  
  const formatted = quotations.map(q => ({
    ...q,
    clientName: q.client.name
  }));
  return NextResponse.json(formatted);
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  
  const body = await req.json();
  
  // Enforce approval workflow
  let finalStatus = body.status || 'DRAFT';
  if (role !== 'SUPER_ADMIN') {
    if (finalStatus === 'APPROVED' || finalStatus === 'REJECTED') {
      finalStatus = 'PENDING_APPROVAL';
    }
  } else if (finalStatus === 'PENDING_APPROVAL') {
    finalStatus = 'APPROVED';
  }

  const newQuotation = await prisma.quotation.create({
    data: {
      quotationNumber: body.quotationNumber || `QT-${Math.floor(Math.random() * 10000)}`,
      clientId: body.clientId,
      enquiryId: body.enquiryId || null,
      status: finalStatus,
      totalAmount: body.totalAmount || body.items.reduce((acc: number, item: any) => acc + (item.quantity * item.unitPrice), 0),
      items: {
        create: body.items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total
        }))
      }
    },
    include: { items: true, client: true }
  });
  return NextResponse.json({...newQuotation, clientName: newQuotation.client.name});
}
