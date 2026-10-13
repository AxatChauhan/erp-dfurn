'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Briefcase, 
  Phone, 
  CreditCard, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Trash2, 
  Clock, 
  CalendarCheck,
  X,
  AlertCircle,
  IndianRupee,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string | null;
  _count?: { employees: number };
}

interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  phone: string;
  personalEmail: string | null;
  gender: string;
  dateOfBirth: string | null;
  dateOfJoining: string;
  departmentId: string;
  department?: Department;
  designation: string;
  employmentType: string;
  payType: string;
  baseRate: number;
  aadhaarNumber: string | null;
  panNumber: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedPayType, setSelectedPayType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('active');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    personalEmail: '',
    gender: 'Male',
    dateOfBirth: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    departmentId: '',
    designation: '',
    employmentType: 'Permanent',
    payType: 'Daily',
    baseRate: '',
    aadhaarNumber: '',
    panNumber: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    isActive: true,
  });

  // Fetch Departments & Employees
  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/hrm/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
        if (data.length > 0 && !formData.departmentId) {
          setFormData((prev) => ({ ...prev, departmentId: data[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedDept !== 'all') params.set('departmentId', selectedDept);
      if (selectedPayType !== 'all') params.set('payType', selectedPayType);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);

      const res = await fetch(`/api/hrm/employees?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [selectedDept, selectedPayType, selectedStatus]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormError('');
    setFormData({
      name: '',
      phone: '',
      personalEmail: '',
      gender: 'Male',
      dateOfBirth: '',
      dateOfJoining: new Date().toISOString().split('T')[0],
      departmentId: departments[0]?.id || '',
      designation: '',
      employmentType: 'Permanent',
      payType: 'Daily',
      baseRate: '',
      aadhaarNumber: '',
      panNumber: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormError('');
    setFormData({
      name: emp.name,
      phone: emp.phone,
      personalEmail: emp.personalEmail || '',
      gender: emp.gender,
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
      dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.split('T')[0] : '',
      departmentId: emp.departmentId,
      designation: emp.designation,
      employmentType: emp.employmentType,
      payType: emp.payType,
      baseRate: emp.baseRate ? String(emp.baseRate) : '',
      aadhaarNumber: emp.aadhaarNumber || '',
      panNumber: emp.panNumber || '',
      bankName: emp.bankName || '',
      accountNumber: emp.accountNumber || '',
      ifscCode: emp.ifscCode || '',
      emergencyContactName: emp.emergencyContactName || '',
      emergencyContactPhone: emp.emergencyContactPhone || '',
      isActive: emp.isActive,
    });
    setIsModalOpen(true);
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      const url = editingEmployee 
        ? `/api/hrm/employees/${editingEmployee.id}` 
        : '/api/hrm/employees';
      
      const method = editingEmployee ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          baseRate: formData.baseRate ? parseFloat(formData.baseRate) : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save employee');
      }

      setIsModalOpen(false);
      fetchEmployees();
      fetchDepartments(); // Update counts
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle active status
  const handleToggleStatus = async (emp: Employee) => {
    const action = emp.isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${emp.name}?`)) return;

    try {
      const res = await fetch(`/api/hrm/employees/${emp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !emp.isActive }),
      });
      if (res.ok) {
        fetchEmployees();
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = employees.length;
    const dailyWage = employees.filter(e => e.payType === 'Daily').length;
    const monthlySalary = employees.filter(e => e.payType === 'Monthly').length;
    const activeCount = employees.filter(e => e.isActive).length;
    return { total, dailyWage, monthlySalary, activeCount };
  }, [employees]);

  return (
    <div className="w-full max-w-[1720px] mx-auto space-y-6">
      {/* 1. TOP HEADER & HRM TABS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Factory Workforce & HRM</h1>
              <p className="text-sm font-medium text-slate-500">
                Manage shop-floor workers, carpentry masters, and payroll designations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreate}
              className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-xl flex items-center gap-2.5 shadow-sm transition-all cursor-pointer"
            >
              <UserPlus size={18} />
              <span>+ New Employee</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto">
          <Link
            href="/hrm/employees"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <CalendarCheck size={16} />
            <span>Mustard Roll Matrix</span>
          </Link>
        </div>
      </div>

      {/* 2. ERGONOMIC KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Workforce</div>
            <div className="text-3xl font-black text-slate-900 mt-1">{metrics.total}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">Enrolled personnel</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Active On-Roll</div>
            <div className="text-3xl font-black text-emerald-700 mt-1">{metrics.activeCount}</div>
            <div className="text-xs font-medium text-emerald-600/80 mt-0.5">Eligible for attendance</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">Daily Wage Workers</div>
            <div className="text-3xl font-black text-amber-700 mt-1">{metrics.dailyWage}</div>
            <div className="text-xs font-medium text-amber-600/80 mt-0.5">Daily rate calculated</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <IndianRupee size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">Monthly Staff</div>
            <div className="text-3xl font-black text-blue-700 mt-1">{metrics.monthlySalary}</div>
            <div className="text-xs font-medium text-blue-600/80 mt-0.5">Fixed payroll personnel</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Building2 size={22} />
          </div>
        </div>
      </div>

      {/* 3. ERGONOMIC SEARCH & FILTER BAR (CHUNKY 48PX INPUTS) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by worker name, HR-0001 code, designation, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Department Filter */}
        <div className="w-full md:w-56 shrink-0">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {/* Pay Type Filter */}
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

        {/* Status Filter */}
        <div className="w-full md:w-40 shrink-0">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
          >
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
            <option value="all">All Records</option>
          </select>
        </div>

        <button
          onClick={fetchEmployees}
          title="Refresh List"
          className="h-12 w-12 shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 4. WORKFORCE DIRECTORY TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && employees.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Loading workforce records...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <Users size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No employees found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
              {search || selectedDept !== 'all' || selectedPayType !== 'all'
                ? 'Try adjusting your search criteria or clearing filters.'
                : 'Get started by enrolling factory employees into the system.'}
            </p>
            <button
              onClick={handleOpenCreate}
              className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl inline-flex items-center gap-2 cursor-pointer"
            >
              <UserPlus size={18} />
              <span>+ Enrol First Employee</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Code</th>
                  <th className="py-3.5 px-5">Employee Name & Role</th>
                  <th className="py-3.5 px-5">Department</th>
                  <th className="py-3.5 px-5">Phone & Contact</th>
                  <th className="py-3.5 px-5">Pay Type & Rate</th>
                  <th className="py-3.5 px-5">Identity / Aadhaar</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Code Badge */}
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black font-mono tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {emp.employeeCode}
                      </span>
                    </td>

                    {/* Name & Designation */}
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900 text-base">{emp.name}</div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <Briefcase size={13} className="text-slate-400" />
                        <span>{emp.designation}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500">{emp.employmentType}</span>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {emp.department?.name || 'Unassigned'}
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="py-4 px-5">
                      <div className="text-sm font-semibold font-mono text-slate-800 flex items-center gap-1.5">
                        <Phone size={14} className="text-slate-400" />
                        <a href={`tel:${emp.phone}`} className="hover:underline hover:text-indigo-600">
                          {emp.phone}
                        </a>
                      </div>
                      {emp.emergencyContactPhone && (
                        <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                          Emergency: {emp.emergencyContactPhone} ({emp.emergencyContactName || 'Family'})
                        </div>
                      )}
                    </td>

                    {/* Pay Type & Rate */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                            emp.payType === 'Daily'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {emp.payType}
                        </span>
                        <span className="text-sm font-black text-slate-900 font-mono">
                          ₹{emp.baseRate.toLocaleString('en-IN')}
                          <span className="text-xs font-normal text-slate-500">
                            /{emp.payType === 'Daily' ? 'day' : 'mo'}
                          </span>
                        </span>
                      </div>
                    </td>

                    {/* Aadhaar / Bank */}
                    <td className="py-4 px-5 text-xs text-slate-600 font-mono">
                      {emp.aadhaarNumber ? (
                        <div className="flex items-center gap-1 text-slate-700">
                          <ShieldCheck size={14} className="text-emerald-600" />
                          <span>{emp.aadhaarNumber}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No Aadhaar</span>
                      )}
                      {emp.bankName && (
                        <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                          {emp.bankName} {emp.accountNumber ? `(…${emp.accountNumber.slice(-4)})` : ''}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-5">
                      {emp.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          title="Edit Details"
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(emp)}
                          title={emp.isActive ? 'Deactivate Worker' : 'Activate Worker'}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            emp.isActive
                              ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {emp.isActive ? <Trash2 size={16} /> : <CheckCircle2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. CREATE / EDIT EMPLOYEE MODAL (ERGONOMIC FACTORY DESIGN) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  {editingEmployee ? <Edit3 size={20} /> : <UserPlus size={20} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {editingEmployee ? `Edit ${editingEmployee.name} (${editingEmployee.employeeCode})` : 'Enrol New Employee'}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Sequential Code will be automatically generated upon enrolment
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm font-semibold">
                  <AlertCircle size={20} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Section 1: Basic Information */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-2">
                  <Users size={14} />
                  <span>1. Worker Identification</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar Patel"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Primary Mobile Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.code ? `(${d.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Designation / Role <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Master Carpenter, Polisher, Helper"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Date of Joining</label>
                    <input
                      type="date"
                      value={formData.dateOfJoining}
                      onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Compensation & Payroll */}
              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-2">
                  <IndianRupee size={14} />
                  <span>2. Factory Compensation & Wage Mode</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Pay Type</label>
                    <select
                      value={formData.payType}
                      onChange={(e) => setFormData({ ...formData, payType: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                    >
                      <option value="Daily">Daily Wage (Per Day ₹)</option>
                      <option value="Monthly">Monthly Fixed Salary (₹)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Base Rate ({formData.payType === 'Daily' ? '₹ Per Day' : '₹ Monthly'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 750 or 22000"
                      value={formData.baseRate}
                      onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Employment Type</label>
                    <select
                      value={formData.employmentType}
                      onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                    >
                      <option value="Permanent">Permanent</option>
                      <option value="Contract">Contract</option>
                      <option value="DailyWage">Daily Wage</option>
                      <option value="Temporary">Temporary</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Identity & Bank */}
              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-2">
                  <ShieldCheck size={14} />
                  <span>3. Identity & Bank Details</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Aadhaar Number</label>
                    <input
                      type="text"
                      placeholder="12 digits e.g. 4567 8901 2345"
                      value={formData.aadhaarNumber}
                      onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. State Bank of India, HDFC"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Bank Account Number</label>
                    <input
                      type="text"
                      placeholder="Account Number"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">IFSC Code</label>
                    <input
                      type="text"
                      placeholder="e.g. SBIN0001234"
                      value={formData.ifscCode}
                      onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Emergency Contact */}
              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-2">
                  <Phone size={14} />
                  <span>4. Emergency Factory Contact</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Contact Person Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Smt. Sunita Patel (Wife)"
                      value={formData.emergencyContactName}
                      onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Emergency Phone</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9811223344"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-5 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-12 px-6 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {formSubmitting && <RefreshCw size={16} className="animate-spin" />}
                  <span>{editingEmployee ? 'Update Details' : 'Confirm & Enrol'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
