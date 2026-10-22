'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { autoCode } from '@/lib/products/codeGen';

interface HierarchyAddInlineModalProps {
  open: boolean;
  type: 'segment' | 'category' | 'subcategory';
  parentId?: string;
  parentName?: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function HierarchyAddInlineModal({
  open,
  type,
  parentId,
  parentName,
  onClose,
  onSuccess,
}: HierarchyAddInlineModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isCodeDirty, setIsCodeDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setCode('');
      setIsCodeDirty(false);
      setError(null);
    }
  }, [open, type, parentId]);

  if (!open) return null;

  const typeLabels = {
    segment: 'Segment',
    category: 'Category',
    subcategory: 'Sub-Category',
  };

  const currentLabel = typeLabels[type];

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isCodeDirty) {
      setCode(autoCode(val));
    }
  };

  const handleCodeChange = (val: string) => {
    setCode(val.toUpperCase());
    setIsCodeDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await fetch('/api/products/hierarchy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: name.trim(),
          code: code.trim() || autoCode(name.trim()),
          parentId: parentId || undefined,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to create item');
        return;
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <span className="text-[11px] font-bold text-[#FF7700] uppercase tracking-wider block">
              {parentName ? `Add to ${parentName}` : 'Add Master Level'}
            </span>
            <h2 className="text-base font-black text-gray-900 mt-0.5">
              New {currentLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
            <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">
              {currentLabel} Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={`e.g. ${
                type === 'segment'
                  ? 'Office Workspaces'
                  : type === 'category'
                  ? 'Executive Desks'
                  : 'Motorized Height Adjustable Desks'
              }`}
              className="w-full h-11 px-3 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-[#FF7700] focus:border-[#FF7700] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700">
                Code * (2 to 3 letters, uppercase)
              </label>
              {!isCodeDirty && name.trim() && (
                <span className="text-[10px] text-green-700 font-semibold bg-green-50 px-1.5 py-0.5 rounded">
                  auto-suggested
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="e.g. OFF"
              maxLength={8}
              className="w-full h-11 px-3 border border-gray-200 rounded-xl text-xs font-mono font-bold uppercase text-gray-900 focus:ring-2 focus:ring-[#FF7700] focus:border-[#FF7700] focus:outline-none"
            />
            <span className="text-[10px] text-gray-400 block mt-1">
              Must be unique company-wide. Duplicate codes are strictly rejected.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 mt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF7700] hover:bg-[#e06900] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Create {currentLabel}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
