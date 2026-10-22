'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, MessageCircle, Phone, ArrowRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MobileEnquiryDetailSheetProps {
  enquiry: any;
  onClose: () => void;
  onUpdate: (updated: any) => void;
  lostReasons: any[];
}

export default function MobileEnquiryDetailSheet({
  enquiry,
  onClose,
  onUpdate,
  lostReasons,
}: MobileEnquiryDetailSheetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReasonId, setLostReasonId] = useState(lostReasons[0]?.id || '');
  const [lostNote, setLostNote] = useState('');

  if (!enquiry) return null;

  const clientName = enquiry.client?.name || enquiry.rawName || 'Client';
  const phone = Array.isArray(enquiry.client?.phones) && enquiry.client.phones.length > 0
    ? enquiry.client.phones[0]
    : enquiry.rawPhone || '';
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  const stage = enquiry.stage || 'New';
  const isLost = enquiry.outcome === 'Lost';

  // Handle stage advancement
  const handleAdvanceStage = async () => {
    if (stage === 'New') {
      // Must qualify
      setLoading(true);
      try {
        const res = await fetch(`/api/enquiries/${enquiry.id}/stage`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage: 'Qualified',
            brief: enquiry.scopeBrief || 'Qualified via Mobile App',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to qualify');
        toast.success('Enquiry marked as Qualified!');
        onUpdate({ ...enquiry, stage: 'Qualified' });
      } catch (err: any) {
        toast.error(err.message || 'Error updating stage');
      } finally {
        setLoading(false);
      }
    } else if (stage === 'Qualified') {
      // Route to create quotation
      onClose();
      router.push(`/app/quotations?enquiryId=${enquiry.id}&action=new`);
    }
  };

  // Handle outcome change (Reopen or Lost)
  const handleToggleOutcome = async () => {
    if (isLost) {
      // Reopen
      setLoading(true);
      try {
        const res = await fetch(`/api/enquiries/${enquiry.id}/outcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outcome: 'Open',
            actor: { name: 'Mobile User' },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reopen');
        toast.success('Enquiry reopened!');
        onUpdate({ ...enquiry, outcome: 'Open', lostReasonId: null, lostNote: null });
      } catch (err: any) {
        toast.error(err.message || 'Error updating outcome');
      } finally {
        setLoading(false);
      }
    } else {
      setShowLostModal(true);
    }
  };

  const handleConfirmLost = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: 'Lost',
          lostReasonId,
          lostNote: lostNote.trim() || undefined,
          actor: { name: 'Mobile User' },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark lost');
      toast.success('Enquiry marked as Lost');
      setShowLostModal(false);
      onUpdate({ ...enquiry, outcome: 'Lost', lostReasonId, lostNote });
    } catch (err: any) {
      toast.error(err.message || 'Error marking enquiry as lost');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      {/* Screen-blocking mutation overlay */}
      {loading && (
        <div className="fixed inset-0 z-60 bg-black/70 flex flex-col items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF7700] mb-2" />
          <span className="text-sm font-semibold tracking-wide">Updating Enquiry...</span>
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
              {enquiry.enquiryCode || 'ENQ–DRAFT'}
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              {clientName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {/* Quick Communication Actions */}
          <div className="flex gap-2">
            {cleanPhone ? (
              <>
                <a
                  href={`https://wa.me/${cleanPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-50 hover:bg-green-100 text-[#27AE60] text-xs font-bold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Chat</span>
                </a>
                <a
                  href={`tel:${cleanPhone}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span>Phone Call</span>
                </a>
              </>
            ) : (
              <div className="text-xs text-gray-400 italic">No phone number recorded</div>
            )}
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
                {enquiry.estimatedValue
                  ? '₹' + Math.round(Number(enquiry.estimatedValue)).toLocaleString('en-IN')
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
            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-700 border border-gray-200 whitespace-pre-wrap">
              {enquiry.scopeBrief || 'No brief description recorded.'}
            </div>
          </div>

          {/* Outcome Reason if Lost */}
          {isLost && enquiry.lostReason && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800">
              <span className="font-bold">Lost Reason: </span>
              {enquiry.lostReason.name}
              {enquiry.lostNote && <p className="mt-1 text-[11px] text-red-600">{enquiry.lostNote}</p>}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="space-y-2 pt-3 border-t border-gray-100">
          {stage === 'New' && !isLost && (
            <button
              type="button"
              onClick={handleAdvanceStage}
              className="w-full py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span>Advance to Qualified</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {stage === 'Qualified' && !isLost && (
            <button
              type="button"
              onClick={handleAdvanceStage}
              className="w-full py-2.5 rounded-xl bg-[#FF7700] hover:bg-[#E06900] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span>Create Quotation for Enquiry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Toggle Outcome Button */}
          <button
            type="button"
            onClick={handleToggleOutcome}
            className={`w-full py-2 rounded-xl text-xs font-semibold border transition-colors ${
              isLost
                ? 'border-green-600 text-[#27AE60] bg-green-50 hover:bg-green-100'
                : 'border-red-300 text-[#EB5757] hover:bg-red-50'
            }`}
          >
            {isLost ? 'Reopen Enquiry' : 'Mark as Lost'}
          </button>
        </div>
      </div>

      {/* Mark Lost Sub-Modal */}
      {showLostModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowLostModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-gray-900 mb-1">Mark Enquiry as Lost</h3>
            <p className="text-xs text-gray-500 mb-3">
              Please specify the primary reason for losing this opportunity:
            </p>

            <div className="space-y-3 mb-4">
              <select
                value={lostReasonId}
                onChange={(e) => setLostReasonId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#FF7700]"
              >
                {lostReasons.map((lr) => (
                  <option key={lr.id} value={lr.id}>
                    {lr.name}
                  </option>
                ))}
              </select>

              <textarea
                value={lostNote}
                onChange={(e) => setLostNote(e.target.value)}
                placeholder="Optional notes or feedback..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF7700]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLostModal(false)}
                className="flex-1 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLost}
                className="flex-1 py-2 text-xs font-bold bg-[#EB5757] hover:bg-red-600 text-white rounded-xl"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
