import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_DEPARTMENTS = [
  { name: 'Carpentry', code: 'DEP-CARP' },
  { name: 'Edge Banding', code: 'DEP-EDGE' },
  { name: 'Finishing & Polish', code: 'DEP-POL' },
  { name: 'Assembly', code: 'DEP-ASSM' },
  { name: 'Metal Fabrication', code: 'DEP-FAB' },
  { name: 'Office & Sales', code: 'DEP-OFFC' },
];

export async function GET() {
  try {
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

    return NextResponse.json(departments);
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch departments' }, { status: 500 });
  }
}
