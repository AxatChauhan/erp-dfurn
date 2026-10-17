'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import './enquiries.css';
import '../clients/clients.css';
import { 
  Plus, 
  ChevronDown, 
  Calendar, 
  Briefcase, 
  Check, 
  Trash2, 
  Lock, 
  ArrowRight, 
  Search
} from 'lucide-react';
import { 
  formatDate, 
  currentFiscalYearKey, 
  fiscalYearOf,
  MONTH_NAMES 
} from '@/lib/dates';
import QuickEnquiryWizardModal from './components/QuickEnquiryWizardModal';
import EnquiryDetailModal from './components/EnquiryDetailModal';
import { toast } from 'sonner';

interface EnquiriesClientProps {
  initialEnquiries: any[];
  initialKpis: any;
  initialTallies: any;
  categories: any[];
  sourceCategories: any[];
  salespersons: any[];
  clients: any[];
  lostReasons: any[];
}

const BUCKETS = ['New', 'Qualified', 'Quoted', 'Converted', 'Lost'] as const;

const STATUS_CLASS: Record<string, string> = {
  New: 'neutral',
  Qualified: 'active',
  Quoted: 'quoted',
  Converted: 'done',
  Lost: 'bad'
};

const rupees = (n: number | null | undefined) =>
  '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function EnquiriesClient({
  initialEnquiries,
  initialKpis,
  initialTallies,
  categories,
  sourceCategories,
  salespersons,
  clients,
  lostReasons,
}: EnquiriesClientProps) {
  // Master enquiry dataset (persisted on client, updated via background sync)
  const [allEnquiries, setAllEnquiries] = useState<any[]>(initialEnquiries || []);

  // Time & Salesperson Filters
  const defaultFY = currentFiscalYearKey();
  const [filterFY, setFilterFY] = useState<string>(defaultFY);
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterBucket, setFilterBucket] = useState<string>('');
  const [filterSp, setFilterSp] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Popover menus
  const [periodOpen, setPeriodOpen] = useState(false);
  const [spOpen, setSpOpen] = useState(false);

  // Smooth accordion row expansion (matching Clients module)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [animPhase, setAnimPhase] = useState<'opening' | 'closing' | null>(null);
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modals
  const [quickWizardOpen, setQuickWizardOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeEnquiryId, setActiveEnquiryId] = useState<string | null>(null);

  const periodRef = useRef<HTMLDivElement>(null);
  const spRef = useRef<HTMLDivElement>(null);

  // Sync initialEnquiries when server props change
  useEffect(() => {
    if (initialEnquiries && initialEnquiries.length > 0) {
      setAllEnquiries(initialEnquiries);
    }
  }, [initialEnquiries]);

  // Clean up animation timer on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
      }
    };
  }, []);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setPeriodOpen(false);
      }
      if (spRef.current && !spRef.current.contains(e.target as Node)) {
        setSpOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Background refresh data from API (only on mutations, NOT on filter changes)
  const refreshData = async () => {
    try {
      const res = await fetch('/api/enquiries');
      const data = await res.json();
      if (data.enquiries) {
        setAllEnquiries(data.enquiries);
      }
    } catch (err) {
      console.error('Error fetching enquiries:', err);
    }
  };

  // -------------------------------------------------------------
  // INSTANT IN-MEMORY REACTIVE FILTERING (< 1ms UI response)
  // -------------------------------------------------------------

  // 1. Time-filtered enquiries (FY, Month, exact Date)
  const timeFilteredEnquiries = useMemo(() => {
    if (filterDate) {
      return allEnquiries.filter(e => {
        const d = e.createdAt ? (typeof e.createdAt === 'string' ? e.createdAt.slice(0, 10) : new Date(e.createdAt).toISOString().slice(0, 10)) : '';
        return d === filterDate;
      });
    }
    return allEnquiries.filter(e => {
      if (!e.createdAt) return true;
      if (filterFY !== 'all') {
        const fy = fiscalYearOf(e.createdAt);
        if (fy.key !== filterFY) return false;
      }
      if (filterMonth !== '') {
        const m = new Date(e.createdAt).getMonth();
        if (m !== Number(filterMonth)) return false;
      }
      return true;
    });
  }, [allEnquiries, filterDate, filterFY, filterMonth]);

  // 2. Salesperson-scoped enquiries (narrows KPIs and status chip counts)
  const scopedEnquiries = useMemo(() => {
    return timeFilteredEnquiries.filter(e => {
      if (!filterSp) return true;
      if (filterSp === '__none') return !e.salespersonId;
      return e.salespersonId === filterSp;
    });
  }, [timeFilteredEnquiries, filterSp]);

  // 3. Tallies for status chips
  const tallies = useMemo(() => {
    const counts: Record<string, number> = {
      all: scopedEnquiries.length,
      New: 0,
      Qualified: 0,
      Quoted: 0,
      Converted: 0,
      Lost: 0
    };
    scopedEnquiries.forEach(e => {
      const bucket = e.outcome === 'Lost' ? 'Lost' : (e.stage || 'New');
      if (bucket in counts) {
        counts[bucket]++;
      }
    });
    return counts;
  }, [scopedEnquiries]);

  // 4. 4 Time-scoped KPI Cards (never narrowed by status chips per Sir's rule)
  const kpis = useMemo(() => {
    const totalInView = scopedEnquiries.length;
    const everQualified = scopedEnquiries.filter(e => e.stage !== 'New').length;
    const qualificationRate = totalInView > 0 ? Math.round((everQualified / totalInView) * 100) : 0;
    const qualificationRateFormatted = totalInView > 0 ? `${qualificationRate}%` : '–';
    
    // Open opportunity value: strictly New, Qualified, and Quoted (excluding Lost and Converted)
    const openOpportunityValue = scopedEnquiries
      .filter(e => e.outcome !== 'Lost' && (e.stage === 'New' || e.stage === 'Qualified' || e.stage === 'Quoted'))
      .reduce((sum, e) => sum + (e.opportunityValue || 0), 0);

    // Top Category
    const catCounts: Record<string, number> = {};
    scopedEnquiries.forEach(e => {
      const name = e.categoryName || e.category?.name;
      if (name) catCounts[name] = (catCounts[name] || 0) + 1;
    });
    let topCategoryName = '–';
    let topCategoryCount = 0;
    Object.entries(catCounts).forEach(([name, count]) => {
      if (count > topCategoryCount) {
        topCategoryName = name;
        topCategoryCount = count;
      }
    });

    // Top Source
    const srcCounts: Record<string, number> = {};
    scopedEnquiries.forEach(e => {
      const name = e.sourceCategory || e.sourceName;
      if (name) srcCounts[name] = (srcCounts[name] || 0) + 1;
    });
    let topSourceName = '–';
    let topSourceCount = 0;
    Object.entries(srcCounts).forEach(([name, count]) => {
      if (count > topSourceCount) {
        topSourceName = name;
        topSourceCount = count;
      }
    });

    return {
      qualificationRate,
      qualificationRateFormatted,
      totalInView,
      openOpportunityValue,
      topCategoryName,
      topCategoryCount,
      topSourceName,
      topSourceCount,
    };
  }, [scopedEnquiries]);

  // 5. Final Visible Enquiries (narrowed by Status Chip and Live Search)
  const visibleEnquiries = useMemo(() => {
    let list = scopedEnquiries;
    if (filterBucket) {
      list = list.filter(e => {
        const bucket = e.outcome === 'Lost' ? 'Lost' : (e.stage || 'New');
        return bucket === filterBucket;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(e => {
        return (
          (e.clientName || '').toLowerCase().includes(q) ||
          (e.code || e.enquiryNumber || '').toLowerCase().includes(q) ||
          (e.clientPhones || []).some((p: string) => p.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }, [scopedEnquiries, filterBucket, search]);

  // Salesperson tally counts
  const tallyData = useMemo(() => {
    const counts: Record<string, number> = {};
    let unassigned = 0;
    timeFilteredEnquiries.forEach(e => {
      if (e.salespersonId) counts[e.salespersonId] = (counts[e.salespersonId] || 0) + 1;
      else unassigned++;
    });
    return { counts, unassigned };
  }, [timeFilteredEnquiries]);

  // Butter-Smooth Accordion Row Toggle (matching Clients module)
  const toggleRow = (id: string) => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }

    if (expandedId === id) {
      if (animPhase === 'closing') return;
      setAnimPhase('closing');
      animTimerRef.current = setTimeout(() => {
        setExpandedId(null);
        setAnimPhase(null);
        animTimerRef.current = null;
      }, 280);
    } else if (expandedId) {
      setAnimPhase('closing');
      animTimerRef.current = setTimeout(() => {
        setExpandedId(id);
        setAnimPhase('opening');
        animTimerRef.current = setTimeout(() => {
          setAnimPhase(null);
          animTimerRef.current = null;
        }, 380);
      }, 200);
    } else {
      setExpandedId(id);
      setAnimPhase('opening');
      animTimerRef.current = setTimeout(() => {
        setAnimPhase(null);
        animTimerRef.current = null;
      }, 380);
    }
  };

  const periodDirty = !!filterDate || filterMonth !== '' || filterFY !== defaultFY;
  const filterDirty = periodDirty || !!filterBucket || !!filterSp || !!search;

  const handleClearFilters = () => {
    setFilterFY(defaultFY);
    setFilterMonth('');
    setFilterDate('');
    setFilterBucket('');
    setFilterSp('');
    setSearch('');
    setExpandedId(null);
  };

  // Period Label
  const periodLabel = () => {
    if (filterDate) return formatDate(filterDate);
    const fy = filterFY === 'all' ? 'All years' : `FY ${filterFY}`;
    return filterMonth !== '' ? `${fy} · ${MONTH_NAMES[Number(filterMonth)]}` : fy;
  };

  // Salesperson Label
  const spLabel = () => {
    if (!filterSp) return 'All Sales team';
    if (filterSp === '__none') return 'Unassigned';
    const found = salespersons.find(s => s.id === filterSp);
    return found ? found.name : 'Salesperson';
  };

  // Handle row deletion guard check
  const handleDeleteRow = async (e: any, ev: React.MouseEvent) => {
    ev.stopPropagation();
    const lockReason = (e.stage === 'Quoted' || e.stage === 'Converted')
      ? 'it has a quotation'
      : e.hasCommunication
        ? 'communication has been logged on it'
        : '';

    if (lockReason) {
      toast.error(`This enquiry cannot be deleted: ${lockReason}.`);
      return;
    }

    if (!confirm(`Delete enquiry "${e.code || e.enquiryNumber}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/enquiries/${e.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete');
      }
      toast.success('Enquiry deleted');
      refreshData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="clt-container" style={{ padding: '24px 32px', maxWidth: 1720, margin: '0 auto' }}>
      {/* 4 Time-Scoped KPI Cards matching Image 1 */}
      <div className="insights-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Card 1: Qualification Rate */}
        <div className="insight-card">
          <div className="insight-label">QUALIFICATION RATE</div>
          <div className="insight-value">{kpis?.qualificationRateFormatted || (kpis?.qualificationRate != null ? `${kpis.qualificationRate}%` : '–')}</div>
          <div className="insight-sub">{kpis?.totalInView != null ? `${kpis.totalInView} in view` : '–'}</div>
        </div>

        {/* Card 2: Open Opportunity Value (exact from Image 1) */}
        <div className="insight-card">
          <div className="insight-label">OPEN OPPORTUNITY VALUE</div>
          <div className="insight-value">{rupees(kpis?.openOpportunityValue ?? 0)}</div>
          <div className="insight-sub">New, qualified and quoted</div>
        </div>

        {/* Card 3: Top Category */}
        <div className="insight-card">
          <div className="insight-label">TOP CATEGORY</div>
          <div className="insight-value" style={{ fontSize: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {kpis?.topCategoryName || '–'}
          </div>
          <div className="insight-sub">
            {kpis?.topCategoryCount ? `${kpis.topCategoryCount} enquiries` : 'No category data'}
          </div>
        </div>

        {/* Card 4: Top Source */}
        <div className="insight-card">
          <div className="insight-label">TOP SOURCE</div>
          <div className="insight-value" style={{ fontSize: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {kpis?.topSourceName || '–'}
          </div>
          <div className="insight-sub">
            {kpis?.topSourceCount ? `${kpis.topSourceCount} enquiries` : 'No source data'}
          </div>
        </div>
      </div>

      {/* Row 1: Status Chips on Left, Period + Sales Team on Right */}
      <div className="clt-filterbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div className="clt-filters" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Status Chips */}
          <div
            className={`segment-chip all ${!filterBucket ? 'selected' : ''}`}
            onClick={() => { setFilterBucket(''); setExpandedId(null); }}
            style={{
              background: !filterBucket ? '#000000' : '#FFFFFF',
              color: !filterBucket ? '#FFFFFF' : '#333333',
              borderColor: !filterBucket ? '#000000' : '#DCD5C4',
              cursor: 'pointer'
            }}
          >
            <span className="name">All</span>
            <span className="count" style={{ background: !filterBucket ? '#333333' : '#F4F1EC', color: !filterBucket ? '#FFFFFF' : '#8B8778' }}>
              {tallies?.all ?? scopedEnquiries.length}
            </span>
          </div>

          {BUCKETS.map(b => (
            <div
              key={b}
              className={`segment-chip ${filterBucket === b ? 'selected' : ''}`}
              onClick={() => { setFilterBucket(b); setExpandedId(null); }}
              style={{
                background: filterBucket === b ? '#000000' : '#FFFFFF',
                color: filterBucket === b ? '#FFFFFF' : '#333333',
                borderColor: filterBucket === b ? '#000000' : '#DCD5C4',
                cursor: 'pointer'
              }}
            >
              <span className="name">{b}</span>
              <span className="count" style={{ background: filterBucket === b ? '#333333' : '#F4F1EC', color: filterBucket === b ? '#FFFFFF' : '#8B8778' }}>
                {tallies?.[b] ?? 0}
              </span>
            </div>
          ))}

          {/* Clear Filters */}
          {filterDirty && (
            <button
              type="button"
              className="clt-clear"
              onClick={handleClearFilters}
              style={{ background: 'none', border: 'none', color: '#8B8778', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 10px' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Right side pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Period Picker Popover */}
          <div className="clt-cp" ref={periodRef} style={{ position: 'relative' }}>
            <div
              className={`segment-chip clt-cp-btn ${periodDirty ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => { setPeriodOpen(!periodOpen); setSpOpen(false); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 20,
                background: '#FFFFFF',
                border: '1px solid #DCD5C4',
                fontSize: 13,
                fontWeight: 600,
                color: '#333333',
                cursor: 'pointer'
              }}
            >
              <Calendar size={15} style={{ color: '#8B8778' }} />
              <span className="name">{periodLabel()}</span>
              <ChevronDown size={14} style={{ color: '#8B8778' }} />
            </div>

            {periodOpen && (
              <div
                className={`clt-cp-pop enq-period-pop ${filterDate ? 'dated' : ''}`}
                style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100 }}
              >
                {/* FY Group */}
                <div className="enq-pp-group">
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 6 }}>
                    Financial Year
                  </div>
                  <div className="pill-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[{ value: 'all', label: 'All years' }, { value: defaultFY, label: `FY ${defaultFY}` }].map(fy => (
                      <button
                        key={fy.value}
                        type="button"
                        onClick={() => { setFilterFY(fy.value); setFilterDate(''); }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 16,
                          border: filterFY === fy.value && !filterDate ? '1.5px solid #FF7700' : '1px solid #E5DFD3',
                          background: filterFY === fy.value && !filterDate ? 'rgba(255,119,0,0.1)' : '#FFFFFF',
                          color: filterFY === fy.value && !filterDate ? '#FF7700' : '#333333',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {fy.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Month Group */}
                <div className="enq-pp-group">
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 6 }}>
                    Month
                  </div>
                  <div className="pill-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[{ value: '', label: 'All' }, ...MONTH_NAMES.map((m, i) => ({ value: String(i), label: m }))].map(mo => (
                      <button
                        key={mo.label}
                        type="button"
                        onClick={() => { setFilterMonth(mo.value); setFilterDate(''); }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 16,
                          border: filterMonth === mo.value && !filterDate ? '1.5px solid #FF7700' : '1px solid #E5DFD3',
                          background: filterMonth === mo.value && !filterDate ? 'rgba(255,119,0,0.1)' : '#FFFFFF',
                          color: filterMonth === mo.value && !filterDate ? '#FF7700' : '#333333',
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {mo.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exact Date Group */}
                <div className="enq-pp-group">
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 6 }}>
                    Or One Exact Day
                  </div>
                  <div className="enq-pp-date" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="date"
                      className="field-input"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      style={{ height: 36, width: 170, fontSize: 13 }}
                    />
                    {filterDate && (
                      <button
                        type="button"
                        className="clt-clear"
                        onClick={() => setFilterDate('')}
                        style={{ background: 'none', border: 'none', color: '#FF7700', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Clear day
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Salesperson Filter Popover */}
          <div className="clt-cp" ref={spRef} style={{ position: 'relative' }}>
            <div
              className={`segment-chip clt-cp-btn ${filterSp ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => { setSpOpen(!spOpen); setPeriodOpen(false); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 20,
                background: '#FFFFFF',
                border: '1px solid #DCD5C4',
                fontSize: 13,
                fontWeight: 600,
                color: '#333333',
                cursor: 'pointer'
              }}
            >
              <Briefcase size={15} style={{ color: '#8B8778' }} />
              <span className="name">{spLabel()}</span>
              {filterSp && (
                <span className="count" style={{ background: '#F4F1EC', color: '#8B8778', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>
                  {filterSp === '__none' ? tallyData.unassigned : (tallyData.counts[filterSp] || 0)}
                </span>
              )}
              <ChevronDown size={14} style={{ color: '#8B8778' }} />
            </div>

            {spOpen && (
              <div
                className="clt-cp-pop"
                style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 240, maxHeight: 280, overflowY: 'auto', zIndex: 100 }}
              >
                <div className="clt-cp-list">
                  <button
                    type="button"
                    className={`clt-cp-opt ${!filterSp ? 'on' : ''}`}
                    onClick={() => { setFilterSp(''); setSpOpen(false); setExpandedId(null); }}
                  >
                    <span>All Sales team</span>
                    <span className="count">{timeFilteredEnquiries.length}</span>
                    {!filterSp && <Check size={14} />}
                  </button>

                  {salespersons.map(sp => (
                    <button
                      key={sp.id}
                      type="button"
                      className={`clt-cp-opt ${filterSp === sp.id ? 'on' : ''}`}
                      onClick={() => { setFilterSp(sp.id); setSpOpen(false); setExpandedId(null); }}
                    >
                      <span>{sp.name}</span>
                      <span className="count">{tallyData.counts[sp.id] || 0}</span>
                      {filterSp === sp.id && <Check size={14} />}
                    </button>
                  ))}

                  {tallyData.unassigned > 0 && (
                    <button
                      type="button"
                      className={`clt-cp-opt ${filterSp === '__none' ? 'on' : ''}`}
                      onClick={() => { setFilterSp('__none'); setSpOpen(false); setExpandedId(null); }}
                    >
                      <span>Unassigned</span>
                      <span className="count">{tallyData.unassigned}</span>
                      {filterSp === '__none' && <Check size={14} />}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Search Input and + Quick Enquiry button side-by-side (matching Image 1) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#A39B8B' }} />
          <input
            type="text"
            className="field-input"
            placeholder="Search client, code or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              paddingLeft: 34,
              height: 38,
              borderRadius: 8,
              fontSize: 13,
              background: '#FFFFFF',
              border: '1px solid #DCD5C4'
            }}
          />
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => setQuickWizardOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 38,
            padding: '0 18px',
            borderRadius: 8,
            background: '#FF7700',
            border: 'none',
            color: '#FFFFFF',
            fontSize: 13.5,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(255,119,0,0.2)'
          }}
        >
          <Plus size={16} /> Quick Enquiry
        </button>
      </div>

      {/* Enquiries Fixed Table */}
      <div className="clt-table-wrap" style={{ background: '#FFFFFF', border: '1px solid #E5DFD3', borderRadius: 10, overflow: 'hidden' }}>
        {visibleEnquiries.length > 0 ? (
          <table className="clt-table clt-fixed">
            <colgroup>
              <col className="we-no" />
              <col className="we-client" />
              <col className="we-cat" />
              <col className="we-status" />
              <col className="we-sp" />
              <col className="we-date" />
              <col className="we-chev" />
            </colgroup>
            <thead>
              <tr>
                <th className="clt-no">#</th>
                <th>Client</th>
                <th>Category</th>
                <th>Status</th>
                <th>Salesperson</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleEnquiries.map((e, idx) => {
                const isExpanded = expandedId === e.id;
                const isClosing = isExpanded && animPhase === 'closing';
                const isRowOpen = isExpanded && !isClosing;
                const bucket = e.outcome === 'Lost' ? 'Lost' : (e.stage || 'New');
                const lockReason = (e.stage === 'Quoted' || e.stage === 'Converted')
                  ? 'it has a quotation'
                  : e.hasCommunication
                    ? 'communication has been logged on it'
                    : '';

                return (
                  <React.Fragment key={e.id}>
                    {/* Primary Row */}
                    <tr
                      className={`clt-row ${isRowOpen ? 'open' : ''}`}
                      onClick={() => toggleRow(e.id)}
                      style={{
                        cursor: 'pointer',
                        background: isRowOpen ? '#F4F1EC' : 'transparent',
                        boxShadow: isRowOpen ? 'inset 3px 0 0 #000000' : 'none',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td className="clt-no" style={{ color: '#8B8778', paddingLeft: 16 }}>{idx + 1}</td>
                      <td className="clt-name">
                        <div style={{ fontWeight: 600, color: '#111111' }}>{e.clientName}</div>
                        <div className="enq-code-sub" style={{ fontSize: 11.5, color: '#A39B8B', marginTop: 2 }}>{e.code || e.enquiryNumber}</div>
                      </td>
                      <td style={{ color: '#333333' }}>{e.categoryName || <span className="clt-faint">–</span>}</td>
                      <td>
                        <span className={`cd-st cd-st-${STATUS_CLASS[bucket] || 'neutral'}`}>
                          <i /> {bucket}
                        </span>
                      </td>
                      <td style={{ color: '#333333' }}>{e.salespersonName || <span className="clt-faint">–</span>}</td>
                      <td style={{ color: '#333333' }}>{formatDate(e.createdAt)}</td>
                      <td className="clt-chev" style={{ paddingRight: 16 }}>
                        <ChevronDown
                          size={16}
                          style={{
                            transform: isRowOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s ease',
                            color: '#8B8778'
                          }}
                        />
                      </td>
                    </tr>

                    {/* Accordion Row Expansion (.clt-x-row) with smooth animation */}
                    {isExpanded && (
                      <>
                        <tr className={`clt-x-row ${animPhase || ''}`} style={{ background: '#F4F1EC', boxShadow: 'inset 3px 0 0 #000000' }}>
                          <td style={{ padding: 0 }} />
                          {/* Client Detail */}
                          <td style={{ verticalAlign: 'top', padding: 0 }}>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv" style={{ marginBottom: 10 }}>
                                  <div className="clt-kv-l" style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 2 }}>PHONE</div>
                                  <div className="clt-kv-v" style={{ fontSize: 13.5, color: '#111111' }}>{e.clientPhones?.[0] || '–'}</div>
                                </div>
                                <div className="clt-kv">
                                  <div className="clt-kv-l" style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 2 }}>EMAIL</div>
                                  <div className="clt-kv-v" style={{ fontSize: 13.5, color: '#111111' }}>{e.clientEmails?.[0] || '–'}</div>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category / Source Detail */}
                          <td style={{ verticalAlign: 'top', padding: 0 }}>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv">
                                  <div className="clt-kv-l" style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 2 }}>SOURCE</div>
                                  <div className="clt-kv-v" style={{ fontSize: 13.5, color: '#111111' }}>{e.sourceCategory || '–'}</div>
                                </div>
                                {e.sourceName && (
                                  <div className="clt-kv" style={{ marginTop: 10 }}>
                                    <div className="clt-kv-l" style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 2 }}>REFERRED BY</div>
                                    <div className="clt-kv-v" style={{ fontSize: 13.5, color: '#111111' }}>{e.sourceName}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Status / Products / Opportunity */}
                          <td style={{ verticalAlign: 'top', padding: 0 }}>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv" style={{ marginBottom: 10 }}>
                                  <div className="clt-kv-l" style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 2 }}>PRODUCTS</div>
                                  <div className="clt-kv-v" style={{ fontSize: 13.5, color: '#111111' }}>
                                    {e.items?.length ? `${e.items.length} product${e.items.length > 1 ? 's' : ''}` : 'No products'}
                                  </div>
                                </div>
                                <div className="clt-kv">
                                  <div className="clt-kv-l" style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 2 }}>OPPORTUNITY</div>
                                  <div className="clt-kv-v" style={{ fontSize: 13.5, color: '#111111', fontWeight: 600 }}>
                                    {e.opportunityValue != null ? rupees(e.opportunityValue) : '–'}
                                  </div>
                                </div>
                                {e.outcome === 'Lost' && (
                                  <div className="clt-kv" style={{ marginTop: 10 }}>
                                    <div className="clt-kv-l" style={{ fontSize: 11, fontWeight: 700, color: '#C0392B', textTransform: 'uppercase', marginBottom: 2 }}>
                                      LOST AT {e.lostAtStage || e.stage || '–'}
                                    </div>
                                    <div className="clt-kv-v" style={{ fontSize: 13, color: '#C0392B' }}>
                                      {[e.lostReason, e.lostNote].filter(Boolean).join(': ') || 'No reason given'}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Salesperson / Entered by */}
                          <td style={{ verticalAlign: 'top', padding: 0 }}>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv">
                                  <div className="clt-kv-l" style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 2 }}>ENTERED BY</div>
                                  <div className="clt-kv-v" style={{ fontSize: 13.5, color: '#111111' }}>{e.enteredByName || '–'}</div>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Received */}
                          <td style={{ verticalAlign: 'top', padding: 0 }}>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv">
                                  <div className="clt-kv-l" style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', marginBottom: 2 }}>RECEIVED</div>
                                  <div className="clt-kv-v" style={{ fontSize: 13.5, color: '#111111' }}>{formatDate(e.createdAt)}</div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: 0 }} />
                        </tr>

                        {/* Expansion Footer Actions Bar */}
                        <tr className={`clt-x-row clt-x-foot ${animPhase || ''}`} style={{ background: '#F4F1EC', boxShadow: 'inset 3px 0 0 #000000' }}>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div className="clt-x-in">
                              <div className="clt-x-inner" style={{ padding: '0 16px 14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                                  {lockReason ? (
                                    <button
                                      type="button"
                                      className="hier-action-btn danger cd-locked"
                                      title={`Can't be deleted: ${lockReason}.`}
                                      onClick={(ev) => handleDeleteRow(e, ev)}
                                      style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 8,
                                        border: '1px solid #DCD5C4',
                                        background: '#FFFFFF',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'not-allowed',
                                        color: '#8B8778'
                                      }}
                                    >
                                      <Lock size={15} />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="hier-action-btn danger"
                                      title="Delete enquiry"
                                      onClick={(ev) => handleDeleteRow(e, ev)}
                                      style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 8,
                                        border: '1px solid #FBEAE7',
                                        background: '#FBEAE7',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: '#C0392B'
                                      }}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      setActiveEnquiryId(e.id);
                                      setDetailModalOpen(true);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      height: 34,
                                      padding: '0 14px',
                                      borderRadius: 8,
                                      background: '#FF7700',
                                      border: 'none',
                                      color: '#FFFFFF',
                                      fontSize: 13,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 6px rgba(255,119,0,0.25)'
                                    }}
                                  >
                                    More info <ArrowRight size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr className={`clt-x-gap ${animPhase || ''}`} aria-hidden="true">
                          <td colSpan={7} style={{ height: 10, background: '#F4F1EC', borderBottom: '1px solid #E5DFD3' }} />
                        </tr>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#A79F8F', fontSize: 14 }}>
            No enquiries match this filter. Click "+ Quick Enquiry" to create one.
          </div>
        )}
      </div>

      {/* Quick Enquiry Wizard Modal */}
      <QuickEnquiryWizardModal
        isOpen={quickWizardOpen}
        onClose={() => setQuickWizardOpen(false)}
        onCreated={() => { refreshData(); }}
        clients={clients}
        categories={categories}
        sourceCategories={sourceCategories}
        salespersons={salespersons}
      />

      {/* Full 3-Pane Enquiry Detail Modal */}
      <EnquiryDetailModal
        isOpen={detailModalOpen}
        enquiryId={activeEnquiryId}
        onClose={() => { setDetailModalOpen(false); setActiveEnquiryId(null); }}
        onChanged={() => { refreshData(); }}
        categories={categories}
        salespersons={salespersons}
        lostReasons={lostReasons}
      />
    </div>
  );
}
