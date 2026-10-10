import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;

  // Enforce approval workflow
  let finalStatus = body.status;
  if (role !== 'SUPER_ADMIN') {
    // Non-admins can only save as PENDING_APPROVAL or DRAFT
    if (finalStatus === 'APPROVED' || finalStatus === 'REJECTED') {
      finalStatus = 'PENDING_APPROVAL';
    }
  }
  
  await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
  
  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      clientId: body.clientId,
      status: finalStatus,
      totalAmount: body.totalAmount,
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
