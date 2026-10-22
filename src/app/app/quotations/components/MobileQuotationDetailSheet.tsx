'use client';

import React, { useState } from 'react';
import { X, Download, MessageCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { generateQuotationPDF } from '@/lib/quotations/quotePdfGenerator';
import { toast } from 'sonner';

interface MobileQuotationDetailSheetProps {
  quotation: any;
  onClose: () => void;
  onUpdate?: (updated: any) => void;
  userRole?: string;
}

export default function MobileQuotationDetailSheet({
  quotation,
  onClose,
}: MobileQuotationDetailSheetProps) {
  const [downloading, setDownloading] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(true);

  if (!quotation) return null;

  const quoteNo = quotation.quotationNumber || 'Draft – Unsubmitted';
  const clientName = quotation.client?.name || quotation.clientName || 'Direct Client';
  const phone = Array.isArray(quotation.client?.phones) && quotation.client.phones.length > 0
    ? quotation.client.phones[0]
    : quotation.clientPhone || '';
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  const status = quotation.status || 'Draft';

  const latestVersion = quotation.versions?.[0] || {};
  const items = latestVersion.items || [];
  const versionNo = latestVersion.versionNo || quotation.currentVersionNo || 1;

  const grossTotal = Number(latestVersion.grossTotal || quotation.totalAmount || 0);
  const discountAmount = Number(latestVersion.overallDiscountAmount || 0);
  const discountedGross = grossTotal - discountAmount;
  const additionalCharges = Number(latestVersion.additionalChargesTotal || 0);
  const gstAmount = Number(latestVersion.gstAmount || 0);
  const grandTotal = Number(latestVersion.grandTotal || quotation.totalAmount || 0);

  // PDF Download
  const handleDownloadPDF = async () => {
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

  // WhatsApp Share
  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hello ${clientName},\nHere is your quotation reference ${quoteNo} from D'furn Modular Systems.\nGrand Total: ₹${Math.round(grandTotal).toLocaleString('en-IN')}.\nPlease let us know if you have any questions!`
    );
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      {/* Screen-blocking overlay */}
      {downloading && (
        <div className="fixed inset-0 z-60 bg-black/70 flex flex-col items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF7700] mb-2" />
          <span className="text-sm font-semibold tracking-wide">Generating PDF...</span>
        </div>
      )}

      <div
        className="w-full max-w-md bg-white rounded-t-3xl p-5 shadow-2xl border-t border-gray-200 flex flex-col max-h-[88vh] animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-3" />

        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-gray-900">
                {quoteNo}
              </span>
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 bg-[#FAF9F5] text-gray-700 rounded border border-gray-200">
                v{versionNo}
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-tight mt-0.5">
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {/* Quick Actions (PDF & WhatsApp) */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex-1 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF7700] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="flex-1 py-2.5 rounded-xl bg-green-50 hover:bg-green-100 text-[#27AE60] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Share</span>
            </button>
          </div>

          {/* Line Items Accordion */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setItemsExpanded(!itemsExpanded)}
              className="w-full px-3.5 py-2.5 bg-[#FAF9F5] flex items-center justify-between text-xs font-bold text-gray-800 cursor-pointer"
            >
              <span>Line Items ({items.length})</span>
              {itemsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {itemsExpanded && (
              <div className="p-3 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2 text-center">No line items in this version</div>
                ) : (
                  items.map((item: any, idx: number) => {
                    const l = item.lengthMm || item.l || 0;
                    const b = item.breadthMm || item.b || item.w || 0;
                    const h = item.heightMm || item.h || 0;
                    const hasDims = l > 0 || b > 0 || h > 0;

                    return (
                      <div key={item.id || idx} className="py-2 first:pt-0 last:pb-0 text-xs">
                        <div className="flex justify-between font-semibold text-gray-900">
                          <span className="truncate">{item.description || item.productName || `Item #${idx + 1}`}</span>
                          <span>₹{Math.round(Number(item.totalPrice || item.finalPrice || 0)).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
                          {hasDims ? (
                            <span>L {l} × B {b} × H {h} mm</span>
                          ) : (
                            <span>Qty: {item.quantity || 1}</span>
                          )}
                          <span>Rate: ₹{Math.round(Number(item.unitRate || 0)).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Commercial Waterfall Breakdown */}
          <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-gray-200 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Gross Total:</span>
              <span className="font-semibold text-gray-900">₹{Math.round(grossTotal).toLocaleString('en-IN')}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[#27AE60]">
                <span>Overall Discount:</span>
                <span>– ₹{Math.round(discountAmount).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Discounted Gross:</span>
              <span className="font-medium text-gray-800">₹{Math.round(discountedGross).toLocaleString('en-IN')}</span>
            </div>
            {additionalCharges > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Additional Charges:</span>
                <span>+ ₹{Math.round(additionalCharges).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>GST (18%):</span>
              <span className="font-medium text-gray-800">+ ₹{Math.round(gstAmount).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-300/80 text-sm font-black text-gray-900">
              <span>Grand Total:</span>
              <span>₹{Math.round(grandTotal).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Status pill */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600">
            <span>Status:</span>
            <span className="font-bold text-gray-900">{status}</span>
          </div>
        </div>

        {/* View-Only Bottom Actions */}
        <div className="pt-3 border-t border-gray-100 space-y-2">
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="w-full py-3 rounded-xl bg-[#FF7700] hover:bg-[#E06900] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Download Quotation PDF</span>
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
