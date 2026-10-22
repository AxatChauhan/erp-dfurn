'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, FileText, Plus } from 'lucide-react';
import { useMobileApp } from '../MobileAppContext';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { openActionSheet } = useMobileApp();

  const isEnquiries = pathname.includes('/app/enquiries') || pathname === '/app';
  const isQuotations = pathname.includes('/app/quotations');

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-[#FAF9F5]/95 backdrop-blur-md border-t border-gray-200 shadow-lg"
      style={{
        paddingBottom: 'calc(0.4rem + env(safe-area-inset-bottom, 0px))',
      }}
      aria-label="Mobile Bottom Navigation"
    >
      <div className="max-w-md mx-auto px-6 h-14 flex items-center justify-between relative">
        {/* Tab 1: Enquiries */}
        <Link
          href="/app/enquiries"
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            isEnquiries
              ? 'text-black font-bold'
              : 'text-[#8B8778] hover:text-gray-900 font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-colors ${
              isEnquiries ? 'bg-[#EAE8DF]' : 'bg-transparent'
            }`}
          >
            <ClipboardList className={`w-5 h-5 ${isEnquiries ? 'text-black' : 'text-[#8B8778]'}`} />
          </div>
          <span className="text-[11px] tracking-tight mt-0.5">Enquiries</span>
        </Link>

        {/* Center Action Button (+) */}
        <div className="flex-1 flex justify-center -translate-y-3">
          <button
            type="button"
            onClick={openActionSheet}
            className="w-12 h-12 rounded-full bg-[#FF7700] hover:bg-[#E06900] active:scale-95 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 transition-transform cursor-pointer border-2 border-white ring-2 ring-orange-200/50"
            title="Create New Enquiry or Quotation"
            aria-label="Create New"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab 2: Quotations */}
        <Link
          href="/app/quotations"
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            isQuotations
              ? 'text-black font-bold'
              : 'text-[#8B8778] hover:text-gray-900 font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-colors ${
              isQuotations ? 'bg-[#EAE8DF]' : 'bg-transparent'
            }`}
          >
            <FileText className={`w-5 h-5 ${isQuotations ? 'text-black' : 'text-[#8B8778]'}`} />
          </div>
          <span className="text-[11px] tracking-tight mt-0.5">Quotations</span>
        </Link>
      </div>
    </nav>
  );
}
