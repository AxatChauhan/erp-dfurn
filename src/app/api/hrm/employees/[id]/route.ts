import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        punches: {
          orderBy: { occurredAt: 'desc' },
          take: 30,
        },
        monthlyEntries: {
          orderBy: { date: 'desc' },
          take: 31,
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error: any) {
    console.error('Error fetching employee:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch employee' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.employee.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.phone !== undefined) updateData.phone = body.phone.trim();
    if (body.personalEmail !== undefined) updateData.personalEmail = body.personalEmail?.trim() || null;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.dateOfBirth !== undefined) updateData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    if (body.dateOfJoining !== undefined) updateData.dateOfJoining = body.dateOfJoining ? new Date(body.dateOfJoining) : existing.dateOfJoining;
    if (body.departmentId !== undefined) updateData.departmentId = body.departmentId;
    if (body.designation !== undefined) updateData.designation = body.designation.trim();
    if (body.employmentType !== undefined) updateData.employmentType = body.employmentType;
    if (body.payType !== undefined) updateData.payType = body.payType;
    if (body.baseRate !== undefined) updateData.baseRate = parseFloat(body.baseRate) || 0;
    if (body.aadhaarNumber !== undefined) updateData.aadhaarNumber = body.aadhaarNumber?.trim() || null;
    if (body.panNumber !== undefined) updateData.panNumber = body.panNumber?.trim()?.toUpperCase() || null;
    if (body.bankName !== undefined) updateData.bankName = body.bankName?.trim() || null;
    if (body.accountNumber !== undefined) updateData.accountNumber = body.accountNumber?.trim() || null;
    if (body.ifscCode !== undefined) updateData.ifscCode = body.ifscCode?.trim()?.toUpperCase() || null;
    if (body.emergencyContactName !== undefined) updateData.emergencyContactName = body.emergencyContactName?.trim() || null;
    if (body.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = body.emergencyContactPhone?.trim() || null;
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    const updated = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: error.message || 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const hard = url.searchParams.get('hard') === 'true';

    const existing = await prisma.employee.findUnique({
      where: { id },
      include: {
        _count: {
          select: { punches: true, monthlyEntries: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (hard || (existing._count.punches === 0 && existing._count.monthlyEntries === 0)) {
      await prisma.employee.delete({
        where: { id },
      });
      return NextResponse.json({ message: 'Employee deleted permanently', id });
    } else {
      const updated = await prisma.employee.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: 'Employee deactivated', employee: updated });
    }
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete employee' }, { status: 500 });
  }
}
