import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const _url = new URL(req.url);
  const enquiries = await prisma.enquiry.findMany({
    include: { items: true, client: true },
    orderBy: { createdAt: 'desc' }
  });
  
  // Transform to match frontend expectations
  const formatted = enquiries.map(e => ({
    ...e,
    clientName: e.client.name
  }));
  
  return NextResponse.json(formatted);
}

export async function POST(req: Request) {
  const body = await req.json();
  const newEnquiry = await prisma.enquiry.create({
    data: {
      enquiryNumber: body.enquiryNumber || `ENQ-${Math.floor(Math.random() * 10000)}`,
      clientId: body.clientId,
      rating: body.rating,
      notes: body.notes,
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
  return NextResponse.json({...newEnquiry, clientName: newEnquiry.client.name});
}
