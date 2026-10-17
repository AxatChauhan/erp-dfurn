'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import './quotations.css';
import '../enquiries/enquiries.css';
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
  Search,
  MessageSquare,
  Download,
  Loader2
} from 'lucide-react';
import { formatDate, currentFiscalYearKey, MONTH_NAMES, fiscalYearOf } from '@/lib/dates';
import { toast } from 'sonner';
import { generateQuotationPDF } from '@/lib/quotations/quotePdfGenerator';
import QuotationDetailModal from './components/QuotationDetailModal';
import NewQuotationModal from './components/NewQuotationModal';

interface QuotationsClientProps {
  initialQuotations: any[];
  initialKpis: any;
  initialCounts: Record<string, number>;
  salespersons: any[];
  waitingEnquiriesCount: number;
}

const BUCKETS = [
  'Draft',
  'Verification Required',
  'Admin Approval Required',
  'Approved',
  'Sent',
  'Followup Needed',
  'Converted',
  'Not Approved',
  'Not Converted'
] as const;

const QUOTE_SUB: Record<string, string> = {
  Draft: 'Draft',
  'Verification Required': 'To check',
  'Admin Approval Required': 'To approve',
  Approved: 'Approved',
  'Not Approved': 'Not approved',
  Sent: 'Sent',
  'Followup Needed': 'Follow up',
  Converted: 'Won',
  'Not Converted': 'Lost'
};

const STATUS_CLASS: Record<string, string> = {
  Draft: 'neutral',
  'Verification Required': 'active',
  'Admin Approval Required': 'active',
  Approved: 'active',
  'Not Approved': 'bad',
  Sent: 'active',
  'Followup Needed': 'bad',
  Converted: 'done',
  'Not Converted': 'bad'
};

const rupees = (n: number | null | undefined) =>
  '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function QuotationsClient({
  initialQuotations,
  initialKpis,
  initialCounts,
  salespersons,
  waitingEnquiriesCount
}: QuotationsClientProps) {
  const [quotations, setQuotations] = useState<any[]>(initialQuotations);
  const [kpis, setKpis] = useState<any>(initialKpis);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [waitingCount, setWaitingCount] = useState<number>(waitingEnquiriesCount);

  // Filters
  const defaultFY = currentFiscalYearKey();
  const [filterFY, setFilterFY] = useState<string>(defaultFY);
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterBucket, setFilterBucket] = useState<string>('');
  const [filterSp, setFilterSp] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Dropdowns & Modals
  const [periodOpen, setPeriodOpen] = useState(false);
  const [spOpen, setSpOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const periodRef = useRef<HTMLDivElement>(null);
  const spRef = useRef<HTMLDivElement>(null);

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

  // Reload data from server
  const refreshData = async () => {
    try {
      const res = await fetch('/api/quotations');
      const data = await res.json();
      if (res.ok) {
        setQuotations(data.quotations || []);
        setKpis(data.kpis || {});
        setCounts(data.counts || {});
        setWaitingCount(data.waitingEnquiriesCount || 0);
      }
    } catch (e) {
      console.error('Failed to reload quotations', e);
    }
  };

  // Filter calculations in memory
  const periodDirty = Boolean(filterDate || filterMonth !== '' || filterFY !== defaultFY);
  const isDirty = periodDirty || Boolean(filterBucket || filterSp || search);

  const timeFiltered = useMemo(() => {
    return quotations.filter(q => {
      if (filterDate) return q.createdAt.slice(0, 10) === filterDate;
      if (filterFY !== 'all' && fiscalYearOf(q.createdAt).key !== filterFY) return false;
      if (filterMonth !== '' && new Date(q.createdAt).getMonth() !== Number(filterMonth)) return false;
      return true;
    });
  }, [quotations, filterDate, filterFY, filterMonth]);

  const scoped = useMemo(() => {
    return timeFiltered.filter(q => {
      if (!filterSp) return true;
      if (filterSp === 'unassigned') return !q.salespersonId;
      return q.salespersonId === filterSp;
    });
  }, [timeFiltered, filterSp]);

  const filtered = useMemo(() => {
    let result = filterBucket ? scoped.filter(q => q.effectiveStatus === filterBucket) : scoped;
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        q =>
          (q.clientName && q.clientName.toLowerCase().includes(query)) ||
          (q.code && q.code.toLowerCase().includes(query)) ||
          (q.enquiryCode && q.enquiryCode.toLowerCase().includes(query)) ||
          (q.quotationNumber && q.quotationNumber.toLowerCase().includes(query))
      );
    }
    return result;
  }, [scoped, filterBucket, search]);

  const periodLabel = useMemo(() => {
    if (filterDate) return formatDate(filterDate);
    const fy = filterFY === 'all' ? 'All years' : `FY ${filterFY}`;
    return filterMonth !== '' ? `${fy} · ${MONTH_NAMES[Number(filterMonth)]}` : fy;
  }, [filterDate, filterFY, filterMonth]);

  const spLabel = useMemo(() => {
    if (!filterSp) return 'All Sales team';
    if (filterSp === 'unassigned') return 'Unassigned';
    const found = salespersons.find(s => s.id === filterSp);
    return found ? found.name : 'Salesperson';
  }, [filterSp, salespersons]);

  const dynamicKpis = useMemo(() => {
    const total = scoped.length;
    const submitted = scoped.filter(q => q.status !== 'Draft');
    const draftsCount = scoped.filter(q => q.status === 'Draft').length;
    const overdueCount = scoped.filter(q => q.effectiveStatus === 'Followup Needed').length;
    const wonCount = scoped.filter(q => q.status === 'Converted').length;
    const decidedCount = scoped.filter(q => q.status === 'Converted' || q.status === 'Not Converted').length;
    const conversionRate = decidedCount > 0 ? Math.round((wonCount / decidedCount) * 100) : null;
    const pipelineValue = submitted.reduce((sum, q) => sum + (q.totalAmount || 0), 0);
    const avgDealSize = submitted.length > 0 ? Math.round(pipelineValue / submitted.length) : 0;
    return {
      total,
      draftsCount,
      overdueCount,
      wonCount,
      decidedCount,
      conversionRate,
      pipelineValue,
      avgDealSize
    };
  }, [scoped]);

  const dynamicCounts = useMemo(() => {
    const res: Record<string, number> = {};
    BUCKETS.forEach(b => {
      res[b] = scoped.filter(q => q.effectiveStatus === b).length;
    });
    return res;
  }, [scoped]);

  return (
    <div style={{ maxWidth: 1720, margin: '0 auto', padding: '24px 20px' }}>
      {/* ===================================================================
          1. FIVE INSIGHT KPI CARDS (Matching Photo 1)
          =================================================================== */}
      <div className="insights-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        {/* Card 1: Quotations */}
        <div className="insight-card">
          <div className="insight-label">Quotations</div>
          <div className="insight-value">{dynamicKpis.total || 0}</div>
          <div className="insight-sub">
            {dynamicKpis.draftsCount ? `${dynamicKpis.draftsCount} still a draft` : 'none in draft'}
          </div>
        </div>

        {/* Card 2: Overdue Follow-ups (Orange accent) */}
        <div className={`insight-card ${dynamicKpis.overdueCount > 0 ? 'insight-card-warn' : ''}`}>
          <div className="insight-label">Overdue Follow-ups</div>
          <div className="insight-value" style={dynamicKpis.overdueCount > 0 ? { color: '#FF7700' } : {}}>
            {dynamicKpis.overdueCount || 0}
          </div>
          <div className="insight-sub" style={dynamicKpis.overdueCount > 0 ? { color: '#FF7700' } : {}}>
            {dynamicKpis.overdueCount > 0 ? 'needs attention' : 'all caught up'}
          </div>
        </div>

        {/* Card 3: Won */}
        <div className="insight-card">
          <div className="insight-label">Won</div>
          <div className="insight-value">{dynamicKpis.wonCount || 0}</div>
          <div className="insight-sub">{dynamicKpis.wonCount > 0 ? 'converted deals' : 'none yet'}</div>
        </div>

        {/* Card 4: Conversion Rate */}
        <div className="insight-card">
          <div className="insight-label">Conversion Rate</div>
          <div className="insight-value">
            {dynamicKpis.conversionRate !== null ? `${dynamicKpis.conversionRate}%` : '–'}
          </div>
          <div className="insight-sub">
            {dynamicKpis.decidedCount > 0 ? `${dynamicKpis.decidedCount} decided` : 'none decided yet'}
          </div>
        </div>

        {/* Card 5: Pipeline Value */}
        <div className="insight-card">
          <div className="insight-label">Pipeline Value</div>
          <div className="insight-value">{rupees(dynamicKpis.pipelineValue)}</div>
          <div className="insight-sub">
            {dynamicKpis.total > 0 ? `avg ${rupees(dynamicKpis.avgDealSize)} per submitted` : 'nothing submitted yet'}
          </div>
        </div>
      </div>

      {/* ===================================================================
          2. FILTER BAR (Segment Tabs, Period, Sales Team, Search, Actions)
          =================================================================== */}
      <div className="clt-filterbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="clt-filters" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* All chip */}
          <div
            className={`segment-chip all ${!filterBucket ? 'selected' : ''}`}
            onClick={() => setFilterBucket('')}
            role="button"
            tabIndex={0}
          >
            <span className="name">All</span>
            <span className="count">{scoped.length}</span>
          </div>

          {/* Status chips */}
          {BUCKETS.filter(b => (dynamicCounts[b] || 0) > 0 || filterBucket === b).map(b => (
            <div
              key={b}
              className={`segment-chip ${filterBucket === b ? 'selected' : ''}`}
              onClick={() => setFilterBucket(b)}
              role="button"
              tabIndex={0}
            >
              <span className="name">{QUOTE_SUB[b]}</span>
              <span className="count">{dynamicCounts[b] || 0}</span>
            </div>
          ))}

          <span className="clt-filter-gap" style={{ width: 1, height: 24, background: '#E5DFD3', margin: '0 4px' }} />

          {/* Period Picker Popover */}
          <div className="clt-cp" ref={periodRef} style={{ position: 'relative' }}>
            <div
              className={`segment-chip clt-cp-btn ${periodDirty ? 'selected' : ''}`}
              onClick={() => {
                setPeriodOpen(!periodOpen);
                setSpOpen(false);
              }}
              role="button"
              tabIndex={0}
            >
              <Calendar size={14} style={{ marginRight: 6 }} />
              <span className="name">{periodLabel}</span>
              <ChevronDown size={14} style={{ marginLeft: 6 }} />
            </div>

            {periodOpen && (
              <div
                className="clt-cp-pop enq-period-pop"
                style={{
                  position: 'absolute',
                  top: 40,
                  left: 0,
                  background: '#FFF',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
                  borderRadius: 10,
                  padding: 16,
                  zIndex: 200,
                  border: '1px solid #E5DFD3',
                  width: 310
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginBottom: 6 }}>
                    Financial Year
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`pill-btn ${filterFY === defaultFY ? 'selected' : ''}`}
                      onClick={() => setFilterFY(defaultFY)}
                    >
                      FY {defaultFY}
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${filterFY === 'all' ? 'selected' : ''}`}
                      onClick={() => setFilterFY('all')}
                    >
                      All years
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginBottom: 6 }}>
                    Month
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`pill-btn ${filterMonth === '' ? 'selected' : ''}`}
                      onClick={() => setFilterMonth('')}
                    >
                      All
                    </button>
                    {MONTH_NAMES.map((m, idx) => (
                      <button
                        key={m}
                        type="button"
                        className={`pill-btn ${filterMonth === String(idx) ? 'selected' : ''}`}
                        onClick={() => setFilterMonth(String(idx))}
                        style={{ padding: '2px 8px', fontSize: 12 }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginBottom: 6 }}>
                    Or exact date
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="date"
                      className="field-input"
                      value={filterDate}
                      onChange={e => setFilterDate(e.target.value)}
                      style={{ height: 32, fontSize: 12, flex: 1 }}
                    />
                    {filterDate && (
                      <button
                        type="button"
                        className="clt-clear"
                        onClick={() => setFilterDate('')}
                        style={{ fontSize: 12 }}
                      >
                        Clear day
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sales Team Filter */}
          <div className="clt-cp" ref={spRef} style={{ position: 'relative' }}>
            <div
              className={`segment-chip clt-cp-btn ${filterSp ? 'selected' : ''}`}
              onClick={() => {
                setSpOpen(!spOpen);
                setPeriodOpen(false);
              }}
              role="button"
              tabIndex={0}
            >
              <Briefcase size={14} style={{ marginRight: 6 }} />
              <span className="name">{spLabel}</span>
              <ChevronDown size={14} style={{ marginLeft: 6 }} />
            </div>

            {spOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 40,
                  left: 0,
                  background: '#FFF',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
                  borderRadius: 10,
                  padding: '8px 0',
                  zIndex: 200,
                  border: '1px solid #E5DFD3',
                  minWidth: 200
                }}
              >
                <button
                  type="button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 16px',
                    border: 'none',
                    background: !filterSp ? '#F4F1EA' : 'none',
                    fontWeight: !filterSp ? 700 : 400,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                  onClick={() => {
                    setFilterSp('');
                    setSpOpen(false);
                  }}
                >
                  All Sales team
                </button>
                {salespersons.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 16px',
                      border: 'none',
                      background: filterSp === s.id ? '#F4F1EA' : 'none',
                      fontWeight: filterSp === s.id ? 700 : 400,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                    onClick={() => {
                      setFilterSp(s.id);
                      setSpOpen(false);
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear filters button */}
          {isDirty && (
            <button
              type="button"
              className="clt-clear"
              onClick={() => {
                setFilterBucket('');
                setFilterSp('');
                setFilterFY(defaultFY);
                setFilterMonth('');
                setFilterDate('');
                setSearch('');
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Right Actions: Waiting count + New Quotation button */}
        <div className="clt-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {waitingCount > 0 && (
            <span className="qt-waiting">
              {waitingCount} qualified {waitingCount === 1 ? 'enquiry' : 'enquiries'} waiting
            </span>
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={() => setNewModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={15} /> New quotation
          </button>
        </div>
      </div>

      {/* ===================================================================
          3. TABLE & IN-PLACE ROW EXPANSION (Matching Photos 1 & 2)
          =================================================================== */}
      <div className="clt-table-wrap">
        {filtered.length === 0 ? (
          <div className="clt-empty" style={{ padding: '48px 0', textAlign: 'center' }}>
            {quotations.length === 0
              ? 'No quotations yet. Start one from a qualified enquiry with New quotation.'
              : 'No quotations match this filter.'}
          </div>
        ) : (
          <table className="clt-table clt-fixed">
            <colgroup>
              <col className="wq-no" />
              <col className="wq-client" />
              <col className="wq-status" />
              <col className="wq-val" />
              <col className="wq-sp" />
              <col className="wq-date" />
              <col className="wq-chev" />
            </colgroup>
            <thead>
              <tr>
                <th className="clt-no">#</th>
                <th>Client</th>
                <th>Status</th>
                <th>Total</th>
                <th>Salesperson</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, idx) => {
                const isOpen = expandedId === q.id;
                const canDelete = q.status === 'Draft' && !q.code && q.versions.every((x: any) => x.status === 'Draft' && !x.submittedAt);

                return (
                  <React.Fragment key={q.id}>
                    {/* Main Row */}
                    <tr
                      className={`clt-row ${isOpen ? 'open' : ''}`}
                      onClick={() => setExpandedId(isOpen ? null : q.id)}
                      tabIndex={0}
                    >
                      <td className="clt-no">{idx + 1}</td>
                      <td className="clt-name">
                        <div style={{ fontWeight: 600, color: '#1A1A1A' }}>{q.clientName}</div>
                        <div className="enq-code-sub">
                          {q.code ? `${q.code} · ${q.versionLabel}` : `Draft for ${q.enquiryCode || ''}`}
                        </div>
                      </td>
                      <td>
                        <span className={`cd-st cd-st-${STATUS_CLASS[q.effectiveStatus] || 'neutral'}`}>
                          <i /> {QUOTE_SUB[q.effectiveStatus] || q.effectiveStatus}
                        </span>
                      </td>
                      <td className="qt-val">{rupees(q.totalAmount)}</td>
                      <td>{q.salespersonName || <span style={{ color: '#A39B8B' }}>–</span>}</td>
                      <td>{formatDate(q.updatedAt)}</td>
                      <td className="clt-chev">
                        <ChevronDown
                          size={16}
                          style={{
                            transition: 'transform 0.2s',
                            transform: isOpen ? 'rotate(180deg)' : 'none'
                          }}
                        />
                      </td>
                    </tr>

                    {/* Accordion Row Drawer (Photo 2) */}
                    {isOpen && (
                      <>
                        <tr className="clt-x-row">
                          <td />
                          <td>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv">
                                  <div className="clt-kv-l">PHONE</div>
                                  <div className="clt-kv-v">{q.clientPhone || '–'}</div>
                                </div>
                                <div className="clt-kv">
                                  <div className="clt-kv-l">EMAIL</div>
                                  <div className="clt-kv-v">{q.clientEmail || 'None'}</div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv">
                                  <div className="clt-kv-l">FROM ENQUIRY</div>
                                  <div className="clt-kv-v">{q.enquiryCode || '–'}</div>
                                </div>
                                <div className="clt-kv">
                                  <div className="clt-kv-l">VERSION</div>
                                  <div className="clt-kv-v">
                                    {q.versionLabel} of {q.versionsCount || 1}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv">
                                  <div className="clt-kv-l">PRODUCTS</div>
                                  <div className="clt-kv-v">
                                    {q.latestVersion?.items?.length
                                      ? `${q.latestVersion.items.length} products`
                                      : 'None yet'}
                                  </div>
                                </div>
                                <div className="clt-kv">
                                  <div className="clt-kv-l">VALID UNTIL</div>
                                  <div className="clt-kv-v">
                                    {q.latestVersion?.validUntil
                                      ? formatDate(q.latestVersion.validUntil)
                                      : 'Not set'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv">
                                  <div className="clt-kv-l">PREPARED BY</div>
                                  <div className="clt-kv-v">
                                    {q.versions[0]?.createdByName || 'Admin'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv">
                                  <div className="clt-kv-l">CREATED</div>
                                  <div className="clt-kv-v">{formatDate(q.createdAt)}</div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td />
                        </tr>

                        {/* Accordion Actions Row */}
                        <tr className="clt-x-row clt-x-foot">
                          <td colSpan={7}>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-x-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '10px 16px' }}>
                                  {canDelete ? (
                                    <button
                                      type="button"
                                      className="hier-action-btn danger"
                                      title="Delete this draft"
                                      onClick={async () => {
                                        if (!confirm('Delete this draft? It was never submitted.')) return;
                                        await fetch(`/api/quotations/${q.id}`, { method: 'DELETE' });
                                        toast.success('Draft deleted');
                                        refreshData();
                                      }}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="hier-action-btn danger cd-locked"
                                      style={{ opacity: 0.5, cursor: 'not-allowed' }}
                                      title="Cannot be deleted: it has been submitted"
                                      onClick={() =>
                                        toast.error(
                                          'This quotation cannot be deleted: it has been submitted, so it is a permanent record.'
                                        )
                                      }
                                    >
                                      <Lock size={15} />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="hier-action-btn"
                                    title="Download Commercial Quotation PDF"
                                    disabled={downloadingId === q.id}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        setDownloadingId(q.id);
                                        const res = await fetch(`/api/quotations/${q.id}`);
                                        const fullQuote = await res.json();
                                        if (!res.ok) throw new Error(fullQuote.error || 'Failed to fetch quotation');
                                        await generateQuotationPDF(fullQuote, fullQuote.latestVersion);
                                        toast.success('Quotation PDF downloaded');
                                      } catch (err: any) {
                                        toast.error(err.message || 'Failed to download PDF');
                                      } finally {
                                        setDownloadingId(null);
                                      }
                                    }}
                                    style={{
                                      background: '#F4F1EA',
                                      color: '#403E39',
                                      border: '1px solid #E5DFD3',
                                      borderRadius: 8,
                                      padding: '8px 14px',
                                      fontSize: 13,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6
                                    }}
                                  >
                                    {downloadingId === q.id ? (
                                      <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>PDF...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Download size={14} />
                                        <span>PDF</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    className="cd-more-btn"
                                    onClick={() => {
                                      setActiveQuoteId(q.id);
                                      setDetailModalOpen(true);
                                    }}
                                    style={{
                                      background: '#FF7700',
                                      color: '#FFF',
                                      border: 'none',
                                      borderRadius: 8,
                                      padding: '8px 16px',
                                      fontSize: 13,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6
                                    }}
                                  >
                                    More info <ArrowRight size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr className="clt-x-gap" aria-hidden="true">
                          <td colSpan={7} />
                        </tr>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ===================================================================
          MODALS: 3-Pane Detail Modal & New Quotation Modal
          =================================================================== */}
      <QuotationDetailModal
        quoteId={activeQuoteId}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setActiveQuoteId(null);
        }}
        onChanged={refreshData}
      />

      <NewQuotationModal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreated={newId => {
          refreshData();
          setActiveQuoteId(newId);
          setDetailModalOpen(true);
        }}
      />
    </div>
  );
}
