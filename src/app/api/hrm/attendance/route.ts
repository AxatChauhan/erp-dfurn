import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';

// Helper to get today's date formatted as YYYY-MM-DD in local time
function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format time as "hh:mm A"
function formatTimeString(d: Date = new Date()): string {
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: Manager or Admin access required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const date = url.searchParams.get('date') || getLocalDateString();
    const departmentId = url.searchParams.get('departmentId');

    const whereEmployee: any = { isActive: true };
    if (departmentId && departmentId !== 'all') {
      whereEmployee.departmentId = departmentId;
    }

    const employees = await prisma.employee.findMany({
      where: whereEmployee,
      include: {
        department: true,
        punches: {
          where: { date },
          orderBy: { occurredAt: 'asc' },
        },
        monthlyEntries: {
          where: { date },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });

    const notCheckedIn: any[] = [];
    const onGoing: any[] = [];
    const checkedOut: any[] = [];

    employees.forEach((emp) => {
      const punches = emp.punches || [];
      const firstIn = punches.find((p) => p.type === 'In');
      const lastPunch = punches[punches.length - 1];
      const monthlyEntry = emp.monthlyEntries?.[0];

      const empData = {
        ...emp,
        firstInPunch: firstIn,
        lastPunch,
        punchCount: punches.length,
        punches,
        monthlyEntry,
      };

      if (punches.length === 0) {
        notCheckedIn.push(empData);
      } else if (lastPunch.type === 'In') {
        onGoing.push(empData);
      } else {
        checkedOut.push(empData);
      }
    });

    return NextResponse.json({
      date,
      totalActive: employees.length,
      counts: {
        notCheckedIn: notCheckedIn.length,
        onGoing: onGoing.length,
        checkedOut: checkedOut.length,
        presentTotal: onGoing.length + checkedOut.length,
      },
      buckets: {
        notCheckedIn,
        onGoing,
        checkedOut,
      },
    });
  } catch (error: any) {
    console.error('Error fetching attendance board:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch attendance board' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: Manager or Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { employeeId, type, source } = body;
    const date = body.date || getLocalDateString();
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }
    if (!type || !['In', 'Out'].includes(type)) {
      return NextResponse.json({ error: 'Valid punch type ("In" or "Out") is required' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        punches: {
          where: { date },
          orderBy: { occurredAt: 'asc' },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const existingPunches = employee.punches || [];
    const lastPunch = existingPunches[existingPunches.length - 1];

    // Validation: prevent duplicate / illegal transitions
    if (type === 'In') {
      if (lastPunch && lastPunch.type === 'In') {
        return NextResponse.json(
          { error: `${employee.name} is already punched IN today at ${formatTimeString(new Date(lastPunch.occurredAt))}. Punch OUT first.` },
          { status: 400 }
        );
      }
    } else if (type === 'Out') {
      if (!lastPunch || lastPunch.type === 'Out') {
        return NextResponse.json(
          { error: `${employee.name} is not currently punched IN. Cannot punch OUT.` },
          { status: 400 }
        );
      }
    }

    // Create the punch
    const punch = await prisma.attendancePunch.create({
      data: {
        employeeId,
        date,
        type,
        occurredAt,
        source: source || 'UI',
      },
    });

    // Sync with MonthlyAttendance table
    const timeFormatted = formatTimeString(occurredAt);
    const existingMonthly = await prisma.monthlyAttendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date,
        },
      },
    });

    if (!existingMonthly) {
      await prisma.monthlyAttendance.create({
        data: {
          employeeId,
          date,
          status: 'P',
          checkInTime: type === 'In' ? timeFormatted : null,
          overtimeHours: 0.0,
        },
      });
    } else {
      const updatePayload: any = {};
      if (type === 'In' && !existingMonthly.checkInTime) {
        updatePayload.checkInTime = timeFormatted;
        if (existingMonthly.status === 'A') {
          updatePayload.status = 'P';
        }
      }
      if (Object.keys(updatePayload).length > 0) {
        await prisma.monthlyAttendance.update({
          where: { id: existingMonthly.id },
          data: updatePayload,
        });
      }
    }

    return NextResponse.json({
      message: `Punch ${type} recorded successfully for ${employee.name}`,
      punch,
      employeeName: employee.name,
      employeeCode: employee.employeeCode,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error recording punch:', error);
    return NextResponse.json({ error: error.message || 'Failed to record punch' }, { status: 500 });
  }
}
