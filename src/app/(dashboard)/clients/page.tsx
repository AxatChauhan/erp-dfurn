'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import './clients.css';
import { 
  Plus, 
  Upload, 
  Globe, 
  ChevronDown, 
  Check, 
  Trash2, 
  Edit, 
  ArrowRight, 
  Lock, 
  Search,
  AlertCircle
} from 'lucide-react';
import ClientDetailModal from './components/ClientDetailModal';
import ClientWizardModal from './components/ClientWizardModal';
import ClientEditModal from './components/ClientEditModal';
import ClientImportModal from './components/ClientImportModal';
import { addressLines, Address } from '@/lib/phone';

interface ClientRecord {
  id: string;
  code: string;
  clientCode: string;
  type: 'Business' | 'Individual';
  clientType: 'Business' | 'Individual';
  businessMode: string;
  displayName: string;
  name: string;
  companyName?: string;
  contactPerson?: string;
  phones: string[];
  phoneDetails: any[];
  emails: string[];
  addresses: Address[];
  countryIso2: string;
  country: string;
  sourceCategoryId?: string | null;
  sourceCategory?: string;
  sourceName?: string;
  gstin?: string;
  taxId?: string;
  pendingValidation: boolean;
  validationIssues: string[];
  totalJobOrders: number;
  totalOrderValue: number;
  lastOrderDate?: string | null;
  enquiryCount: number;
  quoteCount: number;
  jobOrderCount: number;
  createdAt: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [sourceCategories, setSourceCategories] = useState<{ id: string; name: string }[]>([]);
  const [kpis, setKpis] = useState({
    total: 0,
    business: 0,
    individual: 0,
    withGstin: 0,
    gstinPct: 0,
    topSourceName: '–',
    topSourceCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterCountry, setFilterCountry] = useState<string>('');
  const [filterReview, setFilterReview] = useState<boolean>(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Row Expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [animPhase, setAnimPhase] = useState<'opening' | 'closing' | null>(null);
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up any ongoing animation timer on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  // Modals
  const [modalMode, setModalMode] = useState<'detail' | 'wizard' | 'edit' | 'import' | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);

  useEffect(() => {
    fetchClients();
  }, [filterType, filterCountry, filterReview]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterCountry) params.set('country', filterCountry);
      if (filterReview) params.set('needsReview', 'true');

      const res = await fetch(`/api/clients?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setClients(data.clients || []);
        if (data.sourceCategories) setSourceCategories(data.sourceCategories);
        if (data.kpis) setKpis(data.kpis);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatRupees = (n: number) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

  const billingOf = (c: ClientRecord): Address | undefined => {
    const addrs = c.addresses || [];
    return addrs.find(a => a.isBilling) || addrs[0];
  };

  const cityOf = (c: ClientRecord): string => {
    const b = billingOf(c);
    if (!b || !b.city) return '';
    const filler = /^(n\.?\s*\/?\s*a\.?|not applicable|nil|none|-+)$/i;
    return filler.test(b.city.trim()) ? '' : b.city.trim();
  };

  // Country counts for picker
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach(c => {
      if (c.country) counts[c.country] = (counts[c.country] || 0) + 1;
    });
    return counts;
  }, [clients]);

  const countryList = useMemo(() => {
    return Object.keys(countryCounts).sort((a, b) =>
      a === 'India' ? -1 : b === 'India' ? 1 : a.localeCompare(b)
    );
  }, [countryCounts]);

  const filteredCountryList = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    return countryList.filter(c => !q || c.toLowerCase().includes(q));
  }, [countryList, countrySearch]);

  const toggleRow = (id: string) => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }

    if (expandedId === id) {
      if (animPhase === 'closing') return;
      // Current client is open: slide shut smoothly
      setAnimPhase('closing');
      animTimerRef.current = setTimeout(() => {
        setExpandedId(null);
        setAnimPhase(null);
        animTimerRef.current = null;
      }, 280);
    } else if (expandedId) {
      // Another client is open: close it first, then expand the new one
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
      // Nothing open: expand immediately with smooth slide-down animation
      setExpandedId(id);
      setAnimPhase('opening');
      animTimerRef.current = setTimeout(() => {
        setAnimPhase(null);
        animTimerRef.current = null;
      }, 380);
    }
  };

  const handleOpenDetail = (client: ClientRecord) => {
    setSelectedClient(client);
    setModalMode('detail');
  };

  const handleOpenEdit = (client: ClientRecord) => {
    setSelectedClient(client);
    setModalMode('edit');
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete client');
        return;
      }
      setExpandedId(null);
      if (modalMode === 'detail') setModalMode(null);
      fetchClients();
    } catch (err: any) {
      alert(err.message || 'Error deleting client');
    }
  };

  const hasActiveFilters = Boolean(filterType || filterCountry || filterReview);

  return (
    <div className="clt-container">
      {/* 1. TOP KPI INSIGHTS STRIP (Photo 1) */}
      <div className="insights-strip">
        <div className="insight-card">
          <div className="insight-label">Total Clients</div>
          <div className="insight-value">{kpis.total}</div>
        </div>
        <div className="insight-card">
          <div className="insight-label">Business Clients</div>
          <div className="insight-value">{kpis.business}</div>
        </div>
        <div className="insight-card">
          <div className="insight-label">Individual Clients</div>
          <div className="insight-value">{kpis.individual}</div>
        </div>
        <div className="insight-card">
          <div className="insight-label">GSTIN on File</div>
          <div className="insight-value">{kpis.withGstin}</div>
          <div className="insight-sub">{kpis.gstinPct}% of clients</div>
        </div>
        <div className="insight-card">
          <div className="insight-label">Top Source</div>
          <div className="insight-value truncate">{kpis.topSourceName}</div>
          <div className="insight-sub">{kpis.topSourceCount ? `${kpis.topSourceCount} clients` : ''}</div>
        </div>
      </div>

      {/* 2. FILTER & ACTION TOOLBAR (Photo 1) */}
      <div className="clt-filterbar">
        <div className="clt-filters">
          {/* Segment Chips */}
          <div
            className={`segment-chip ${!filterType ? 'selected' : ''}`}
            onClick={() => setFilterType('')}
          >
            <span>All Clients</span>
            <span className="count">{kpis.total}</span>
          </div>

          <div
            className={`segment-chip ${filterType === 'Individual' ? 'selected' : ''}`}
            onClick={() => setFilterType('Individual')}
          >
            <span>Individual</span>
            <span className="count">{kpis.individual}</span>
          </div>

          <div
            className={`segment-chip ${filterType === 'Business' ? 'selected' : ''}`}
            onClick={() => setFilterType('Business')}
          >
            <span>Business</span>
            <span className="count">{kpis.business}</span>
          </div>

          <span className="clt-filter-gap" />

          {/* Interactive Country Picker */}
          <div className="clt-cp">
            <div
              className={`segment-chip clt-cp-btn ${filterCountry ? 'selected' : ''}`}
              onClick={() => setCountryOpen(!countryOpen)}
            >
              <Globe size={15} />
              <span>{filterCountry || 'All countries'}</span>
              {filterCountry && (
                <span className="count">{countryCounts[filterCountry] || 0}</span>
              )}
              <ChevronDown size={14} />
            </div>

            {countryOpen && (
              <div className="clt-cp-pop">
                {countryList.length > 8 && (
                  <input
                    className="clt-cp-search"
                    placeholder="Search a country"
                    value={countrySearch}
                    onChange={e => setCountrySearch(e.target.value)}
                    autoFocus
                  />
                )}
                <div className="clt-cp-list">
                  <button
                    type="button"
                    className={`clt-cp-opt ${!filterCountry ? 'on' : ''}`}
                    onClick={() => {
                      setFilterCountry('');
                      setCountryOpen(false);
                    }}
                  >
                    <span>All countries</span>
                    <span className="count">{kpis.total}</span>
                    {!filterCountry && <Check size={14} className="text-emerald-600" />}
                  </button>

                  {filteredCountryList.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`clt-cp-opt ${filterCountry === c ? 'on' : ''}`}
                      onClick={() => {
                        setFilterCountry(c);
                        setCountryOpen(false);
                      }}
                    >
                      <span>{c}</span>
                      <span className="count">{countryCounts[c]}</span>
                      {filterCountry === c && <Check size={14} className="text-emerald-600" />}
                    </button>
                  ))}

                  {filteredCountryList.length === 0 && (
                    <div className="clt-cp-none">No country matches</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Needs review pill toggle */}
          {clients.some(c => c.pendingValidation) && (
            <button
              type="button"
              className={`clt-review-pill ${filterReview ? 'selected' : ''}`}
              onClick={() => setFilterReview(!filterReview)}
            >
              Needs review <b>{clients.filter(c => c.pendingValidation).length}</b>
            </button>
          )}

          {/* Clear Filter */}
          {hasActiveFilters && (
            <button
              type="button"
              className="clt-clear"
              onClick={() => {
                setFilterType('');
                setFilterCountry('');
                setFilterReview(false);
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="clt-actions">
          <button
            type="button"
            className="clt-quiet-btn"
            onClick={() => setModalMode('import')}
          >
            <Upload size={15} /> Import
          </button>
          <button
            type="button"
            className="btn-primary-orange"
            onClick={() => setModalMode('wizard')}
          >
            <Plus size={16} /> New Client
          </button>
        </div>
      </div>

      {/* 3. FIXED LAYOUT DATA TABLE (Photo 1 & Photo 2) */}
      <div className="clt-table-wrap">
        <table className="clt-table">
          <colgroup>
            <col className="w-no" />
            <col className="w-name" />
            <col className="w-type" />
            <col className="w-phone" />
            <col className="w-city" />
            <col className="w-country" />
            <col className="w-email" />
            <col className="w-chev" />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Type</th>
              <th>Phone</th>
              <th>City</th>
              <th>Country</th>
              <th>Email</th>
              <th aria-label="Expand" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-sm text-stone-400">
                  Loading clients...
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-sm text-stone-400">
                  No clients found.
                </td>
              </tr>
            ) : (
              clients.map((c, idx) => {
                const isExpanded = expandedId === c.id;
                const isClosing = isExpanded && animPhase === 'closing';
                const isRowOpen = isExpanded && !isClosing;
                const phoneItem = c.phoneDetails && c.phoneDetails[0];
                const emailItem = c.emails && c.emails[0];
                const city = cityOf(c);
                const billing = billingOf(c);
                const isLocked = c.totalJobOrders > 0;

                const morePhones = (c.phoneDetails || [])
                  .slice(1)
                  .map(p => `${p.dial ? p.dial + ' ' : ''}${p.number}`)
                  .join(', ');
                const moreEmails = (c.emails || []).slice(1).join(', ');

                return (
                  <React.Fragment key={c.id}>
                    {/* Main Row */}
                    <tr
                      className={`clt-row ${isRowOpen ? 'open' : ''}`}
                      onClick={() => toggleRow(c.id)}
                    >
                      <td className="clt-no">{idx + 1}</td>
                      <td className="clt-name font-bold">
                        <span>{c.displayName || c.name || '–'}</span>
                        {c.pendingValidation && (
                          <span
                            className="clt-review-tag"
                            title={(c.validationIssues || []).join('\n')}
                          >
                            Needs review
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="clt-type-tag">{c.type}</span>
                      </td>
                      <td className="clt-phone">
                        {phoneItem ? (
                          <>
                            {phoneItem.dial && <span className="cd-dial">{phoneItem.dial}</span>}
                            <span className="cd-num">{phoneItem.number}</span>
                            {c.phones.length > 1 && (
                              <span className="clt-faint"> +{c.phones.length - 1}</span>
                            )}
                          </>
                        ) : (
                          <span className="clt-faint">–</span>
                        )}
                      </td>
                      <td>
                        {city ? city : <span className="clt-faint">–</span>}
                      </td>
                      <td>{c.country || '–'}</td>
                      <td className="clt-email">
                        {emailItem ? (
                          <>
                            <span>{emailItem}</span>
                            {c.emails.length > 1 && (
                              <span className="clt-faint"> +{c.emails.length - 1}</span>
                            )}
                          </>
                        ) : (
                          <span className="clt-faint">–</span>
                        )}
                      </td>
                      <td className="clt-chev">
                        <ChevronDown size={16} />
                      </td>
                    </tr>

                    {/* Expandable in-place Row (Photo 2) with Smooth CSS Grid Animation */}
                    {isExpanded && (
                      <>
                        <tr className={`clt-x-row ${animPhase || ''}`}>
                          <td>
                            <div className="clt-x-in"><div className="clt-x-inner" /></div>
                          </td>
                          {/* Col 2: Under Name */}
                          <td>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                {c.type === 'Business' && c.contactPerson && (
                                  <div className="clt-kv">
                                    <div className="clt-kv-l">Contact person</div>
                                    <div className="clt-kv-v">{c.contactPerson}</div>
                                  </div>
                                )}
                                <div className="clt-kv">
                                  <div className="clt-kv-l">Client ID</div>
                                  <div className="clt-kv-v font-bold">{c.code}</div>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 3: Under Type */}
                          <td>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv">
                                  <div className="clt-kv-l">Business mode</div>
                                  <div className="clt-kv-v">{c.businessMode}</div>
                                </div>
                                <div className="clt-kv">
                                  <div className="clt-kv-l">Orders</div>
                                  <div className="clt-kv-v">
                                    {c.totalJobOrders > 0 ? (
                                      `${c.totalJobOrders} • ${formatRupees(c.totalOrderValue)}`
                                    ) : (
                                      <span className="clt-faint">None yet</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 4: Under Phone */}
                          <td>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                {morePhones && (
                                  <div className="clt-kv">
                                    <div className="clt-kv-l">Other phones</div>
                                    <div className="clt-kv-v">{morePhones}</div>
                                  </div>
                                )}
                                <div className="clt-kv">
                                  <div className="clt-kv-l">Source</div>
                                  <div className="clt-kv-v font-semibold">
                                    {c.sourceCategory || <span className="clt-faint">Not recorded</span>}
                                  </div>
                                </div>
                                {c.sourceName && (
                                  <div className="clt-kv">
                                    <div className="clt-kv-l">Referred by</div>
                                    <div className="clt-kv-v">{c.sourceName}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Col 5 & 6 (Colspan 2): Under City & Country */}
                          <td colSpan={2}>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-kv">
                                  <div className="clt-kv-l">Billing address</div>
                                  <div className="clt-kv-v leading-relaxed">
                                    {billing ? (
                                      addressLines(billing).map((l, i) => <div key={i}>{l}</div>)
                                    ) : (
                                      <span className="clt-faint">None on file</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 7: Under Email */}
                          <td>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                {moreEmails && (
                                  <div className="clt-kv">
                                    <div className="clt-kv-l">Other emails</div>
                                    <div className="clt-kv-v">{moreEmails}</div>
                                  </div>
                                )}
                                {c.gstin && (
                                  <div className="clt-kv">
                                    <div className="clt-kv-l">GSTIN</div>
                                    <div className="clt-kv-v">{c.gstin}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="clt-x-in"><div className="clt-x-inner" /></div>
                          </td>
                        </tr>

                        {/* Action footer line */}
                        <tr className={`clt-x-row clt-x-foot ${animPhase || ''}`}>
                          <td colSpan={8}>
                            <div className="clt-x-in">
                              <div className="clt-x-inner">
                                <div className="clt-x-actions">
                                  <button
                                    type="button"
                                    className={`action-icon-btn danger ${isLocked ? 'cd-locked' : ''}`}
                                    title={isLocked ? `Can't be deleted: this client has ${c.totalJobOrders} job order(s)` : 'Delete'}
                                    disabled={isLocked}
                                    onClick={e => {
                                      e.stopPropagation();
                                      !isLocked && handleDeleteClient(c.id);
                                    }}
                                  >
                                    {isLocked ? <Lock size={15} /> : <Trash2 size={15} />}
                                  </button>

                                  <button
                                    type="button"
                                    className="clt-quiet-btn"
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleOpenEdit(c);
                                    }}
                                  >
                                    <Edit size={14} /> Edit
                                  </button>

                                  <button
                                    type="button"
                                    className="cd-more-btn"
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleOpenDetail(c);
                                    }}
                                  >
                                    More info <ArrowRight size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Gap Row */}
                        <tr className={`clt-x-gap ${animPhase || ''}`} aria-hidden="true">
                          <td colSpan={8} />
                        </tr>
                      </>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. MODALS */}
      {modalMode === 'wizard' && (
        <ClientWizardModal
          sourceCategories={sourceCategories}
          onClose={() => setModalMode(null)}
          onCreated={() => fetchClients()}
        />
      )}

      {modalMode === 'edit' && selectedClient && (
        <ClientEditModal
          client={selectedClient}
          sourceCategories={sourceCategories}
          onClose={() => {
            setModalMode(null);
            setSelectedClient(null);
          }}
          onSaved={() => fetchClients()}
        />
      )}

      {modalMode === 'detail' && selectedClient && (
        <ClientDetailModal
          clientId={selectedClient.id}
          onClose={() => {
            setModalMode(null);
            setSelectedClient(null);
          }}
          onEdit={client => {
            setSelectedClient(client);
            setModalMode('edit');
          }}
          onDelete={id => handleDeleteClient(id)}
        />
      )}

      {modalMode === 'import' && (
        <ClientImportModal
          onClose={() => setModalMode(null)}
          onImportDone={() => fetchClients()}
        />
      )}
    </div>
  );
}
