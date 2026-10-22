'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import MobileEnquiryCard from './components/MobileEnquiryCard';
import MobileQuickEnquiryWizard from './components/MobileQuickEnquiryWizard';
import MobileEnquiryDetailSheet from './components/MobileEnquiryDetailSheet';
import { useMobileApp } from '../MobileAppContext';

interface MobileEnquiriesClientProps {
  initialEnquiries: any[];
  categories: any[];
  sourceCategories: any[];
  salespersons: any[];
  clients: any[];
  lostReasons: any[];
  userRole: string;
}

const BUCKETS = ['All', 'New', 'Qualified', 'Quoted', 'Converted', 'Lost'] as const;

export default function MobileEnquiriesClient({
  initialEnquiries,
  categories,
  sourceCategories,
  salespersons,
  clients,
  lostReasons,
  userRole,
}: MobileEnquiriesClientProps) {
  const { activeModal, closeModal } = useMobileApp();

  const [enquiries, setEnquiries] = useState<any[]>(initialEnquiries || []);
  const [search, setSearch] = useState('');
  const [filterBucket, setFilterBucket] = useState<string>('All');
  const [selectedEnquiry, setSelectedEnquiry] = useState<any | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Trigger wizard if activeModal === 'NEW_ENQUIRY'
  useEffect(() => {
    if (activeModal === 'NEW_ENQUIRY') {
      setWizardOpen(true);
      closeModal();
    }
  }, [activeModal, closeModal]);

  // Filtered enquiries
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((e) => {
      // Bucket filter
      if (filterBucket === 'Lost') {
        if (e.outcome !== 'Lost') return false;
      } else if (filterBucket !== 'All') {
        if (e.outcome === 'Lost' || e.stage !== filterBucket) return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const clientName = (e.client?.name || e.rawName || '').toLowerCase();
        const phone = (Array.isArray(e.client?.phones) ? e.client.phones[0] : e.rawPhone || '').toLowerCase();
        const code = (e.enquiryCode || '').toLowerCase();
        const cat = (e.category?.name || '').toLowerCase();
        if (
          !clientName.includes(q) &&
          !phone.includes(q) &&
          !code.includes(q) &&
          !cat.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [enquiries, filterBucket, search]);

  const handleCreated = (newEnq: any) => {
    setEnquiries((prev) => [newEnq, ...prev]);
  };

  const handleUpdated = (updated: any) => {
    setEnquiries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setSelectedEnquiry(updated);
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
          placeholder="Search by client, phone, or code..."
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

      {/* Pipeline Summary Bar */}
      <div className="flex items-center justify-between px-1 text-[11px] text-gray-500 font-medium">
        <span>Showing {filteredEnquiries.length} enquiries</span>
        <span>{filterBucket === 'All' ? 'All Pipelines' : filterBucket}</span>
      </div>

      {/* Cards Feed */}
      {filteredEnquiries.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 mt-2">
          <p className="text-xs font-semibold text-gray-700 mb-1">No enquiries found</p>
          <p className="text-[11px] text-gray-400">
            {search ? 'Try clearing your search query' : 'Tap the + button below to create a lead'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredEnquiries.map((enq) => (
            <MobileEnquiryCard
              key={enq.id}
              enquiry={enq}
              onSelect={(item) => setSelectedEnquiry(item)}
            />
          ))}
        </div>
      )}

      {/* Enquiry Detail Modal / Sheet */}
      {selectedEnquiry && (
        <MobileEnquiryDetailSheet
          enquiry={selectedEnquiry}
          onClose={() => setSelectedEnquiry(null)}
          onUpdate={handleUpdated}
          lostReasons={lostReasons}
        />
      )}

      {/* Quick Enquiry Wizard Modal */}
      <MobileQuickEnquiryWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={handleCreated}
        categories={categories}
        salespersons={salespersons}
        clients={clients}
      />
    </div>
  );
}
