import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const lostReasons = await prisma.lostReason.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json({ lostReasons });
  } catch (error: any) {
    console.error('Error fetching lost reasons:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch lost reasons' }, { status: 500 });
  }
}
