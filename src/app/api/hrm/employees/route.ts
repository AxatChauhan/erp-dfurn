import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: Manager or Admin access required' }, { status: 403 });
    }
    const isSuperAdmin = session.role === 'SUPER_ADMIN';

    const url = new URL(req.url);
    const search = url.searchParams.get('search')?.trim() || '';
    const departmentId = url.searchParams.get('departmentId');
    const payType = url.searchParams.get('payType');
    const status = url.searchParams.get('status'); // 'active', 'inactive', 'all'

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId && departmentId !== 'all') {
      where.departmentId = departmentId;
    }

    if (payType && payType !== 'all') {
      where.payType = payType;
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        department: true,
      },
      orderBy: {
        employeeCode: 'asc',
      },
    });

    // PII Protection: Mask sensitive identity and banking data for non-Super Admin callers
    const safeEmployees = employees.map(emp => {
      if (isSuperAdmin) return emp;
      return {
        ...emp,
        aadhaarNumber: emp.aadhaarNumber ? `•••• •••• ${emp.aadhaarNumber.slice(-4)}` : null,
        panNumber: emp.panNumber ? `••••••${emp.panNumber.slice(-4)}` : null,
        accountNumber: emp.accountNumber ? `••••••••${emp.accountNumber.slice(-4)}` : null,
        bankName: emp.bankName ? '••••' : null,
        ifscCode: null,
        baseRate: null,
      };
    });

    return NextResponse.json(safeEmployees);
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: Manager or Admin access required' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Employee name is required' }, { status: 400 });
    }
    if (!body.phone || !body.phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }
    if (!body.departmentId) {
      return NextResponse.json({ error: 'Department is required' }, { status: 400 });
    }
    if (!body.designation || !body.designation.trim()) {
      return NextResponse.json({ error: 'Designation is required' }, { status: 400 });
    }

    // Determine sequential code HR-0001, HR-0002...
    let employeeCode = body.employeeCode?.trim();
    if (!employeeCode) {
      const allEmployees = await prisma.employee.findMany({
        select: { employeeCode: true },
      });

      let maxSeq = 0;
      allEmployees.forEach((emp) => {
        if (emp.employeeCode && emp.employeeCode.startsWith('HR-')) {
          const num = parseInt(emp.employeeCode.replace('HR-', ''), 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      });

      const nextNum = maxSeq + 1;
      employeeCode = `HR-${String(nextNum).padStart(4, '0')}`;
    }

    // Verify department exists
    const dept = await prisma.department.findUnique({
      where: { id: body.departmentId },
    });
    if (!dept) {
      return NextResponse.json({ error: 'Selected department does not exist' }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        name: body.name.trim(),
        phone: body.phone.trim(),
        personalEmail: body.personalEmail?.trim() || null,
        gender: body.gender || 'Male',
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        dateOfJoining: body.dateOfJoining ? new Date(body.dateOfJoining) : new Date(),
        departmentId: body.departmentId,
        designation: body.designation.trim(),
        employmentType: body.employmentType || 'Permanent',
        payType: body.payType || 'Daily',
        baseRate: body.baseRate !== undefined && body.baseRate !== null ? parseFloat(body.baseRate) : 0,
        aadhaarNumber: body.aadhaarNumber?.trim() || null,
        panNumber: body.panNumber?.trim()?.toUpperCase() || null,
        bankName: body.bankName?.trim() || null,
        accountNumber: body.accountNumber?.trim() || null,
        ifscCode: body.ifscCode?.trim()?.toUpperCase() || null,
        emergencyContactName: body.emergencyContactName?.trim() || null,
        emergencyContactPhone: body.emergencyContactPhone?.trim() || null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
      include: {
        department: true,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error('Error creating employee:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'An employee with this code already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Failed to create employee' }, { status: 500 });
  }
}
