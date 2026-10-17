import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        designation: true,
      }
    });

    const salespersons = employees.map(e => ({
      id: e.id,
      name: e.name,
      employeeCode: e.employeeCode,
      role: e.designation,
    }));

    return NextResponse.json({ salespersons });
  } catch (error: any) {
    console.error('Error fetching salespersons:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch salespersons' }, { status: 500 });
  }
}
