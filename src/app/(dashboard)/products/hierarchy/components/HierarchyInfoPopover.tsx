'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Info, X, ShieldAlert, KeyRound, GitFork, Trash2 } from 'lucide-react';

interface HierarchyInfoPopoverProps {
  buttonClassName?: string;
}

export function HierarchyInfoPopover({ buttonClassName }: HierarchyInfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={
          buttonClassName ||
          'p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer'
        }
        title="Product Hierarchy Guidelines"
        aria-label="Product Hierarchy Guidelines"
      >
        <Info size={16} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#1A1A1A] text-white p-4 rounded-2xl shadow-2xl border border-gray-800 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF7700]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                Hierarchy Architecture Rules
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-3 space-y-3 text-xs text-gray-300 leading-relaxed">
            <div className="flex items-start gap-2.5">
              <GitFork size={15} className="text-[#FF7700] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">3-Tier Master Taxonomy</span>
                <span>
                  Segments organize top-level industries. Categories group functional product lines. Sub-Categories hold exact product groupings.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <KeyRound size={15} className="text-[#FF7700] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">Auto-Code Generation</span>
                <span>
                  Codes are generated from the first 2 or 3 letters of the name, uppercase, ignoring spaces. Codes are unique company-wide.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldAlert size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">Collision Prevention (HTTP 409)</span>
                <span>
                  Code collisions are strictly blocked. If a duplicate code is attempted, adjust the code manually before saving.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Trash2 size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">Cascading Delete Guards</span>
                <span>
                  A parent node cannot be deleted while any child categories, sub-categories, or master products still reference it.
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between items-center text-[11px] text-gray-400">
            <span>D&apos;furn ERP Design Standard</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#FF7700] hover:underline font-semibold cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
