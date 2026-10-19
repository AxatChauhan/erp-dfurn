import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';

const DEFAULT_DEPARTMENTS = [
  { name: 'Carpentry', code: 'DEP-CARP' },
  { name: 'Edge Banding', code: 'DEP-EDGE' },
  { name: 'Finishing & Polish', code: 'DEP-POL' },
  { name: 'Assembly', code: 'DEP-ASSM' },
  { name: 'Metal Fabrication', code: 'DEP-FAB' },
  { name: 'Office & Sales', code: 'DEP-OFFC' },
];

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: Manager or Admin access required' }, { status: 403 });
    }

    let departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });

    if (departments.length === 0) {
      await prisma.department.createMany({
        data: DEFAULT_DEPARTMENTS,
        skipDuplicates: true,
      });

      departments = await prisma.department.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { employees: true },
          },
        },
      });
    }

    return NextResponse.json(departments, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch departments' }, { status: 500 });
  }
}
