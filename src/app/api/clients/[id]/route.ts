import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  
  const updated = await prisma.client.update({
    where: { id },
    data: {
      name: body.name,
      clientType: body.clientType,
      contactPerson: body.contactPerson,
      emails: body.emails,
      phones: body.phones,
      addresses: body.addresses,
      sourceCategory: body.sourceCategory,
      sourceName: body.sourceName,
      taxId: body.taxId,
      paymentTerms: body.paymentTerms,
      creditLimit: body.creditLimit ? parseFloat(body.creditLimit) : 0
    }
  });
  return NextResponse.json(updated);
}
