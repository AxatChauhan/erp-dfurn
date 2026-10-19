'use client';

import { useState } from 'react';
import { X, Check, AlertCircle, ChevronRight, Layers } from 'lucide-react';

interface VariantWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  masterProduct: {
    id: string;
    code: string;
    name: string;
    baseSellingRate: number;
    departmentIds: string[];
    nakedDimensions: any;
    boxDimensions: any;
    defaultDeliveryMode: string;
    defaultCreationMode: string;
    unitOfMeasurement: string;
    specifications: any;
  } | null;
}

export default function VariantWizardModal({
  isOpen,
  onClose,
  onSuccess,
  masterProduct,
}: VariantWizardModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states pre-filled from master
  const [variantName, setVariantName] = useState('');
  const [rate, setRate] = useState(masterProduct?.baseSellingRate || 0);
  const [deliveryMode, setDeliveryMode] = useState(masterProduct?.defaultDeliveryMode || 'Pre-assembled');

  if (!isOpen || !masterProduct) return null;

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const res = await fetch('/api/products/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterProductId: masterProduct.id,
          name: variantName.trim(),
          baseSellingRate: rate,
          defaultDeliveryMode: deliveryMode,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create variant');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-orange-600 tracking-wider mb-0.5">
              <span>Variant Creation</span>
              <span>·</span>
              <span>Step {currentStep} of 3</span>
            </div>
            <h2 className="text-base font-black text-[#1A1A1A]">
              New Variant for {masterProduct.name}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Stepper Header */}
        <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500">
          <span className={currentStep === 1 ? 'text-[#1A1A1A]' : 'text-gray-400'}>1. Identity</span>
          <span className={currentStep === 2 ? 'text-[#1A1A1A]' : 'text-gray-400'}>2. Pre-filled Review</span>
          <span className={currentStep === 3 ? 'text-[#1A1A1A]' : 'text-gray-400'}>3. Inheritance & SFG</span>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {currentStep === 1 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Variant Name *</label>
                <input
                  type="text"
                  required
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="e.g. Amber Oak (Walnut / Pre-assembled)"
                  className="w-full h-11 px-3 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs flex flex-col gap-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Parent Product</span>
                <span className="font-bold text-gray-900">{masterProduct.name}</span>
                <span className="font-mono text-gray-500 text-[11px]">{masterProduct.code}</span>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Selling Rate (₹) *</label>
                <input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="w-full h-10 px-2.5 border border-gray-200 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Delivery Mode</label>
                <div className="flex gap-2">
                  {['Pre-assembled', 'RTA'].map((dm) => (
                    <button
                      type="button"
                      key={dm}
                      onClick={() => setDeliveryMode(dm)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        deliveryMode === dm ? 'bg-[#1A1A1A] text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {dm}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex flex-col gap-3 text-xs">
              <div className="p-3.5 bg-orange-50/60 border border-orange-200 rounded-xl flex flex-col gap-1.5 text-orange-950">
                <span className="font-extrabold uppercase text-[10px] text-orange-800 tracking-wider">
                  Automatic Manufacturing Inheritance
                </span>
                <p className="text-[11px] leading-relaxed text-orange-900">
                  Upon saving, this variant will automatically:
                </p>
                <ul className="list-disc pl-4 text-[11px] space-y-1">
                  <li>Inherit the Process Chart from {masterProduct.code}</li>
                  <li>Re-base BOM part codes (e.g. {masterProduct.code}-001-P01)</li>
                  <li>Auto-seed Semi-Finished Goods (SFG) records at Stock Qty 0</li>
                  <li>Generate an individual QR code for shop-floor tracking</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(currentStep - 1)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-white disabled:opacity-30 cursor-pointer"
          >
            Back
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              disabled={currentStep === 1 && !variantName.trim()}
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-40 flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{isSubmitting ? 'Creating...' : 'Create Variant'}</span>
              <Check size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
