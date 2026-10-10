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
      email: body.email,
      phone: body.phone,
      clientType: body.clientType || 'COMPANY',
    }
  });
  return NextResponse.json(newClient);
}
