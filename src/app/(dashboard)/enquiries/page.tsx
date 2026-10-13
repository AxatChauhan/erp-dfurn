'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  AlertCircle, 
  Building2, 
  Check, 
  ChevronDown, 
  Edit2, 
  Eye, 
  Loader2, 
  MessageCircle, 
  Plus, 
  Search, 
  Trash2, 
  X, 
  XCircle 
} from 'lucide-react';
import { 
  ENQUIRY_STAGES, 
  EnquiryStage, 
  LOST_REASONS, 
  TIMELINES, 
  PROPERTY_TYPES, 
  COMMON_SALESPERSONS 
} from '@/lib/enquiryUtils';

// -------------------------------------------------------------
// TYPES
// -------------------------------------------------------------

type Client = {
  id: string;
  clientCode?: string | null;
  clientType: string;
  name: string;
  contactPerson?: string | null;
  phones?: string[];
  emails?: string[];
};

type EnquiryItem = {
  id?: string;
  description: string;
  quantity: number;
  expectedDimensions?: string;
  materialPreference?: string;
  clientComment?: string;
};

type QuotationSummary = {
  id: string;
  quotationNumber: string;
  status: string;
  totalAmount: number;
};

type Enquiry = {
  id: string;
  enquiryNumber: string;
  clientId: string;
  clientName: string;
  clientCode?: string | null;
  clientPhones?: string[];
  clientEmails?: string[];
  
  status: string;
  stage: EnquiryStage;
  outcome: 'Open' | 'Lost';
  lostAtStage?: string | null;
  lostReason?: string | null;
  lostNote?: string | null;
  
  enteredById?: string | null;
  enteredByName?: string | null;
  salespersonId?: string | null;
  salespersonName?: string | null;
  
  expectedTimeline?: string | null;
  estimatedBudget?: number | null;
  propertyType?: string | null;
  nextFollowUp?: string | null;
  notes?: string | null;
  
  items: EnquiryItem[];
  quotations?: QuotationSummary[];
  
  createdAt: string;
  updatedAt?: string;
};

// High-legibility status badge styling matching Clients module aesthetics
const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  'New': { label: 'New', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-2 border-blue-200' },
  'Qualified': { label: 'Qualified', bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-2 border-amber-200' },
  'Quoted': { label: 'Quoted', bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-2 border-purple-200' },
  'Converted': { label: 'Won', bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-2 border-emerald-200' },
  'Lost': { label: 'Lost', bg: 'bg-red-50', text: 'text-red-900', border: 'border-2 border-red-200' }
};

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active filter tab: 'ALL' | 'New' | 'Qualified' | 'Quoted' | 'Converted' | 'Lost'
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeEnquiry, setActiveEnquiry] = useState<Enquiry | null>(null);

  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [enquiryToMarkLost, setEnquiryToMarkLost] = useState<Enquiry | null>(null);

  const [mounted, setMounted] = useState(false);
  // Status Dropdown Tracker (which enquiry row's status menu is open & its target coordinates)
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
  } | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);

  const activeMenuEnquiry = useMemo(
    () => enquiries.find(e => e.id === openStatusMenuId) || null,
    [enquiries, openStatusMenuId]
  );

  useEffect(() => {
    setMounted(true);
    fetchEnquiries();
    fetchClients();
  }, []);

  // Handle outside click, scroll, resize, or escape to dismiss status dropdown
  useEffect(() => {
    if (!openStatusMenuId) return;

    const handleScrollOrResize = (e: Event) => {
      // Don't close if scrolling inside the dropdown menu itself
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      setOpenStatusMenuId(null);
      triggerButtonRef.current = null;
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerButtonRef.current && !triggerButtonRef.current.contains(target)
      ) {
        setOpenStatusMenuId(null);
        triggerButtonRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenStatusMenuId(null);
        triggerButtonRef.current = null;
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openStatusMenuId]);

  const handleToggleStatusMenu = (e: React.MouseEvent<HTMLButtonElement>, enquiry: Enquiry) => {
    e.stopPropagation();
    if (openStatusMenuId === enquiry.id) {
      setOpenStatusMenuId(null);
      triggerButtonRef.current = null;
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    triggerButtonRef.current = e.currentTarget;

    const menuWidth = 192; // 12rem = 192px
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenUpwards = spaceBelow < 250 && spaceAbove > 250;

    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - menuWidth - 12);
    }

    if (shouldOpenUpwards) {
      setMenuPosition({
        bottom: window.innerHeight - rect.top + 6,
        left
      });
    } else {
      setMenuPosition({
        top: rect.bottom + 6,
        left
      });
    }

    setOpenStatusMenuId(enquiry.id);
  };

  const fetchEnquiries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/enquiries');
      const data = await res.json();
      if (Array.isArray(data)) {
        setEnquiries(data);
      }
    } catch (err) {
      console.error('Failed to load enquiries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      if (Array.isArray(data)) {
        setClients(data);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  };

  const handleOptimisticUpdate = (updated: Enquiry) => {
    setEnquiries(prev => {
      const idx = prev.findIndex(e => e.id === updated.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });

    if (activeEnquiry?.id === updated.id) {
      setActiveEnquiry(updated);
    }
  };

  const handleClientCreated = (newClient: Client) => {
    setClients(prev => [newClient, ...prev]);
  };

  // 1-Click Instant Optimistic Status Switcher (0ms UI latency)
  const handleQuickStatusChange = (enquiry: Enquiry, newStage: EnquiryStage) => {
    setOpenStatusMenuId(null);
    triggerButtonRef.current = null;

    // 1. INSTANT OPTIMISTIC IN-MEMORY UPDATE (0ms)
    const previous = { ...enquiry };
    const optimisticUpdated: Enquiry = {
      ...enquiry,
      stage: newStage,
      outcome: 'Open',
      lostAtStage: null,
      lostReason: null,
      lostNote: null
    };
    handleOptimisticUpdate(optimisticUpdated);

    // 2. Background sync
    fetch(`/api/enquiries/${enquiry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        stage: newStage,
        outcome: 'Open',
        forceStage: true
      })
    })
      .then(async (res) => {
        if (res.ok) {
          const serverUpdated = await res.json();
          handleOptimisticUpdate(serverUpdated);
        } else {
          handleOptimisticUpdate(previous);
          const err = await res.json();
          alert(err.error || 'Failed to update status on server');
        }
      })
      .catch((err) => {
        console.error('Failed to change status:', err);
        handleOptimisticUpdate(previous);
      });
  };

  const handleDeleteEnquiry = async (enquiry: Enquiry) => {
    if (!confirm(`Are you sure you want to delete enquiry ${enquiry.enquiryNumber}?`)) return;
    
    // Instant optimistic removal
    const previous = [...enquiries];
    setEnquiries(prev => prev.filter(e => e.id !== enquiry.id));
    if (activeEnquiry?.id === enquiry.id) setIsDetailOpen(false);

    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        setEnquiries(previous);
        alert(data.error || 'Failed to delete');
      }
    } catch (err: any) {
      setEnquiries(previous);
      alert(err.message || 'Error deleting enquiry');
    }
  };

  // Tab counts
  const tabCounts = useMemo(() => {
    const all = enquiries.length;
    const newCount = enquiries.filter(e => e.stage === 'New' && e.outcome === 'Open').length;
    const qualified = enquiries.filter(e => e.stage === 'Qualified' && e.outcome === 'Open').length;
    const quoted = enquiries.filter(e => e.stage === 'Quoted' && e.outcome === 'Open').length;
    const won = enquiries.filter(e => e.stage === 'Converted' && e.outcome === 'Open').length;
    const lost = enquiries.filter(e => e.outcome === 'Lost').length;
    return { all, newCount, qualified, quoted, won, lost };
  }, [enquiries]);

  // Filtered List
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter(e => {
      // 1. Tab Filter
      if (activeTab === 'New' && (e.stage !== 'New' || e.outcome === 'Lost')) return false;
      if (activeTab === 'Qualified' && (e.stage !== 'Qualified' || e.outcome === 'Lost')) return false;
      if (activeTab === 'Quoted' && (e.stage !== 'Quoted' || e.outcome === 'Lost')) return false;
      if (activeTab === 'Converted' && (e.stage !== 'Converted' || e.outcome === 'Lost')) return false;
      if (activeTab === 'Lost' && e.outcome !== 'Lost') return false;

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = (e.enquiryNumber || '').toLowerCase().includes(q);
        const matchesClient = (e.clientName || '').toLowerCase().includes(q);
        const matchesPhone = (e.clientPhones || []).some(p => p.toLowerCase().includes(q));
        if (!matchesCode && !matchesClient && !matchesPhone) return false;
      }

      return true;
    });
  }, [enquiries, activeTab, searchQuery]);

  // Clean formatted display ID (e.g. E-001 or DF_ENQ_000001)
  const formatDisplayId = (code: string) => {
    if (!code) return 'E-001';
    if (code.startsWith('DF_ENQ_')) {
      const num = parseInt(code.replace('DF_ENQ_', ''), 10);
      return `E-${String(num).padStart(3, '0')}`;
    }
    return code;
  };

  // Clean date format matching the photo (e.g. 12 Oct 2026)
  const formatDisplayDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto pb-16 text-slate-900 transition-all font-sans p-4 sm:p-6 lg:p-8">
      
      {/* 1. TOP HEADER: "Enquiries" & "+ New Enquiry" Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Enquiries
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1">
            Track customer leads, unpriced requirements & pipeline conversions
          </p>
        </div>

        <button 
          onClick={() => { setEditingEnquiry(null); setIsFormOpen(true); }}
          className="h-11 px-5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>New Enquiry</span>
        </button>
      </div>

      {/* 2. FILTER TABS (MATCHING UPLOADED PHOTO) & SEARCH */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6">
        
        {/* Horizontal Segmented Tabs with 2px borders */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            All ({tabCounts.all})
          </button>

          <button
            onClick={() => setActiveTab('New')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'New'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            New ({tabCounts.newCount})
          </button>

          <button
            onClick={() => setActiveTab('Qualified')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'Qualified'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            Qualified ({tabCounts.qualified})
          </button>

          <button
            onClick={() => setActiveTab('Quoted')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'Quoted'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            Quoted ({tabCounts.quoted})
          </button>

          <button
            onClick={() => setActiveTab('Converted')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'Converted'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            Won ({tabCounts.won})
          </button>

          <button
            onClick={() => setActiveTab('Lost')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'Lost'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            Lost ({tabCounts.lost})
          </button>
        </div>

        {/* Minimal Search Input */}
        <div className="relative min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by ID, client or phone..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-8 bg-white border-2 border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

      </div>

      {/* 3. TABLE CARD CONTAINER (MATCHING UPLOADED PHOTO & CLIENTS MODULE) */}
      <div className="bg-white rounded-2xl border-2 border-slate-200/90 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center">
            <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-600">Loading enquiries...</div>
          </div>
        ) : filteredEnquiries.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-base font-bold text-slate-900 mb-1">No enquiries found</div>
            <p className="text-xs font-medium text-slate-500 mb-4">
              {searchQuery ? `No records matched "${searchQuery}"` : 'No leads under this tab.'}
            </p>
            <button
              onClick={() => { setEditingEnquiry(null); setIsFormOpen(true); }}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              + Create New Enquiry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y-2 divide-slate-100">
              <thead className="bg-slate-100/90 border-b-2 border-slate-200">
                <tr>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700 uppercase tracking-wide">ID</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700 uppercase tracking-wide">Client</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700 uppercase tracking-wide">Amount</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700 uppercase tracking-wide">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700 uppercase tracking-wide">Date</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredEnquiries.map((enquiry) => {
                  const isLost = enquiry.outcome === 'Lost';
                  const statusKey = isLost ? 'Lost' : enquiry.stage;
                  const statusConfig = STATUS_STYLES[statusKey] || STATUS_STYLES['New'];
                  const isMenuOpen = openStatusMenuId === enquiry.id;

                  return (
                    <tr 
                      key={enquiry.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* 1. ID */}
                      <td className="py-4 px-6 align-middle font-bold text-slate-900 whitespace-nowrap">
                        <button
                          onClick={() => { setActiveEnquiry(enquiry); setIsDetailOpen(true); }}
                          className="hover:text-blue-600 hover:underline cursor-pointer"
                          title={`Full Code: ${enquiry.enquiryNumber}`}
                        >
                          {formatDisplayId(enquiry.enquiryNumber)}
                        </button>
                      </td>

                      {/* 2. Client Name */}
                      <td className="py-4 px-6 align-middle font-bold text-slate-900">
                        <button
                          onClick={() => { setActiveEnquiry(enquiry); setIsDetailOpen(true); }}
                          className="hover:text-blue-600 hover:underline text-left cursor-pointer text-base"
                        >
                          {enquiry.clientName}
                        </button>
                        {enquiry.clientPhones?.[0] && (
                          <span className="block text-xs text-slate-500 font-mono font-medium mt-0.5">
                            {enquiry.clientPhones[0]}
                          </span>
                        )}
                      </td>

                      {/* 3. Amount / Budget */}
                      <td className="py-4 px-6 align-middle font-extrabold text-slate-900 whitespace-nowrap text-sm">
                        {enquiry.estimatedBudget ? `₹ ${enquiry.estimatedBudget.toLocaleString('en-IN')}` : '—'}
                      </td>

                      {/* 4. MINIMALIST ENQUIRY STATUS BADGE WITH INLINE INSTANT SWITCHER */}
                      <td className="py-4 px-6 align-middle whitespace-nowrap">
                        <div className="inline-block">
                          {/* Minimal Status Pill (Click to open quick switcher) */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleStatusMenu(e, enquiry)}
                            className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                            title="Click to instantly change status"
                          >
                            <span>{statusConfig.label}</span>
                            <ChevronDown size={12} className={`opacity-70 transition-transform ${openStatusMenuId === enquiry.id ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </td>

                      {/* 5. Date */}
                      <td className="py-4 px-6 align-middle text-slate-600 whitespace-nowrap text-sm font-medium">
                        {formatDisplayDate(enquiry.createdAt)}
                      </td>

                      {/* 6. SIMPLE & MINIMALISTIC VIEW / EDIT BUTTONS */}
                      <td className="py-4 px-6 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 text-xs font-bold">
                          
                          {/* Minimalist View Button */}
                          <button
                            onClick={() => { setActiveEnquiry(enquiry); setIsDetailOpen(true); }}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            View
                          </button>

                          <span className="text-slate-300 font-normal">|</span>

                          {/* Minimalist Edit Button */}
                          <button
                            onClick={() => { setEditingEnquiry(enquiry); setIsFormOpen(true); }}
                            className="text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                          >
                            Edit
                          </button>

                          <span className="text-slate-300 font-normal">|</span>

                          {/* Minimalist Delete Button */}
                          <button
                            onClick={() => handleDeleteEnquiry(enquiry)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-0.5 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3.1 STATUS CHANGE DROPDOWN (PORTALED TO DOCUMENT.BODY TO PREVENT OVERFLOW CLIPPING & TABLE SCROLLING) */}
      {mounted && openStatusMenuId && activeMenuEnquiry && menuPosition && createPortal(
        <div 
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPosition.top !== undefined ? `${menuPosition.top}px` : undefined,
            bottom: menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : undefined,
            left: `${menuPosition.left}px`,
          }}
          className="w-48 bg-white rounded-xl shadow-2xl border-2 border-slate-200 py-1.5 z-[9999] text-xs font-bold animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Set Stage:
          </div>
          
          {ENQUIRY_STAGES.map((stg) => {
            const isCurrent = activeMenuEnquiry.stage === stg && activeMenuEnquiry.outcome !== 'Lost';
            return (
              <button
                key={stg}
                type="button"
                onClick={() => handleQuickStatusChange(activeMenuEnquiry, stg)}
                className={`w-full px-3 py-1.5 text-left font-bold flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                  isCurrent ? 'text-blue-600 bg-blue-50/50' : 'text-slate-800'
                }`}
              >
                <span>{STATUS_STYLES[stg]?.label || stg}</span>
                {isCurrent && <Check size={14} className="text-blue-600" />}
              </button>
            );
          })}

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={() => {
              const currentEnquiry = activeMenuEnquiry;
              setOpenStatusMenuId(null);
              triggerButtonRef.current = null;
              setEnquiryToMarkLost(currentEnquiry);
              setIsLostModalOpen(true);
            }}
            className="w-full px-3 py-1.5 text-left font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer"
          >
            <XCircle size={14} />
            <span>Mark as Lost...</span>
          </button>
        </div>,
        document.body
      )}

      {/* 4. MODAL: CREATE / EDIT ENQUIRY */}
      {isFormOpen && (
        <EnquiryFormModal 
          enquiry={editingEnquiry}
          clients={clients}
          onClientCreated={handleClientCreated}
          onClose={() => { setIsFormOpen(false); setEditingEnquiry(null); }}
          onSuccess={(saved) => {
            handleOptimisticUpdate(saved);
            setIsFormOpen(false);
            setEditingEnquiry(null);
            fetchEnquiries();
          }}
        />
      )}

      {/* 5. MODAL: MARK AS LOST */}
      {isLostModalOpen && enquiryToMarkLost && (
        <MarkLostModal 
          enquiry={enquiryToMarkLost}
          onClose={() => { setIsLostModalOpen(false); setEnquiryToMarkLost(null); }}
          onSuccess={(updated) => {
            handleOptimisticUpdate(updated);
            setIsLostModalOpen(false);
            setEnquiryToMarkLost(null);
          }}
        />
      )}

      {/* 6. DRAWER / MODAL: VIEW DETAILS */}
      {isDetailOpen && activeEnquiry && (
        <EnquiryDetailModal 
          enquiry={activeEnquiry}
          onClose={() => setIsDetailOpen(false)}
          onEdit={() => { setIsDetailOpen(false); setEditingEnquiry(activeEnquiry); setIsFormOpen(true); }}
        />
      )}

    </div>
  );
}

// -------------------------------------------------------------
// MODAL: QUICK NEW CLIENT MODAL (Inside Enquiry Form)
// -------------------------------------------------------------

function QuickClientModal({
  isOpen,
  onClose,
  onClientCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: (client: Client) => void;
}) {
  const [name, setName] = useState('');
  const [clientType, setClientType] = useState<'BUSINESS' | 'INDIVIDUAL'>('BUSINESS');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Client or company name is required');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Primary phone number is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          clientType,
          contactPerson: contactPerson.trim() || undefined,
          phones: [phone.trim()],
          emails: email.trim() ? [email.trim()] : [],
          addresses: city.trim() ? [{ street: city.trim(), city: city.trim() }] : []
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create client');
      }

      onClientCreated(data);
      onClose();
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setCity('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-60 p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden border-2 border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Quick Register Client</h2>
            <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1">Add client account & auto-select in enquiry</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-9 h-9 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-red-50 border-2 border-red-200 rounded-xl text-xs sm:text-sm font-bold text-red-800 flex items-center gap-2">
            <AlertCircle size={18} className="text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
              Client / Firm Name *
            </label>
            <input 
              required
              type="text"
              placeholder="e.g. Acme Interiors or Rajesh Patel"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-sm sm:text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                Primary Phone *
              </label>
              <input 
                required
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-sm sm:text-base font-bold font-mono text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                Contact Person
              </label>
              <input 
                type="text"
                placeholder="e.g. Arun Sharma"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-sm sm:text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input 
                type="email"
                placeholder="e.g. contact@acme.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                City / Location
              </label>
              <input 
                type="text"
                placeholder="e.g. Bengaluru"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end items-center gap-3 border-t-2 border-slate-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="h-11 px-5 border-2 border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-700 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button 
              disabled={isSubmitting} 
              type="submit" 
              className="h-11 px-6 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 cursor-pointer disabled:opacity-60 shadow-xs transition-all"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              <span>{isSubmitting ? 'Saving...' : 'Save & Select Client'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MODAL: ENQUIRY CREATE / EDIT FORM
// -------------------------------------------------------------

function EnquiryFormModal({
  enquiry,
  clients,
  onClientCreated,
  onClose,
  onSuccess
}: {
  enquiry: Enquiry | null;
  clients: Client[];
  onClientCreated: (client: Client) => void;
  onClose: () => void;
  onSuccess: (e: Enquiry) => void;
}) {
  const [clientId, setClientId] = useState(enquiry?.clientId || (clients[0]?.id || ''));
  const [salespersonName, setSalespersonName] = useState(enquiry?.salespersonName || COMMON_SALESPERSONS[0].name);
  const [stage, setStage] = useState<EnquiryStage>(enquiry?.stage || 'New');
  
  const [estimatedBudget, setEstimatedBudget] = useState(enquiry?.estimatedBudget ? String(enquiry.estimatedBudget) : '');
  const [expectedTimeline, setExpectedTimeline] = useState(enquiry?.expectedTimeline || TIMELINES[0]);
  const [propertyType, setPropertyType] = useState(enquiry?.propertyType || PROPERTY_TYPES[0]);
  const [nextFollowUp, setNextFollowUp] = useState(
    enquiry?.nextFollowUp ? new Date(enquiry.nextFollowUp).toISOString().slice(0, 10) : ''
  );
  const [notes, setNotes] = useState(enquiry?.notes || '');

  // Scope Items
  const [items, setItems] = useState<EnquiryItem[]>(() => {
    if (enquiry?.items && enquiry.items.length > 0) return enquiry.items;
    return [{ description: 'Custom Modular Unit', quantity: 1, expectedDimensions: '', materialPreference: '', clientComment: '' }];
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);

  const handleItemChange = (idx: number, field: keyof EnquiryItem, value: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, expectedDimensions: '', materialPreference: '', clientComment: '' }]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      alert('Please select or create a client account');
      return;
    }

    setIsSaving(true);
    const payload = {
      clientId,
      salespersonName,
      stage,
      estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : null,
      expectedTimeline,
      propertyType,
      nextFollowUp: nextFollowUp ? new Date(nextFollowUp).toISOString() : null,
      notes: notes.trim(),
      enteredByName: 'Sales Coordinator',
      items: items.filter(it => it.description.trim()).map(it => ({
        description: it.description.trim(),
        quantity: Number(it.quantity) || 1,
        expectedDimensions: it.expectedDimensions?.trim() || null,
        materialPreference: it.materialPreference?.trim() || null,
        clientComment: it.clientComment?.trim() || null
      }))
    };

    try {
      const url = enquiry ? `/api/enquiries/${enquiry.id}` : '/api/enquiries';
      const method = enquiry ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save enquiry');
      onSuccess(data);
    } catch (err: any) {
      alert(err.message || 'Error saving lead');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 font-sans">
        <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col overflow-hidden border-2 border-slate-200 max-h-[92vh]">
          
          {/* Header */}
          <div className="px-6 sm:px-8 py-5 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50/80">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {enquiry ? `Edit Enquiry (${enquiry.enquiryNumber})` : 'New Sales Enquiry'}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1">Capture client requirements & unpriced scope</p>
            </div>
            <button 
              onClick={onClose} 
              className="w-9 h-9 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 overflow-y-auto">
            
            {/* Client Picker with "+ Quick Add New Client" */}
            <div className="bg-slate-50 p-4.5 rounded-2xl border-2 border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Client Account *
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickClientOpen(true)}
                  className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  <span>+ Quick Add New Client</span>
                </button>
              </div>

              <select 
                required
                value={clientId} 
                onChange={e => setClientId(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-sm sm:text-base font-bold text-slate-900 bg-white focus:border-blue-600 focus:outline-none cursor-pointer transition-colors"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.clientCode ? `[${c.clientCode}] ` : ''}{c.name} {c.phones?.[0] ? `(${c.phones[0]})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Salesperson, Stage & Budget */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Assigned Rep *
                </label>
                <select 
                  value={salespersonName} 
                  onChange={e => setSalespersonName(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-slate-200 px-3.5 text-sm sm:text-base font-bold text-slate-900 bg-white focus:border-blue-600 focus:outline-none transition-colors"
                >
                  {COMMON_SALESPERSONS.map(sp => (
                    <option key={sp.id} value={sp.name}>{sp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Status Stage
                </label>
                <select 
                  value={stage} 
                  onChange={e => setStage(e.target.value as any)}
                  className="w-full h-12 rounded-xl border-2 border-slate-200 px-3.5 text-sm sm:text-base font-bold text-slate-900 bg-white focus:border-blue-600 focus:outline-none transition-colors"
                >
                  <option value="New">New</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Quoted">Quoted</option>
                  <option value="Converted">Won (Converted)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Estimated Budget (₹)
                </label>
                <input 
                  type="number"
                  placeholder="e.g. 85000"
                  value={estimatedBudget}
                  onChange={e => setEstimatedBudget(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-sm sm:text-base font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Timeline & Follow-up */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Timeline / Urgency
                </label>
                <select 
                  value={expectedTimeline} 
                  onChange={e => setExpectedTimeline(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-slate-200 px-3.5 text-sm sm:text-base font-bold text-slate-900 bg-white focus:border-blue-600 focus:outline-none transition-colors"
                >
                  {TIMELINES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Next Follow-up Date
                </label>
                <input 
                  type="date"
                  value={nextFollowUp}
                  onChange={e => setNextFollowUp(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-sm sm:text-base font-bold text-slate-900 bg-white focus:border-blue-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                Client Remarks / Notes
              </label>
              <textarea 
                rows={2}
                placeholder="Key requirements, finishes, site details..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 p-3.5 text-sm sm:text-base font-medium text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Scope Items */}
            <div className="pt-1">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                  Line Items ({items.length})
                </span>
                <button 
                  type="button" 
                  onClick={handleAddItem}
                  className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus size={16} strokeWidth={2.5} /> Add Item
                </button>
              </div>

              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-200 space-y-2.5">
                    <div className="flex gap-2.5">
                      <input 
                        required
                        type="text" 
                        placeholder="Item description (e.g. Conference Table)"
                        value={item.description}
                        onChange={e => handleItemChange(idx, 'description', e.target.value)}
                        className="flex-1 h-11 rounded-xl border-2 border-slate-200 px-3.5 text-sm sm:text-base font-bold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:outline-none transition-colors"
                      />
                      <input 
                        type="number" 
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-20 h-11 rounded-xl border-2 border-slate-200 px-2 text-sm sm:text-base font-bold text-slate-900 bg-white text-center focus:border-blue-600 focus:outline-none transition-colors"
                      />
                      {items.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveItem(idx)}
                          className="h-11 w-11 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer transition-colors"
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <input 
                        type="text" 
                        placeholder="Dimensions (e.g. 2400x1200mm)"
                        value={item.expectedDimensions || ''}
                        onChange={e => handleItemChange(idx, 'expectedDimensions', e.target.value)}
                        className="h-10 rounded-xl border border-slate-300 px-3 text-xs sm:text-sm font-semibold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:outline-none transition-colors"
                      />
                      <input 
                        type="text" 
                        placeholder="Material preference (e.g. Teak veneer, MR ply)"
                        value={item.materialPreference || ''}
                        onChange={e => handleItemChange(idx, 'materialPreference', e.target.value)}
                        className="h-10 rounded-xl border border-slate-300 px-3 text-xs sm:text-sm font-semibold text-slate-900 bg-white placeholder:text-slate-400 placeholder:font-normal focus:border-blue-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 flex justify-end items-center gap-3 border-t-2 border-slate-100">
              <button 
                type="button" 
                onClick={onClose} 
                className="h-12 px-6 border-2 border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-700 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button 
                disabled={isSaving} 
                type="submit" 
                className="h-12 px-8 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 cursor-pointer disabled:opacity-60 shadow-xs transition-all"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                <span>{isSaving ? 'Saving...' : (enquiry ? 'Update Enquiry' : 'Save Enquiry')}</span>
              </button>
            </div>
          </form>

        </div>
      </div>

      <QuickClientModal 
        isOpen={isQuickClientOpen}
        onClose={() => setIsQuickClientOpen(false)}
        onClientCreated={(newClient) => {
          onClientCreated(newClient);
          setClientId(newClient.id);
        }}
      />
    </>
  );
}

// -------------------------------------------------------------
// MODAL: MARK AS LOST
// -------------------------------------------------------------

function MarkLostModal({
  enquiry,
  onClose,
  onSuccess
}: {
  enquiry: Enquiry;
  onClose: () => void;
  onSuccess: (updated: Enquiry) => void;
}) {
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0]);
  const [lostNote, setLostNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Instant optimistic update
    const previous = { ...enquiry };
    const optimisticUpdated: Enquiry = {
      ...enquiry,
      outcome: 'Lost',
      lostReason,
      lostNote: lostNote.trim(),
      lostAtStage: enquiry.stage
    };
    onSuccess(optimisticUpdated);

    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: 'Lost',
          lostReason,
          lostNote: lostNote.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        onSuccess(previous);
        throw new Error(data.error || 'Failed to mark deal as lost');
      }
      onSuccess(data);
    } catch (err: any) {
      alert(err.message || 'Error marking deal as lost');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border-2 border-slate-200">
        <div className="px-6 py-5 border-b-2 border-slate-100 flex justify-between items-center bg-red-50/60">
          <div>
            <h2 className="text-xl font-extrabold text-red-950">Mark Enquiry as Lost</h2>
            <p className="text-xs sm:text-sm font-medium text-red-700 mt-1">Captures reason for future reporting</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-red-100 text-red-800 flex items-center justify-center cursor-pointer transition-colors">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
              Primary Reason *
            </label>
            <select 
              value={lostReason} 
              onChange={e => setLostReason(e.target.value)}
              className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-sm sm:text-base font-bold text-slate-900 focus:border-red-500 focus:outline-none transition-colors"
            >
              {LOST_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
              Notes
            </label>
            <textarea 
              rows={3}
              placeholder="Client remarks or competitor details..."
              value={lostNote}
              onChange={e => setLostNote(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 p-3.5 text-sm sm:text-base font-medium text-slate-900 focus:border-red-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="pt-3 flex justify-end items-center gap-3 border-t-2 border-slate-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="h-11 px-5 text-sm font-bold text-slate-700 hover:bg-slate-100 border-2 border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              disabled={isSaving}
              type="submit" 
              className="h-11 px-6 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              <span>Confirm Lost</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// DRAWER / MODAL: VIEW DETAILS
// -------------------------------------------------------------

function EnquiryDetailModal({
  enquiry,
  onClose,
  onEdit
}: {
  enquiry: Enquiry;
  onClose: () => void;
  onEdit: () => void;
}) {
  const primaryPhone = enquiry.clientPhones?.[0];
  const cleanPhoneForWa = primaryPhone ? primaryPhone.replace(/[^\d]/g, '') : null;
  const isLost = enquiry.outcome === 'Lost';
  const statusKey = isLost ? 'Lost' : enquiry.stage;
  const statusConfig = STATUS_STYLES[statusKey] || STATUS_STYLES['New'];

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 font-sans">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden border-2 border-slate-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs sm:text-sm font-bold px-2.5 py-0.5 bg-slate-200 text-slate-800 rounded-md">
                {enquiry.enquiryNumber}
              </span>
              <span className={`px-3.5 py-1 rounded-full text-xs sm:text-sm font-bold ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                {statusConfig.label}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight">{enquiry.clientName}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Estimated Budget</div>
              <div className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                {enquiry.estimatedBudget ? `₹ ${enquiry.estimatedBudget.toLocaleString('en-IN')}` : 'Not Specified'}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Assigned Rep</div>
              <div className="text-base sm:text-lg font-bold text-slate-900 mt-1">{enquiry.salespersonName || 'Unassigned'}</div>
            </div>
          </div>

          {/* Contact */}
          {primaryPhone && (
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Contact Phone</div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-0.5">{primaryPhone}</div>
              </div>
              {cleanPhoneForWa && (
                <a 
                  href={`https://wa.me/${cleanPhoneForWa}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <MessageCircle size={15} />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          )}

          {/* Scope Items */}
          <div>
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide mb-2">
              Scope Items ({enquiry.items.length})
            </div>
            <div className="space-y-2">
              {enquiry.items.map((it, idx) => (
                <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-200 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold text-slate-900 text-sm sm:text-base">{it.description}</span>
                    {it.expectedDimensions && <span className="text-slate-500 ml-2 text-xs sm:text-sm font-medium">({it.expectedDimensions})</span>}
                  </div>
                  <span className="font-bold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200 text-xs sm:text-sm">
                    Qty: {it.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {enquiry.notes && (
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">Remarks</div>
              <div className="text-sm text-slate-700 bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 font-medium leading-relaxed">
                "{enquiry.notes}"
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-4 border-t-2 border-slate-100 flex justify-end gap-3 bg-slate-50/80">
          <button 
            onClick={onEdit} 
            className="h-11 px-6 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm sm:text-base rounded-xl cursor-pointer shadow-xs transition-all"
          >
            Edit Enquiry
          </button>
          <button 
            onClick={onClose} 
            className="h-11 px-6 border-2 border-slate-200 text-slate-700 font-bold text-sm sm:text-base rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
