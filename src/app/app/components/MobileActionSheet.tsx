'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useMobileApp } from '../MobileAppContext';
import { ClipboardList, FileText, X } from 'lucide-react';

export default function MobileActionSheet() {
  const { isActionSheetOpen, closeActionSheet, openModal } = useMobileApp();
  const router = useRouter();
  const pathname = usePathname();

  if (!isActionSheetOpen) return null;

  const handleSelect = (action: 'NEW_ENQUIRY' | 'NEW_QUOTATION') => {
    closeActionSheet();
    if (action === 'NEW_ENQUIRY') {
      openModal('NEW_ENQUIRY');
      if (!pathname.includes('/app/enquiries')) {
        router.push('/app/enquiries');
      }
    } else {
      openModal('NEW_QUOTATION');
      if (!pathname.includes('/app/quotations')) {
        router.push('/app/quotations');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={closeActionSheet}
    >
      <div
        className="w-full max-w-md bg-[#FAF9F5] rounded-t-3xl p-5 shadow-2xl border-t border-gray-200 animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">Quick Action</h3>
            <p className="text-xs text-gray-500">Choose an action to proceed</p>
          </div>
          <button
            type="button"
            onClick={closeActionSheet}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-200/60 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <button
            type="button"
            onClick={() => handleSelect('NEW_ENQUIRY')}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-gray-200/80 hover:border-gray-900 hover:bg-gray-50 text-left transition-all shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#FF7700] flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900">New Enquiry / Lead</div>
              <div className="text-xs text-gray-500 truncate">
                Capture client contact, project scope & budget
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('NEW_QUOTATION')}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-gray-200/80 hover:border-gray-900 hover:bg-gray-50 text-left transition-all shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-gray-900 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900">New Quotation</div>
              <div className="text-xs text-gray-500 truncate">
                Create quotation draft for a qualified enquiry
              </div>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={closeActionSheet}
          className="w-full py-2.5 text-xs font-semibold text-gray-600 bg-gray-200/70 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
