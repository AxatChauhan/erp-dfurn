'use client';

import React, { useState } from 'react';
import { MessageCircle, Phone, ChevronRight, Download, Loader2 } from 'lucide-react';
import { generateEnquiryPDF } from '@/lib/enquiries/enquiryPdfGenerator';
import { toast } from 'sonner';

interface MobileEnquiryCardProps {
  enquiry: any;
  onSelect: (enquiry: any) => void;
}

const STAGES = ['New', 'Qualified', 'Quoted', 'Converted'] as const;

export default function MobileEnquiryCard({ enquiry, onSelect }: MobileEnquiryCardProps) {
  const [downloading, setDownloading] = useState(false);
  const clientName = enquiry.client?.name || enquiry.rawName || 'Direct Client';
  const phone = Array.isArray(enquiry.client?.phones) && enquiry.client.phones.length > 0
    ? enquiry.client.phones[0]
    : enquiry.rawPhone || '';
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  const categoryName = enquiry.category?.name || 'Modular Furniture';
  const stage = enquiry.stage || 'New';
  const isLost = enquiry.outcome === 'Lost';

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  // Format currency with Indian grouping
  const formatAmount = (val: number | null | undefined) => {
    if (!val || Number(val) === 0) return '–';
    return '₹' + Math.round(Number(val)).toLocaleString('en-IN');
  };

  const amountDisplay = formatAmount(enquiry.estimatedValue);

  // High-water mark index for monotonic pipeline
  const currentStageIndex = STAGES.indexOf(stage as any);

  return (
    <article
      onClick={() => onSelect(enquiry)}
      className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs hover:border-gray-900 transition-all cursor-pointer active:scale-[0.99] mb-3"
    >
      {/* Top Row: Client Name & Value */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900 truncate">
            {clientName}
          </h3>
          <div className="text-[11px] text-gray-500 font-mono tracking-tight flex items-center gap-1.5 mt-0.5">
            <span>{enquiry.enquiryCode || 'ENQ–DRAFT'}</span>
            <span>·</span>
            <span className="truncate">{categoryName}</span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-gray-900">
            {amountDisplay}
          </div>
          <span
            className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 ${
              isLost
                ? 'bg-red-50 text-[#EB5757]'
                : stage === 'Converted'
                ? 'bg-green-50 text-[#27AE60]'
                : stage === 'Quoted'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-orange-50 text-[#FF7700]'
            }`}
          >
            {isLost ? 'Lost' : stage}
          </span>
        </div>
      </div>

      {/* Monotonic Stage Funnel Dots */}
      <div className="my-2.5 py-1.5 px-2 bg-[#FAF9F5] rounded-xl flex items-center justify-between border border-gray-100">
        {STAGES.map((s, idx) => {
          const isReached = currentStageIndex >= idx;
          const isCurrent = stage === s && !isLost;

          return (
            <div key={s} className="flex-1 flex flex-col items-center relative">
              {/* Connecting line */}
              {idx > 0 && (
                <div
                  className={`absolute top-1.5 -left-1/2 right-1/2 h-0.5 -z-0 ${
                    currentStageIndex >= idx ? 'bg-black' : 'bg-gray-200'
                  }`}
                />
              )}
              {/* Dot */}
              <div
                className={`w-3 h-3 rounded-full z-10 transition-colors ${
                  isLost
                    ? 'bg-gray-300'
                    : isCurrent
                    ? 'bg-black ring-3 ring-black/20'
                    : isReached
                    ? 'bg-black'
                    : 'bg-gray-200'
                }`}
              />
              <span
                className={`text-[9px] mt-1 tracking-tight font-medium ${
                  isCurrent ? 'text-black font-bold' : 'text-gray-400'
                }`}
              >
                {s}
              </span>
            </div>
          );
        })}
      </div>

      {/* Quick Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-[#FF7700] hover:bg-orange-100 text-[11px] font-semibold transition-colors cursor-pointer"
            title="Download Enquiry PDF"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>PDF</span>
          </button>

          {cleanPhone ? (
            <>
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-[#27AE60] hover:bg-green-100 text-[11px] font-semibold transition-colors"
                title="Open WhatsApp chat"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
              <a
                href={`tel:${cleanPhone}`}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-[11px] font-semibold transition-colors"
                title="Call client"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
            </>
          ) : (
            <span className="text-[11px] text-gray-400 font-mono">No phone</span>
          )}
        </div>

        <div className="flex items-center text-xs font-semibold text-gray-600">
          <span>Details</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </article>
  );
}
