'use client';

import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MobileQuickEnquiryWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEnquiry: any) => void;
  categories: any[];
  salespersons: any[];
  clients: any[];
}

export default function MobileQuickEnquiryWizard({
  isOpen,
  onClose,
  onSuccess,
  categories,
  salespersons,
  clients,
}: MobileQuickEnquiryWizardProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [phone, setPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [scopeBrief, setScopeBrief] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [salespersonId, setSalespersonId] = useState(salespersons[0]?.id || '');

  if (!isOpen) return null;

  // Auto-fill existing client name when phone matches
  const handlePhoneChange = (val: string) => {
    setPhone(val);
    const clean = val.replace(/[^0-9]/g, '');
    if (clean.length >= 10) {
      const match = clients.find((c) => {
        const ph = Array.isArray(c.phones) && c.phones.length > 0 ? String(c.phones[0]) : '';
        return ph && ph.replace(/[^0-9]/g, '').endsWith(clean.slice(-10));
      });
      if (match) {
        setClientName(match.name);
      }
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!phone.trim()) {
        toast.error('Please enter client phone number');
        return;
      }
      if (!clientName.trim()) {
        toast.error('Please enter client name');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!scopeBrief.trim()) {
        toast.error('Please provide a brief description of project scope');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/enquiries/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clientName.trim(),
          phone: phone.trim(),
          categoryId: categoryId || undefined,
          scopeBrief: scopeBrief.trim(),
          estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
          salespersonId: salespersonId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create enquiry');
      }

      toast.success('Enquiry successfully created!');
      onSuccess(data.enquiry || data);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error creating enquiry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      {/* Screen-blocking mutation overlay */}
      {saving && (
        <div className="fixed inset-0 z-60 bg-black/70 flex flex-col items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF7700] mb-2" />
          <span className="text-sm font-semibold tracking-wide">Saving Enquiry...</span>
        </div>
      )}

      <div
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Header with Step Indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF7700]">
              Step {step} of 3
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {step === 1 ? 'Client Contact' : step === 2 ? 'Project Scope' : 'Commercials'}
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

        {/* Step Progress Bar */}
        <div className="flex gap-1.5 py-3">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-black' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto py-2 space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Client Phone Number *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7700]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Client Full Name *
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7700]"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Category
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const isSelected = categoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryId(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-black text-white shadow-xs'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Scope & Brief *
                </label>
                <textarea
                  value={scopeBrief}
                  onChange={(e) => setScopeBrief(e.target.value)}
                  placeholder="Describe requirement (e.g. L-shape kitchen in acrylic finish, 2 wardrobes in laminate)..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7700]"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Estimated Opportunity Value (₹)
                </label>
                <input
                  type="number"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  placeholder="e.g. 150000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7700]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assign Salesperson
                </label>
                <select
                  value={salespersonId}
                  onChange={(e) => setSalespersonId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF7700]"
                >
                  {salespersons.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} ({sp.designation || 'Sales'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#FF7700] hover:bg-[#E06900] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Lead</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
