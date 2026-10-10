'use client';

import { LayoutDashboard, TrendingUp, ClipboardList, Layers, Package, Shield, ChevronDown, ChevronRight, Armchair } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const [salesOpen, setSalesOpen] = useState(true);

  return (
    <aside className="w-[260px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-20 shadow-sm relative overflow-y-auto">
      {/* BRANDING */}
      <div className="p-6 pb-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-[#ff7f11] text-white flex items-center justify-center shadow-sm ring-2 ring-[#ff7f11]/20">
          <Armchair size={18} strokeWidth={2.5} />
        </div>
        <span className="font-extrabold text-gray-900 tracking-tight text-xl">ERP</span>
      </div>

      {/* COMPANY INFO */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="text-sm font-semibold text-gray-800">DFurn Modular Systems Pvt. Ltd.</div>
        <div className="text-[10px] text-gray-400 mt-1">GSTIN: 24AADCD4139R1ZB</div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 py-4 flex flex-col gap-1">
        <Link href="#" className="flex items-center gap-3 px-6 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors">
          <LayoutDashboard size={18} className="text-gray-500" />
          <span className="font-semibold text-sm">Dashboard</span>
        </Link>

        {/* SALES SECTION */}
        <div>
          <button 
            onClick={() => setSalesOpen(!salesOpen)}
            className="w-full flex items-center justify-between px-6 py-2.5 text-orange-500 hover:bg-orange-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <TrendingUp size={18} />
              <span className="font-bold text-xs uppercase tracking-wider">SALES</span>
            </div>
            {salesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          
          {salesOpen && (
            <div className="flex flex-col mt-1 mb-2">
              <Link href="/enquiries" className={`px-12 py-2.5 text-sm font-medium transition-colors border-l-4 ${pathname.includes('enquiries') ? 'border-orange-500 bg-orange-50/50 text-gray-900' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                Enquiries
              </Link>
              <Link href="/quotations" className={`px-12 py-2.5 text-sm font-medium transition-colors border-l-4 ${pathname.includes('quotations') ? 'border-orange-500 bg-orange-50/50 text-gray-900' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                Quotations
              </Link>
              <Link href="/clients" className={`px-12 py-2.5 text-sm font-medium transition-colors border-l-4 ${pathname.includes('clients') ? 'border-orange-500 bg-orange-50/50 text-gray-900' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                Clients
              </Link>
            </div>
          )}
        </div>

        <Link href="#" className="flex items-center justify-between px-6 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <ClipboardList size={18} className="text-gray-500" />
            <span className="font-bold text-xs uppercase tracking-wider">ORDERS</span>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </Link>

        <Link href="#" className="flex items-center justify-between px-6 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <Layers size={18} className="text-gray-500" />
            <span className="font-bold text-xs uppercase tracking-wider">PRODUCTS</span>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </Link>

        <Link href="#" className="flex items-center justify-between px-6 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <Package size={18} className="text-gray-500" />
            <span className="font-bold text-xs uppercase tracking-wider">MATERIAL MANAGEMENT</span>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </Link>

        {userRole === 'SUPER_ADMIN' && (
          <Link href="/users" className="flex items-center justify-between px-6 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-gray-500" />
              <span className="font-bold text-xs uppercase tracking-wider">ADMIN</span>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </Link>
        )}
      </nav>
    </aside>
  );
}
