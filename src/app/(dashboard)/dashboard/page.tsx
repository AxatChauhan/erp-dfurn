import Link from 'next/link';
import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  TrendingUp, 
  FileText, 
  Users, 
  Briefcase, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Building2,
  CalendarCheck
} from 'lucide-react';

export default async function DashboardPage() {
  await connection();

  // Parallel fetch counts for live dashboard overview
  const [
    clientCount,
    enquiryCount,
    openEnquiryCount,
    quotationCount,
    approvedQuotationCount,
    employeeCount
  ] = await Promise.all([
    prisma.client.count().catch(() => 0),
    prisma.enquiry.count().catch(() => 0),
    prisma.enquiry.count({ where: { outcome: 'Open' } }).catch(() => 0),
    prisma.quotation.count().catch(() => 0),
    prisma.quotation.count({ where: { status: 'APPROVED' } }).catch(() => 0),
    prisma.employee.count().catch(() => 0)
  ]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* WELCOME BANNER */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
            Operations Overview
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-2">
            Welcome to d&apos;furn ERP
          </h2>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Manufacturing operations, sales pipelines, and factory floor activity in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            System Live
          </div>
        </div>
      </div>

      {/* METRIC KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Enquiries Card */}
        <Link 
          href="/enquiries"
          className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:border-orange-300 hover:shadow-md transition-all group cursor-pointer block"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-bold text-gray-400 group-hover:text-orange-600 flex items-center gap-1 transition-colors">
              View <ArrowRight size={13} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-gray-900 tracking-tight">{enquiryCount}</div>
            <div className="text-xs font-semibold text-gray-600 mt-0.5">Total Enquiries</div>
            <div className="text-[11px] text-orange-600 font-bold mt-2 flex items-center gap-1">
              <Clock size={12} /> {openEnquiryCount} Active Open Leads
            </div>
          </div>
        </Link>

        {/* Quotations Card */}
        <Link 
          href="/quotations"
          className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:border-orange-300 hover:shadow-md transition-all group cursor-pointer block"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <FileText size={20} />
            </div>
            <span className="text-xs font-bold text-gray-400 group-hover:text-amber-600 flex items-center gap-1 transition-colors">
              View <ArrowRight size={13} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-gray-900 tracking-tight">{quotationCount}</div>
            <div className="text-xs font-semibold text-gray-600 mt-0.5">Quotations Generated</div>
            <div className="text-[11px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
              <CheckCircle2 size={12} /> {approvedQuotationCount} Approved Estimates
            </div>
          </div>
        </Link>

        {/* Clients Card */}
        <Link 
          href="/clients"
          className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:border-orange-300 hover:shadow-md transition-all group cursor-pointer block"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building2 size={20} />
            </div>
            <span className="text-xs font-bold text-gray-400 group-hover:text-blue-600 flex items-center gap-1 transition-colors">
              View <ArrowRight size={13} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-gray-900 tracking-tight">{clientCount}</div>
            <div className="text-xs font-semibold text-gray-600 mt-0.5">Client Accounts</div>
            <div className="text-[11px] text-blue-600 font-bold mt-2">
              B2B, B2B2C & Retail Directory
            </div>
          </div>
        </Link>

        {/* Factory / HRM Card */}
        <Link 
          href="/hrm/attendance"
          className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all group cursor-pointer block"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Briefcase size={20} />
            </div>
            <span className="text-xs font-bold text-gray-400 group-hover:text-indigo-600 flex items-center gap-1 transition-colors">
              View <ArrowRight size={13} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-gray-900 tracking-tight">{employeeCount}</div>
            <div className="text-xs font-semibold text-gray-600 mt-0.5">Workforce Employees</div>
            <div className="text-[11px] text-indigo-600 font-bold mt-2 flex items-center gap-1">
              <CalendarCheck size={12} /> Live Factory Attendance
            </div>
          </div>
        </Link>
      </div>

      {/* QUICK MODULE ACCESS TILES */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200/80 shadow-xs">
        <h3 className="text-base font-bold text-gray-900 tracking-tight mb-4">
          Quick Workspaces
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/enquiries"
            className="p-4 rounded-xl border border-gray-200 hover:border-orange-500 hover:bg-orange-50/30 transition-all flex items-start gap-3.5 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <TrendingUp size={18} />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 group-hover:text-orange-600 transition-colors">
                Enquiries Pipeline
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Intake leads, log follow-ups, qualify requirements, and track conversion stages.
              </div>
            </div>
          </Link>

          <Link
            href="/quotations"
            className="p-4 rounded-xl border border-gray-200 hover:border-orange-500 hover:bg-orange-50/30 transition-all flex items-start gap-3.5 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 group-hover:text-orange-600 transition-colors">
                Quotations & Estimates
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Generate multi-tier pricing, revision versioning, approval workflows, and PDF downloads.
              </div>
            </div>
          </Link>

          <Link
            href="/clients"
            className="p-4 rounded-xl border border-gray-200 hover:border-orange-500 hover:bg-orange-50/30 transition-all flex items-start gap-3.5 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 group-hover:text-orange-600 transition-colors">
                Clients Directory
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Manage architectural partners, B2B contractors, direct clients, GSTIN, and credit limits.
              </div>
            </div>
          </Link>

          <Link
            href="/hrm/attendance"
            className="p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all flex items-start gap-3.5 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <CalendarCheck size={18} />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors">
                Shop-Floor Attendance
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                3-bucket real-time board: Not Checked In, On-Going, and Checked Out with 1-click punch.
              </div>
            </div>
          </Link>

          <Link
            href="/hrm/attendance-register"
            className="p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all flex items-start gap-3.5 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Briefcase size={18} />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors">
                Muster Roll Register
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Monthly factory attendance matrix grid with overtime calculation and wage summaries.
              </div>
            </div>
          </Link>

          <Link
            href="/hrm/employees"
            className="p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all flex items-start gap-3.5 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors">
                Employees Master
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Staff directories, department assignments, daily wages, bank details, and Aadhaar records.
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
