'use client';

import React, { useState } from 'react';
import { X, MessageCircle, Phone, Download, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { generateEnquiryPDF } from '@/lib/enquiries/enquiryPdfGenerator';
import { toast } from 'sonner';

interface MobileEnquiryDetailSheetProps {
  enquiry: any;
  onClose: () => void;
  onUpdate?: (updated: any) => void;
  lostReasons?: any[];
}

export default function MobileEnquiryDetailSheet({
  enquiry,
  onClose,
}: MobileEnquiryDetailSheetProps) {
  const [downloading, setDownloading] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(true);

  if (!enquiry) return null;

  const clientName = enquiry.client?.name || enquiry.rawName || 'Client';
  const phone = Array.isArray(enquiry.client?.phones) && enquiry.client.phones.length > 0
    ? enquiry.client.phones[0]
    : enquiry.rawPhone || '';
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  const stage = enquiry.stage || 'New';
  const isLost = enquiry.outcome === 'Lost';
  const items = Array.isArray(enquiry.items) ? enquiry.items : [];

  // Download Enquiry PDF
  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      await generateEnquiryPDF(enquiry, { autoDownload: true });
      toast.success('Enquiry PDF generated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      {/* Screen-blocking download overlay */}
      {downloading && (
        <div className="fixed inset-0 z-60 bg-black/70 flex flex-col items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF7700] mb-2" />
          <span className="text-sm font-semibold tracking-wide">Generating Enquiry PDF...</span>
        </div>
      )}

      <div
        className="w-full max-w-md bg-white rounded-t-3xl p-5 shadow-2xl border-t border-gray-200 flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-3" />

        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-gray-100">
          <div>
            <div className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">
              {enquiry.enquiryNumber || enquiry.enquiryCode || 'ENQ–DRAFT'}
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              {clientName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {/* Quick Communication & Export Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF7700] text-xs font-bold transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>

            {cleanPhone ? (
              <>
                <a
                  href={`https://wa.me/${cleanPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-50 hover:bg-green-100 text-[#27AE60] text-xs font-bold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`tel:${cleanPhone}`}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-colors"
                  title="Call client"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </>
            ) : null}
          </div>

          {/* Details Grid */}
          <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-gray-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Stage:</span>
              <span className="font-bold text-gray-900">{stage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Outcome:</span>
              <span
                className={`font-bold ${
                  isLost ? 'text-[#EB5757]' : 'text-[#27AE60]'
                }`}
              >
                {isLost ? 'Lost' : 'Open'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Category:</span>
              <span className="font-semibold text-gray-800">
                {enquiry.category?.name || 'Modular Furniture'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Opportunity Value:</span>
              <span className="font-bold text-gray-900">
                {(enquiry.opportunityValue ?? enquiry.estimatedBudget ?? enquiry.estimatedValue)
                  ? '₹' + Math.round(Number(enquiry.opportunityValue ?? enquiry.estimatedBudget ?? enquiry.estimatedValue)).toLocaleString('en-IN')
                  : '–'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Salesperson:</span>
              <span className="font-medium text-gray-800">
                {enquiry.salesperson?.name || 'Unassigned'}
              </span>
            </div>
          </div>

          {/* Scope & Brief */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Project Scope / Brief</div>
            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-700 border border-gray-200 whitespace-pre-wrap leading-relaxed">
              {enquiry.brief || enquiry.scopeBrief || 'No brief description recorded.'}
            </div>
          </div>

          {/* Scoped Products Accordion */}
          {items.length > 0 && (
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setItemsExpanded(!itemsExpanded)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F5] flex items-center justify-between text-xs font-bold text-gray-800 cursor-pointer"
              >
                <span>Scoped Items ({items.length})</span>
                {itemsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {itemsExpanded && (
                <div className="p-3 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {items.map((item: any, idx: number) => {
                    const dim = item.expectedDimensions;
                    return (
                      <div key={item.id || idx} className="py-2 first:pt-0 last:pb-0 text-xs">
                        <div className="flex justify-between font-semibold text-gray-900">
                          <span className="truncate">{item.description || item.name || `Item #${idx + 1}`}</span>
                          <span>₹{Math.round(Number(item.total || 0)).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
                          <span>{dim || `Qty: ${item.quantity || 1}`}</span>
                          <span>Rate: ₹{Math.round(Number(item.unitPrice || 0)).toLocaleString('en-IN')}</span>
                        </div>
                        {item.materialPreference && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Mat: {item.materialPreference}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Outcome Reason if Lost */}
          {isLost && enquiry.lostReason && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800">
              <span className="font-bold">Lost Reason: </span>
              {enquiry.lostReason.name}
              {enquiry.lostNote && <p className="mt-1 text-[11px] text-red-600">{enquiry.lostNote}</p>}
            </div>
          )}
        </div>

        {/* View-Only Bottom Actions */}
        <div className="space-y-2 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="w-full py-3 rounded-xl bg-[#FF7700] hover:bg-[#E06900] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Download Enquiry PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
