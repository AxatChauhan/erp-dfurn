import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  
  // Update enquiry and overwrite items
  await prisma.enquiryItem.deleteMany({ where: { enquiryId: id } });
  
  const updated = await prisma.enquiry.update({
    where: { id },
    data: {
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
  
  return NextResponse.json({...updated, clientName: updated.client.name});
}
