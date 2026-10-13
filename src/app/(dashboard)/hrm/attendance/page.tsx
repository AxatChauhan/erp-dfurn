'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Calendar, 
  ArrowRight, 
  Search, 
  RefreshCw, 
  CalendarCheck,
  Building2,
  Phone,
  Flame,
  ShieldCheck,
  Check
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string | null;
}

interface Punch {
  id: string;
  employeeId: string;
  date: string;
  type: string;
  occurredAt: string;
  source: string;
}

interface EmployeePunchData {
  id: string;
  employeeCode: string;
  name: string;
  phone: string;
  designation: string;
  payType: string;
  baseRate: number;
  department?: Department;
  firstInPunch?: Punch | null;
  lastPunch?: Punch | null;
  punchCount: number;
  punches: Punch[];
}

interface AttendanceBoardData {
  date: string;
  totalActive: number;
  counts: {
    notCheckedIn: number;
    onGoing: number;
    checkedOut: number;
    presentTotal: number;
  };
  buckets: {
    notCheckedIn: EmployeePunchData[];
    onGoing: EmployeePunchData[];
    checkedOut: EmployeePunchData[];
  };
}

export default function AttendanceBoardPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [punchingId, setPunchingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [boardData, setBoardData] = useState<AttendanceBoardData>({
    date: selectedDate,
    totalActive: 0,
    counts: { notCheckedIn: 0, onGoing: 0, checkedOut: 0, presentTotal: 0 },
    buckets: { notCheckedIn: [], onGoing: [], checkedOut: [] },
  });

  // Live Factory Digital Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Departments
  useEffect(() => {
    fetch('/api/hrm/departments')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDepartments(data);
      })
      .catch(console.error);
  }, []);

  // Fetch Board Data
  const fetchBoard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedDept !== 'all') params.set('departmentId', selectedDept);

      const res = await fetch(`/api/hrm/attendance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBoardData(data);
      }
    } catch (err) {
      console.error('Failed to load attendance board:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, [selectedDate, selectedDept]);

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Execute Punch (In or Out)
  const handlePunch = async (employeeId: string, employeeName: string, type: 'In' | 'Out') => {
    setPunchingId(employeeId);
    try {
      const res = await fetch('/api/hrm/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          type,
          date: selectedDate,
          occurredAt: new Date().toISOString(),
          source: 'UI',
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || `Failed to punch ${type}`);
      }

      setToastMessage({
        text: `✓ ${employeeName} punched ${type.toUpperCase()} at ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
        type: 'success',
      });

      fetchBoard();
    } catch (err: any) {
      setToastMessage({
        text: err.message || 'Error executing punch',
        type: 'error',
      });
    } finally {
      setPunchingId(null);
    }
  };

  // Filter buckets by search query
  const filteredBuckets = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return boardData.buckets;

    const filterList = (list: EmployeePunchData[]) =>
      list.filter(
        (emp) =>
          emp.name.toLowerCase().includes(q) ||
          emp.employeeCode.toLowerCase().includes(q) ||
          emp.designation.toLowerCase().includes(q) ||
          emp.phone.toLowerCase().includes(q)
      );

    return {
      notCheckedIn: filterList(boardData.buckets.notCheckedIn),
      onGoing: filterList(boardData.buckets.onGoing),
      checkedOut: filterList(boardData.buckets.checkedOut),
    };
  }, [boardData.buckets, search]);

  const formatPunchTime = (occurredAtStr?: string) => {
    if (!occurredAtStr) return '--:--';
    const d = new Date(occurredAtStr);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto space-y-6">
      {/* 1. TOP HEADER & HRM TABS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Clock size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Daily Shop-Floor Attendance</h1>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-sm font-medium text-slate-500">
                Live 3-bucket floor control board for supervisor punch-in & punch-out
              </p>
            </div>
          </div>

          {/* Live Clock & Date Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Clock Badge */}
            <div className="h-12 px-5 bg-slate-900 text-white rounded-xl flex items-center gap-3 shadow-inner font-mono">
              <Clock size={18} className="text-emerald-400 animate-pulse" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">Live Factory Time</div>
                <div className="text-base font-black tracking-wider text-emerald-300 leading-tight">{currentTime || '00:00:00'}</div>
              </div>
            </div>

            {/* Date Selector */}
            <div className="flex items-center h-12 px-3 bg-slate-50 border border-slate-200 rounded-xl">
              <Calendar size={18} className="text-slate-400 mr-2" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={fetchBoard}
              title="Refresh Floor Board"
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
          >
            <Clock size={16} />
            <span>Daily Shop-Floor Board</span>
          </Link>
          <Link
            href="/hrm/attendance-register"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <CalendarCheck size={16} />
            <span>Mustard Roll Matrix</span>
          </Link>
        </div>
      </div>

      {/* TOAST ALERT */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 2. ERGONOMIC SHOP-FLOOR SUMMARY METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Roster */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Shift Roster</div>
            <div className="text-3xl font-black text-slate-900 mt-1">{boardData.totalActive}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">Active personnel</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Users size={22} />
          </div>
        </div>

        {/* Working On Floor */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Working on Floor</span>
            </div>
            <div className="text-3xl font-black text-emerald-700 mt-1">{boardData.counts.onGoing}</div>
            <div className="text-xs font-medium text-emerald-600/80 mt-0.5">Punched IN right now</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Flame size={22} />
          </div>
        </div>

        {/* Checked Out */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">Shift Completed</div>
            <div className="text-3xl font-black text-blue-700 mt-1">{boardData.counts.checkedOut}</div>
            <div className="text-xs font-medium text-blue-600/80 mt-0.5">Punched OUT for day</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Not Checked In */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-rose-600">Not Checked In</div>
            <div className="text-3xl font-black text-rose-700 mt-1">{boardData.counts.notCheckedIn}</div>
            <div className="text-xs font-medium text-rose-600/80 mt-0.5">Yet to arrive</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* 3. FILTERS BAR (CHUNKY 48PX INPUTS) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search worker by name, HR-0001 code, or designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>

        <div className="w-full md:w-64 shrink-0">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
          >
            <option value="all">All Shop Floor Sections</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. THREE-BUCKET SHOP-FLOOR ATTENDANCE BOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* BUCKET 1: NOT CHECKED IN */}
        <div className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden flex flex-col">
          {/* Bucket Header */}
          <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                {filteredBuckets.notCheckedIn.length}
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-rose-950">1. Not Checked In</h2>
                <p className="text-[11px] font-medium text-rose-700">Yet to report for {selectedDate}</p>
              </div>
            </div>
          </div>

          {/* Card List */}
          <div className="p-3 space-y-3 max-h-[700px] overflow-y-auto">
            {filteredBuckets.notCheckedIn.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                No workers pending check-in.
              </div>
            ) : (
              filteredBuckets.notCheckedIn.map((emp) => (
                <div
                  key={emp.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all shadow-xs flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {emp.employeeCode}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                          {emp.payType}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mt-1">{emp.name}</h3>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        {emp.designation} • {emp.department?.name || 'Shop Floor'}
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Punch IN Button */}
                  <button
                    onClick={() => handlePunch(emp.id, emp.name, 'In')}
                    disabled={punchingId === emp.id}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {punchingId === emp.id ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <LogIn size={18} />
                    )}
                    <span>PUNCH IN (ARRIVED)</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* BUCKET 2: ON-GOING / WORKING */}
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs overflow-hidden flex flex-col">
          {/* Bucket Header */}
          <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs animate-pulse">
                {filteredBuckets.onGoing.length}
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-emerald-950">
                  2. On-Going / Working
                </h2>
                <p className="text-[11px] font-medium text-emerald-700">Currently active on factory floor</p>
              </div>
            </div>
          </div>

          {/* Card List */}
          <div className="p-3 space-y-3 max-h-[700px] overflow-y-auto">
            {filteredBuckets.onGoing.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                No active workers on the floor currently.
              </div>
            ) : (
              filteredBuckets.onGoing.map((emp) => (
                <div
                  key={emp.id}
                  className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/10 hover:border-emerald-300 transition-all shadow-xs flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {emp.employeeCode}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                          On Floor
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mt-1">{emp.name}</h3>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        {emp.designation} • {emp.department?.name || 'Shop Floor'}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Punched IN</div>
                      <div className="text-sm font-black font-mono text-emerald-700">
                        {formatPunchTime(emp.lastPunch?.occurredAt)}
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Punch OUT Button */}
                  <button
                    onClick={() => handlePunch(emp.id, emp.name, 'Out')}
                    disabled={punchingId === emp.id}
                    className="w-full h-12 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {punchingId === emp.id ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <LogOut size={18} />
                    )}
                    <span>PUNCH OUT (LEAVE FLOOR)</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* BUCKET 3: CHECKED OUT */}
        <div className="bg-white rounded-2xl border border-blue-200 shadow-xs overflow-hidden flex flex-col">
          {/* Bucket Header */}
          <div className="p-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                {filteredBuckets.checkedOut.length}
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-blue-950">3. Checked Out</h2>
                <p className="text-[11px] font-medium text-blue-700">Shift concluded for the day</p>
              </div>
            </div>
          </div>

          {/* Card List */}
          <div className="p-3 space-y-3 max-h-[700px] overflow-y-auto">
            {filteredBuckets.checkedOut.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                No workers checked out yet today.
              </div>
            ) : (
              filteredBuckets.checkedOut.map((emp) => (
                <div
                  key={emp.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-xs flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {emp.employeeCode}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          Completed
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mt-1">{emp.name}</h3>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        {emp.designation} • {emp.department?.name || 'Shop Floor'}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Punched OUT</div>
                      <div className="text-sm font-black font-mono text-blue-700">
                        {formatPunchTime(emp.lastPunch?.occurredAt)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div>Punches today: <span className="font-bold font-mono text-slate-800">{emp.punchCount}</span></div>
                    <button
                      onClick={() => handlePunch(emp.id, emp.name, 'In')}
                      disabled={punchingId === emp.id}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Punch In Again (Overtime)</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
