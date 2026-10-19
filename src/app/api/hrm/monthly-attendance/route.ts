import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: Manager or Admin access required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const now = new Date();
    
    let year = parseInt(url.searchParams.get('year') || String(now.getFullYear()), 10);
    let month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1), 10);
    const departmentId = url.searchParams.get('departmentId');
    const payType = url.searchParams.get('payType');

    if (isNaN(year) || year < 2000 || year > 2100) year = now.getFullYear();
    if (isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1;

    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month, 0).getDate();

    const whereEmployee: any = { isActive: true };
    if (departmentId && departmentId !== 'all') {
      whereEmployee.departmentId = departmentId;
    }
    if (payType && payType !== 'all') {
      whereEmployee.payType = payType;
    }

    const employees = await prisma.employee.findMany({
      where: whereEmployee,
      include: {
        department: true,
      },
      orderBy: { employeeCode: 'asc' },
    });

    // Get all monthly attendance records for this month
    const monthlyRecords = await prisma.monthlyAttendance.findMany({
      where: {
        date: {
          startsWith: monthPrefix,
        },
      },
    });

    // Map by employeeId and date
    const recordMap = new Map<string, Map<string, any>>();
    monthlyRecords.forEach((rec) => {
      if (!recordMap.has(rec.employeeId)) {
        recordMap.set(rec.employeeId, new Map());
      }
      recordMap.get(rec.employeeId)!.set(rec.date, rec);
    });

    let totalFactoryPresent = 0;
    let totalFactoryHalf = 0;
    let totalFactoryAbsent = 0;
    let totalFactoryOvertime = 0;

    const rows = employees.map((emp) => {
      const empRecords = recordMap.get(emp.id) || new Map();
      const days: Record<number, any> = {};

      let presentCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;
      let totalOvertimeHours = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
        const record = empRecords.get(dateStr);

        if (record) {
          const status = record.status || 'P';
          const overtime = record.overtimeHours || 0;
          days[d] = {
            id: record.id,
            status,
            checkInTime: record.checkInTime || '',
            overtimeHours: overtime,
          };

          if (status === 'P') presentCount++;
          else if (status === 'H') halfDayCount++;
          else if (status === 'A') absentCount++;

          totalOvertimeHours += overtime;
        } else {
          // No record exists yet for this day
          days[d] = null;
        }
      }

      totalFactoryPresent += presentCount;
      totalFactoryHalf += halfDayCount;
      totalFactoryAbsent += absentCount;
      totalFactoryOvertime += totalOvertimeHours;

      return {
        employee: {
          id: emp.id,
          employeeCode: emp.employeeCode,
          name: emp.name,
          phone: emp.phone,
          department: emp.department?.name || 'Unassigned',
          designation: emp.designation,
          payType: emp.payType,
          baseRate: emp.baseRate,
        },
        days,
        summary: {
          presentDays: presentCount,
          halfDays: halfDayCount,
          absentDays: absentCount,
          effectivePayDays: presentCount + halfDayCount * 0.5,
          totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
        },
      };
    });

    return NextResponse.json({
      year,
      month,
      monthPrefix,
      daysInMonth,
      employeeCount: rows.length,
      factorySummary: {
        totalPresent: totalFactoryPresent,
        totalHalf: totalFactoryHalf,
        totalAbsent: totalFactoryAbsent,
        totalOvertimeHours: Math.round(totalFactoryOvertime * 10) / 10,
      },
      rows,
    });
  } catch (error: any) {
    console.error('Error fetching mustard roll register:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch register' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: Manager or Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { employeeId, date, status, checkInTime, overtimeHours } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Valid date (YYYY-MM-DD) is required' }, { status: 400 });
    }

    const validStatus = status && ['P', 'A', 'H'].includes(status) ? status : undefined;
    const parsedOvertime = overtimeHours !== undefined ? Math.max(0, parseFloat(overtimeHours) || 0) : undefined;

    const upserted = await prisma.monthlyAttendance.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date,
        },
      },
      update: {
        ...(validStatus ? { status: validStatus } : {}),
        ...(checkInTime !== undefined ? { checkInTime: checkInTime || null } : {}),
        ...(parsedOvertime !== undefined ? { overtimeHours: parsedOvertime } : {}),
      },
      create: {
        employeeId,
        date,
        status: validStatus || 'P',
        checkInTime: checkInTime || null,
        overtimeHours: parsedOvertime !== undefined ? parsedOvertime : 0.0,
      },
    });

    return NextResponse.json({
      message: 'Attendance entry updated successfully',
      entry: upserted,
    });
  } catch (error: any) {
    console.error('Error updating monthly attendance cell:', error);
    return NextResponse.json({ error: error.message || 'Failed to update attendance cell' }, { status: 500 });
  }
}
