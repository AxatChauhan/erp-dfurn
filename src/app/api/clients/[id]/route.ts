import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  
  const updated = await prisma.client.update({
    where: { id },
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
    }
  });
  return NextResponse.json(updated);
}
