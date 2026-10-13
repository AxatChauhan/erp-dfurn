'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  CalendarCheck, 
  Clock, 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Download, 
  RefreshCw, 
  Search, 
  Edit3, 
  X, 
  Save, 
  Check, 
  Flame, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface CellData {
  id?: string;
  status: 'P' | 'A' | 'H';
  checkInTime?: string;
  overtimeHours?: number;
}

interface RegisterRow {
  employee: {
    id: string;
    employeeCode: string;
    name: string;
    phone: string;
    department: string;
    designation: string;
    payType: string;
    baseRate: number;
  };
  days: Record<number, CellData | null>;
  summary: {
    presentDays: number;
    halfDays: number;
    absentDays: number;
    effectivePayDays: number;
    totalOvertimeHours: number;
  };
}

interface RegisterData {
  year: number;
  month: number;
  monthPrefix: string;
  daysInMonth: number;
  employeeCount: number;
  factorySummary: {
    totalPresent: number;
    totalHalf: number;
    totalAbsent: number;
    totalOvertimeHours: number;
  };
  rows: RegisterRow[];
}

export default function AttendanceRegisterPage() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedPayType, setSelectedPayType] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [registerData, setRegisterData] = useState<RegisterData>({
    year: selectedYear,
    month: selectedMonth,
    monthPrefix: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
    daysInMonth: 31,
    employeeCount: 0,
    factorySummary: { totalPresent: 0, totalHalf: 0, totalAbsent: 0, totalOvertimeHours: 0 },
    rows: [],
  });

  // Cell Edit Modal state
  const [editingCell, setEditingCell] = useState<{
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    day: number;
    date: string;
    status: 'P' | 'A' | 'H';
    checkInTime: string;
    overtimeHours: string;
  } | null>(null);

  const [savingCell, setSavingCell] = useState(false);

  // Load Departments
  useEffect(() => {
    fetch('/api/hrm/departments')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDepartments(data);
      })
      .catch(console.error);
  }, []);

  // Fetch Monthly Attendance Register Matrix
  const fetchRegister = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth),
      });
      if (selectedDept !== 'all') params.set('departmentId', selectedDept);
      if (selectedPayType !== 'all') params.set('payType', selectedPayType);

      const res = await fetch(`/api/hrm/monthly-attendance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRegisterData(data);
      }
    } catch (err) {
      console.error('Failed to load register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegister();
  }, [selectedYear, selectedMonth, selectedDept, selectedPayType]);

  // Month Navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Quick 1-click cycle cell: P -> H -> A -> P
  const handleCycleCell = async (row: RegisterRow, day: number, e: React.MouseEvent) => {
    // If shift key or alt key held, open modal instead
    if (e.shiftKey || e.altKey) {
      openCellModal(row, day);
      return;
    }

    const currentCell = row.days[day];
    let nextStatus: 'P' | 'A' | 'H' = 'P';
    if (!currentCell) {
      nextStatus = 'P';
    } else if (currentCell.status === 'P') {
      nextStatus = 'H';
    } else if (currentCell.status === 'H') {
      nextStatus = 'A';
    } else {
      nextStatus = 'P';
    }

    const dateStr = `${registerData.monthPrefix}-${String(day).padStart(2, '0')}`;

    // Optimistically update
    setRegisterData((prev) => {
      const nextRows = prev.rows.map((r) => {
        if (r.employee.id !== row.employee.id) return r;
        const newDays = { ...r.days };
        newDays[day] = {
          ...(newDays[day] || {}),
          status: nextStatus,
          overtimeHours: newDays[day]?.overtimeHours || 0,
        };

        // Recalculate employee summary
        let p = 0, h = 0, a = 0, ot = 0;
        Object.values(newDays).forEach((cd) => {
          if (cd) {
            if (cd.status === 'P') p++;
            else if (cd.status === 'H') h++;
            else if (cd.status === 'A') a++;
            ot += cd.overtimeHours || 0;
          }
        });

        return {
          ...r,
          days: newDays,
          summary: {
            presentDays: p,
            halfDays: h,
            absentDays: a,
            effectivePayDays: p + h * 0.5,
            totalOvertimeHours: Math.round(ot * 10) / 10,
          },
        };
      });

      return { ...prev, rows: nextRows };
    });

    try {
      await fetch('/api/hrm/monthly-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: row.employee.id,
          date: dateStr,
          status: nextStatus,
          overtimeHours: currentCell?.overtimeHours || 0,
        }),
      });
    } catch (err) {
      console.error('Failed to update cell:', err);
      fetchRegister();
    }
  };

  // Open detailed cell editor
  const openCellModal = (row: RegisterRow, day: number) => {
    const current = row.days[day];
    const dateStr = `${registerData.monthPrefix}-${String(day).padStart(2, '0')}`;
    setEditingCell({
      employeeId: row.employee.id,
      employeeName: row.employee.name,
      employeeCode: row.employee.employeeCode,
      day,
      date: dateStr,
      status: current?.status || 'P',
      checkInTime: current?.checkInTime || '',
      overtimeHours: current?.overtimeHours !== undefined ? String(current.overtimeHours) : '0',
    });
  };

  // Save Modal Cell
  const handleSaveModalCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell) return;
    setSavingCell(true);

    try {
      const res = await fetch('/api/hrm/monthly-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: editingCell.employeeId,
          date: editingCell.date,
          status: editingCell.status,
          checkInTime: editingCell.checkInTime || null,
          overtimeHours: parseFloat(editingCell.overtimeHours) || 0,
        }),
      });

      if (res.ok) {
        setEditingCell(null);
        fetchRegister();
      }
    } catch (err) {
      console.error('Failed to save cell:', err);
    } finally {
      setSavingCell(false);
    }
  };

  // CSV Export for Mustard Roll Register
  const handleExportCSV = () => {
    if (!registerData.rows.length) return;

    const headers = [
      'Employee Code',
      'Name',
      'Department',
      'Pay Type',
      'Daily/Monthly Rate',
      ...Array.from({ length: registerData.daysInMonth }, (_, i) => `Day ${i + 1}`),
      'Presents',
      'Half Days',
      'Absents',
      'Pay Days',
      'Total Overtime (Hrs)',
    ];

    const csvRows = [headers.join(',')];

    registerData.rows.forEach((r) => {
      const dayValues = Array.from({ length: registerData.daysInMonth }, (_, i) => {
        const cell = r.days[i + 1];
        if (!cell) return '-';
        return cell.overtimeHours ? `${cell.status}(+${cell.overtimeHours}h)` : cell.status;
      });

      const rowData = [
        `"${r.employee.employeeCode}"`,
        `"${r.employee.name}"`,
        `"${r.employee.department}"`,
        `"${r.employee.payType}"`,
        `"${r.employee.baseRate}"`,
        ...dayValues,
        r.summary.presentDays,
        r.summary.halfDays,
        r.summary.absentDays,
        r.summary.effectivePayDays,
        r.summary.totalOvertimeHours,
      ];
      csvRows.push(rowData.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mustard_Roll_${registerData.monthPrefix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return registerData.rows;

    return registerData.rows.filter(
      (r) =>
        r.employee.name.toLowerCase().includes(q) ||
        r.employee.employeeCode.toLowerCase().includes(q) ||
        r.employee.department.toLowerCase().includes(q) ||
        r.employee.designation.toLowerCase().includes(q)
    );
  }, [registerData.rows, search]);

  const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="w-full max-w-[1720px] mx-auto space-y-6">
      {/* 1. TOP HEADER & HRM TABS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <CalendarCheck size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Factory Mustard Roll Register</h1>
              <p className="text-sm font-medium text-slate-500">
                Monthly employee attendance matrix grid with Present/Absent/Half-day and overtime tracking
              </p>
            </div>
          </div>

          {/* Month / Year Navigator & Export Button */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
              <button
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-2 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="px-4 text-sm font-black text-slate-900 min-w-[140px] text-center select-none">
                {monthName}
              </div>
              <button
                onClick={handleNextMonth}
                title="Next Month"
                className="p-2 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="h-12 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Download size={16} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={fetchRegister}
              title="Refresh Register"
              className="h-12 w-12 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto">
          <Link
            href="/hrm/employees"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <Users size={16} />
            <span>Employee Directory</span>
          </Link>
          <Link
            href="/hrm/attendance"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <Clock size={16} />
            <span>Daily Shop-Floor Board</span>
          </Link>
          <Link
            href="/hrm/attendance-register"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
          >
            <CalendarCheck size={16} />
            <span>Mustard Roll Matrix</span>
          </Link>
        </div>
      </div>

      {/* 2. FACTORY MONTHLY SUMMARY METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Total Present Days (P)</div>
            <div className="text-3xl font-black text-emerald-700 mt-1">{registerData.factorySummary.totalPresent}</div>
            <div className="text-xs font-medium text-emerald-600/80 mt-0.5">Full shift attendances</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
            P
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">Total Half Days (H)</div>
            <div className="text-3xl font-black text-amber-700 mt-1">{registerData.factorySummary.totalHalf}</div>
            <div className="text-xs font-medium text-amber-600/80 mt-0.5">0.5 wage credit each</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
            H
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-rose-600">Total Absent Days (A)</div>
            <div className="text-3xl font-black text-rose-700 mt-1">{registerData.factorySummary.totalAbsent}</div>
            <div className="text-xs font-medium text-rose-600/80 mt-0.5">Recorded absences</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black">
            A
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">Factory Overtime Hours</div>
            <div className="text-3xl font-black text-indigo-700 mt-1">
              {registerData.factorySummary.totalOvertimeHours} <span className="text-sm font-semibold">hrs</span>
            </div>
            <div className="text-xs font-medium text-indigo-600/80 mt-0.5">Combined worker overtime</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <Flame size={22} />
          </div>
        </div>
      </div>

      {/* 3. FILTERS & SEARCH (CHUNKY 48PX) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search employee by name, code HR-0001, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>

        <div className="w-full md:w-56 shrink-0">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-48 shrink-0">
          <select
            value={selectedPayType}
            onChange={(e) => setSelectedPayType(e.target.value)}
            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
          >
            <option value="all">All Pay Types</option>
            <option value="Daily">Daily Wage</option>
            <option value="Monthly">Monthly Salary</option>
          </select>
        </div>
      </div>

      {/* INSTRUCTION PILL */}
      <div className="px-4 py-2 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-center justify-between text-xs font-semibold text-indigo-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-600" />
          <span>
            <strong>Shop-floor Tip:</strong> Click any cell to cycle status (<strong>P</strong> → <strong>H</strong> → <strong>A</strong>). Hold <strong>Shift</strong> or <strong>Alt</strong> while clicking to edit exact Check-in Time & Overtime hours.
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <span className="w-3 h-3 rounded bg-emerald-600 text-white flex items-center justify-center text-[9px]">P</span> Present
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700">
            <span className="w-3 h-3 rounded bg-amber-500 text-white flex items-center justify-center text-[9px]">H</span> Half Day
          </span>
          <span className="inline-flex items-center gap-1 text-rose-700">
            <span className="w-3 h-3 rounded bg-rose-600 text-white flex items-center justify-center text-[9px]">A</span> Absent
          </span>
        </div>
      </div>

      {/* 4. MUSTARD ROLL MATRIX GRID (WIDE FOV max-w-[1720px]) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && registerData.rows.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Loading Mustard Roll matrix...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-sm font-semibold">
            No employees found for the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto select-none">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  {/* Sticky Employee Info Headers */}
                  <th className="py-3 px-3 sticky left-0 bg-slate-100 z-10 w-24">Code</th>
                  <th className="py-3 px-4 sticky left-24 bg-slate-100 z-10 w-52 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    Employee Name
                  </th>

                  {/* Day Headers 1..N */}
                  {Array.from({ length: registerData.daysInMonth }, (_, i) => {
                    const dayNum = i + 1;
                    const dateObj = new Date(selectedYear, selectedMonth - 1, dayNum);
                    const isSunday = dateObj.getDay() === 0;
                    return (
                      <th
                        key={dayNum}
                        className={`py-2 px-1 text-center w-10 min-w-[36px] border-l border-slate-200 ${
                          isSunday ? 'bg-slate-200/60 text-slate-500 font-black' : ''
                        }`}
                      >
                        <div className="text-[11px] font-mono leading-none">{dayNum}</div>
                        <div className="text-[9px] font-normal text-slate-400 mt-0.5 leading-none">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dateObj.getDay()]}
                        </div>
                      </th>
                    );
                  })}

                  {/* Summary Headers */}
                  <th className="py-3 px-2 text-center border-l-2 border-slate-300 bg-emerald-50 text-emerald-900 w-12 font-black">
                    P
                  </th>
                  <th className="py-3 px-2 text-center border-l border-slate-200 bg-amber-50 text-amber-900 w-12 font-black">
                    H
                  </th>
                  <th className="py-3 px-2 text-center border-l border-slate-200 bg-rose-50 text-rose-900 w-12 font-black">
                    A
                  </th>
                  <th className="py-3 px-2 text-center border-l border-slate-200 bg-indigo-50 text-indigo-900 w-14 font-black">
                    OT(h)
                  </th>
                  <th className="py-3 px-3 text-center border-l border-slate-200 bg-slate-200 text-slate-900 w-16 font-black">
                    Pay Days
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.employee.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Sticky Code */}
                    <td className="py-2.5 px-3 sticky left-0 bg-white hover:bg-slate-50 z-10 font-mono text-xs font-black text-indigo-700">
                      {row.employee.employeeCode}
                    </td>

                    {/* Sticky Name & Role */}
                    <td className="py-2.5 px-4 sticky left-24 bg-white hover:bg-slate-50 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="font-bold text-slate-900 text-xs truncate max-w-[190px]">
                        {row.employee.name}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400 truncate max-w-[190px]">
                        {row.employee.department} • {row.employee.designation}
                      </div>
                    </td>

                    {/* Day Cells 1..N */}
                    {Array.from({ length: registerData.daysInMonth }, (_, i) => {
                      const dayNum = i + 1;
                      const cell = row.days[dayNum];
                      const dateObj = new Date(selectedYear, selectedMonth - 1, dayNum);
                      const isSunday = dateObj.getDay() === 0;

                      return (
                        <td
                          key={dayNum}
                          onClick={(e) => handleCycleCell(row, dayNum, e)}
                          title={`${row.employee.name} - Day ${dayNum}: ${
                            cell ? `${cell.status}${cell.overtimeHours ? ` (+${cell.overtimeHours}h OT)` : ''}` : 'Unmarked'
                          } (Click to toggle, Shift+Click to edit)`}
                          className={`p-1 text-center border-l border-slate-100 cursor-pointer transition-all ${
                            isSunday ? 'bg-slate-50/70' : ''
                          } hover:bg-indigo-50`}
                        >
                          {cell ? (
                            <div className="flex flex-col items-center justify-center">
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black font-mono transition-transform hover:scale-110 shadow-xs ${
                                  cell.status === 'P'
                                    ? 'bg-emerald-600 text-white'
                                    : cell.status === 'H'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-rose-600 text-white'
                                }`}
                              >
                                {cell.status}
                              </span>
                              {cell.overtimeHours && cell.overtimeHours > 0 ? (
                                <span className="text-[8px] font-black text-indigo-700 font-mono mt-0.5 leading-none">
                                  +{cell.overtimeHours}h
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] text-slate-300 hover:bg-slate-200">
                              -
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Summary Columns */}
                    <td className="py-2.5 px-2 text-center border-l-2 border-slate-200 bg-emerald-50/50 font-mono font-bold text-xs text-emerald-800">
                      {row.summary.presentDays}
                    </td>
                    <td className="py-2.5 px-2 text-center border-l border-slate-100 bg-amber-50/50 font-mono font-bold text-xs text-amber-800">
                      {row.summary.halfDays}
                    </td>
                    <td className="py-2.5 px-2 text-center border-l border-slate-100 bg-rose-50/50 font-mono font-bold text-xs text-rose-800">
                      {row.summary.absentDays}
                    </td>
                    <td className="py-2.5 px-2 text-center border-l border-slate-100 bg-indigo-50/50 font-mono font-bold text-xs text-indigo-800">
                      {row.summary.totalOvertimeHours > 0 ? `${row.summary.totalOvertimeHours}h` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center border-l border-slate-200 bg-slate-100 font-mono font-black text-xs text-slate-900">
                      {row.summary.effectivePayDays}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. CELL DETAIL EDITOR MODAL (FOR DETAILED OT AND CHECK-IN TIME) */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Edit Attendance Record</h3>
                <p className="text-xs font-semibold text-slate-500">
                  {editingCell.employeeName} ({editingCell.employeeCode}) • Day {editingCell.day}
                </p>
              </div>
              <button
                onClick={() => setEditingCell(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveModalCell} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Attendance Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['P', 'H', 'A'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditingCell({ ...editingCell, status: st })}
                      className={`h-12 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        editingCell.status === st
                          ? st === 'P'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : st === 'H'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{st === 'P' ? 'Present (P)' : st === 'H' ? 'Half Day (H)' : 'Absent (A)'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Overtime Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  placeholder="e.g. 2.0"
                  value={editingCell.overtimeHours}
                  onChange={(e) => setEditingCell({ ...editingCell, overtimeHours: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Check-in Time (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 09:15 AM"
                  value={editingCell.checkInTime}
                  onChange={(e) => setEditingCell({ ...editingCell, checkInTime: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="h-11 px-5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCell}
                  className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2"
                >
                  {savingCell ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
