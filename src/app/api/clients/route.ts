import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const _url = new URL(req.url);
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const body = await req.json();
  const newClient = await prisma.client.create({
    data: {
      name: body.name,
      clientType: body.clientType || 'BUSINESS',
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
  return NextResponse.json(newClient);
}
