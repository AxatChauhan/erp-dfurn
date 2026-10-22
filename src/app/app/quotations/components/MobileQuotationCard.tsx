'use client';

import React, { useState } from 'react';
import { Download, MessageCircle, ChevronRight, Loader2 } from 'lucide-react';
import { generateQuotationPDF } from '@/lib/quotations/quotePdfGenerator';
import { toast } from 'sonner';

interface MobileQuotationCardProps {
  quotation: any;
  onSelect: (quotation: any) => void;
}

const STATUS_CLASS: Record<string, { bg: string; text: string; label: string }> = {
  Draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  'Verification Required': { bg: 'bg-orange-50', text: 'text-[#FF7700]', label: 'To Check' },
  'Admin Approval Required': { bg: 'bg-orange-50', text: 'text-[#FF7700]', label: 'To Approve' },
  Approved: { bg: 'bg-green-50', text: 'text-[#27AE60]', label: 'Approved' },
  'Not Approved': { bg: 'bg-red-50', text: 'text-[#EB5757]', label: 'Not Approved' },
  Sent: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sent' },
  'Followup Needed': { bg: 'bg-orange-50', text: 'text-[#FF7700]', label: 'Follow Up' },
  Converted: { bg: 'bg-green-50', text: 'text-[#27AE60]', label: 'Won' },
  'Not Converted': { bg: 'bg-red-50', text: 'text-[#EB5757]', label: 'Lost' },
};

export default function MobileQuotationCard({ quotation, onSelect }: MobileQuotationCardProps) {
  const [downloading, setDownloading] = useState(false);

  const quoteNo = quotation.quotationNumber || 'Draft – Unsubmitted';
  const clientName = quotation.client?.name || quotation.clientName || 'Direct Client';
  const phone = Array.isArray(quotation.client?.phones) && quotation.client.phones.length > 0
    ? quotation.client.phones[0]
    : quotation.clientPhone || '';
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  const status = quotation.status || 'Draft';
  const badge = STATUS_CLASS[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };

  const latestVersion = quotation.versions?.[0] || {};
  const grandTotal = latestVersion.grandTotal || quotation.totalAmount || 0;
  const versionNo = latestVersion.versionNo || quotation.currentVersionNo || 1;

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await generateQuotationPDF(quotation, latestVersion, { autoDownload: true });
      toast.success('Quotation PDF generated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = encodeURIComponent(
      `Hello ${clientName},\nHere is your quotation reference ${quoteNo} from D'furn Modular Systems.\nGrand Total: ₹${Math.round(grandTotal).toLocaleString('en-IN')}.\nPlease let us know if you have any questions!`
    );
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <article
      onClick={() => onSelect(quotation)}
      className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs hover:border-gray-900 transition-all cursor-pointer active:scale-[0.99] mb-3"
    >
      {/* Top Row: Quote Code & Version */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold font-mono text-gray-900">
              {quoteNo}
            </span>
            <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 bg-[#FAF9F5] text-gray-700 rounded border border-gray-200">
              v{versionNo}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-800 truncate mt-0.5">
            {clientName}
          </h3>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-sm font-black text-gray-900">
            ₹{Math.round(Number(grandTotal)).toLocaleString('en-IN')}
          </div>
          <span
            className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* Quick Summary Pill */}
      <div className="my-2 py-1.5 px-2.5 bg-[#FAF9F5] rounded-xl flex items-center justify-between text-[11px] text-gray-600 border border-gray-100">
        <span>Items: {latestVersion.items?.length || 0}</span>
        <span>·</span>
        <span>Gross: ₹{Math.round(Number(latestVersion.grossTotal || grandTotal)).toLocaleString('en-IN')}</span>
        <span>·</span>
        <span>GST 18%: ₹{Math.round(Number(latestVersion.gstAmount || 0)).toLocaleString('en-IN')}</span>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-[#FF7700] hover:bg-orange-100 text-[11px] font-semibold transition-colors cursor-pointer"
            title="Download PDF"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-[#27AE60] hover:bg-green-100 text-[11px] font-semibold transition-colors cursor-pointer"
            title="Share on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>

        <div className="flex items-center text-xs font-semibold text-gray-600">
          <span>Details</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </article>
  );
}
