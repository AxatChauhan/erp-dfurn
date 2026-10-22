'use client';

import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { normalizeQuoteStatus } from '@/lib/quotations/quoteService';
import MobileQuotationCard from './components/MobileQuotationCard';
import MobileQuotationDetailSheet from './components/MobileQuotationDetailSheet';

interface MobileQuotationsClientProps {
  initialQuotations: any[];
  salespersons: any[];
  userRole: string;
}

const BUCKETS = ['All', 'Draft', 'To Approve', 'Approved', 'Sent', 'Won', 'Lost'] as const;

export default function MobileQuotationsClient({
  initialQuotations,
  salespersons,
  userRole,
}: MobileQuotationsClientProps) {
  const [quotations, setQuotations] = useState<any[]>(initialQuotations || []);
  const [search, setSearch] = useState('');
  const [filterBucket, setFilterBucket] = useState<string>('All');
  const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);

  // Filtered quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const status = normalizeQuoteStatus(q.status);

      // Bucket filtering
      if (filterBucket === 'Draft') {
        if (status !== 'Draft') return false;
      } else if (filterBucket === 'To Approve') {
        if (status !== 'Admin Approval Required' && status !== 'Verification Required') return false;
      } else if (filterBucket === 'Approved') {
        if (status !== 'Approved') return false;
      } else if (filterBucket === 'Sent') {
        if (status !== 'Sent' && status !== 'Followup Needed') return false;
      } else if (filterBucket === 'Won') {
        if (status !== 'Converted') return false;
      } else if (filterBucket === 'Lost') {
        if (status !== 'Not Approved' && status !== 'Not Converted') return false;
      }

      // Search filtering
      if (search.trim()) {
        const query = search.toLowerCase();
        const code = (q.quotationNumber || q.code || '').toLowerCase();
        const clientName = (q.client?.name || q.clientName || '').toLowerCase();
        if (!code.includes(query) && !clientName.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [quotations, filterBucket, search]);

  const handleUpdated = (updated: any) => {
    setQuotations((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    setSelectedQuotation(updated);
  };

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search quotes by number or client..."
          className="w-full pl-9 pr-9 py-2.5 bg-white rounded-2xl border border-gray-200 text-xs shadow-2xs focus:outline-none focus:ring-2 focus:ring-black"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="p-1 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Pills - Selected state is strictly Black (#000000) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-3 px-3">
        {BUCKETS.map((bucket) => {
          const isSelected = filterBucket === bucket;
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => setFilterBucket(bucket)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                isSelected
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {bucket}
            </button>
          );
        })}
      </div>

      {/* Summary Bar */}
      <div className="flex items-center justify-between px-1 text-[11px] text-gray-500 font-medium">
        <span>Showing {filteredQuotations.length} quotations</span>
        <span>{filterBucket === 'All' ? 'All Statuses' : filterBucket}</span>
      </div>

      {/* Cards Feed */}
      {filteredQuotations.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 mt-2">
          <p className="text-xs font-semibold text-gray-700 mb-1">No quotations found</p>
          <p className="text-[11px] text-gray-400">
            {search ? 'Try clearing your search query' : 'Quotations are generated from qualified enquiries'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredQuotations.map((quote) => (
            <MobileQuotationCard
              key={quote.id}
              quotation={quote}
              onSelect={(item) => setSelectedQuotation(item)}
            />
          ))}
        </div>
      )}

      {/* Quotation Detail Bottom Sheet */}
      {selectedQuotation && (
        <MobileQuotationDetailSheet
          quotation={selectedQuotation}
          onClose={() => setSelectedQuotation(null)}
          onUpdate={handleUpdated}
          userRole={userRole}
        />
      )}
    </div>
  );
}
