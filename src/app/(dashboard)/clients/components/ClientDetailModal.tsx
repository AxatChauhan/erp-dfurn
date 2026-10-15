'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Edit, 
  Trash2, 
  Lock, 
  BarChart2, 
  AlertTriangle, 
  Check, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Tag, 
  Handshake, 
  Briefcase, 
  Receipt, 
  ArrowRight, 
  ChevronDown,
  Info
} from 'lucide-react';
import { addressLines, PhoneDetail, Address } from '@/lib/phone';
import { COUNTRIES } from '@/lib/countries';

interface ClientDetailModalProps {
  clientId: string;
  onClose: () => void;
  onEdit: (client: any) => void;
  onDelete: (clientId: string) => void;
  preloadedData?: { client: any; activity: any } | null;
}

export default function ClientDetailModal({
  clientId,
  onClose,
  onEdit,
  onDelete,
  preloadedData
}: ClientDetailModalProps) {
  const [client, setClient] = useState<any>(preloadedData?.client || null);
  const [activity, setActivity] = useState<any>(preloadedData?.activity || null);
  const [loading, setLoading] = useState(Boolean(!preloadedData?.client || !preloadedData?.activity));
  const [activeTab, setActiveTab] = useState<'orders' | 'quotes' | 'enquiries'>('orders');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!preloadedData?.client || !preloadedData?.activity) {
        setLoading(true);
      }
      try {
        const [cRes, actRes] = await Promise.all([
          fetch(`/api/clients/${clientId}`),
          fetch(`/api/clients/${clientId}/activity`)
        ]);
        if (cRes.ok && actRes.ok) {
          const cData = await cRes.json();
          const actData = await actRes.json();
          setClient(cData);
          setActivity(actData);
        }
      } catch (err) {
        console.error('Failed to load client detail:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [clientId, preloadedData]);

  if (loading || !client || !activity) {
    return (
      <div className="cd-overlay">
        <div className="cd-modal flex items-center justify-center p-12">
          <div className="text-sm font-semibold text-gray-500 animate-pulse">Loading client details...</div>
        </div>
      </div>
    );
  }

  const formatRupees = (n: number) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const formatDate = (d?: string | null) => {
    if (!d) return '–';
    const date = new Date(d);
    return isNaN(date.getTime())
      ? '–'
      : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const shortDate = (d?: string | null) => {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const initials = (client.displayName || client.name || client.clientCode || 'CL')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  // Compute unfinished gaps
  const gaps: string[] = [];
  if (client.pendingValidation && Array.isArray(client.validationIssues)) {
    client.validationIssues.forEach((i: string) => gaps.push(i));
  }
  if (client.clientType === 'Business' && !client.contactPerson) {
    gaps.push('No contact person');
  }
  const phoneDetails: PhoneDetail[] = Array.isArray(client.phoneDetails) ? client.phoneDetails : [];
  phoneDetails.filter(p => !p.valid).forEach(p => {
    gaps.push(`${p.dial ? p.dial + ' ' : ''}${p.number} is not a valid number`);
  });
  if (!client.emails || !client.emails.length) {
    gaps.push('No email address');
  }
  const addrs: Address[] = Array.isArray(client.addresses) ? client.addresses : [];
  const billing = addrs.find(a => a.isBilling) || addrs[0];
  if (!billing) {
    gaps.push('No billing address');
  } else if (!billing.city?.trim()) {
    gaps.push('Billing address has no city');
  }
  if ((client.countryIso2 === 'IN' || client.country === 'India') && !client.taxId) {
    gaps.push('No GSTIN (needed at Dispatch for an Indian client)');
  }
  if (!client.sourceCategoryId && !client.sourceCategory) {
    gaps.push('Source not recorded');
  }

  // Check delete locks
  const jobsCount = activity.jobOrders?.length || 0;
  const quotesCount = activity.quotations?.length || 0;
  const enqsCount = activity.enquiries?.length || 0;
  const heldBy: string[] = [];
  if (jobsCount > 0) heldBy.push(`${jobsCount} job order${jobsCount === 1 ? '' : 's'}`);
  if (quotesCount > 0) heldBy.push(`${quotesCount} quotation${quotesCount === 1 ? '' : 's'}`);
  if (enqsCount > 0) heldBy.push(`${enqsCount} enquir${enqsCount === 1 ? 'y' : 'ies'}`);
  const isLocked = heldBy.length > 0;

  const statusPill = (kind: 'job' | 'quote' | 'enquiry', s?: string) => {
    const maps: Record<string, Record<string, string>> = {
      enquiry: { New: 'neutral', Qualified: 'active', Quoted: 'active', Converted: 'done', Lost: 'bad' },
      quote: {
        Generated: 'neutral',
        'Verification Required': 'active',
        'Admin Approval Required': 'active',
        Approved: 'neutral',
        'Not Approved': 'bad',
        Sent: 'active',
        'Followup Needed': 'active',
        Converted: 'done',
        'Not Converted': 'bad'
      },
      job: { Planned: 'neutral', 'In Progress': 'active', 'On Hold': 'bad', Completed: 'done', Cancelled: 'bad' }
    };
    const cls = (s && maps[kind]?.[s]) || 'neutral';
    return (
      <span className={`cd-st cd-st-${cls}`}>
        <i />
        {s || '–'}
      </span>
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const insights = activity.insights || {};
  const ordersStat = insights.orders || {};

  return (
    <div className={`cd-overlay ${drawerOpen ? 'cd-with-drawer' : ''}`} onClick={onClose}>
      <div className="cd-modal" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="cd-head">
          <div className="cd-avatar">{initials}</div>
          <div className="cd-id">
            <div className="cd-name">{client.displayName || client.name || '–'}</div>
            <div className="cd-meta">
              {client.clientCode || '–'} · {client.country || 'India'}
            </div>
          </div>
          <div className="cd-actions">
            {gaps.length > 0 && (
              <div className="cd-gaps-wrap">
                <button
                  type="button"
                  className={`cd-gaps-btn ${gapsOpen ? 'on' : ''}`}
                  onClick={() => setGapsOpen(!gapsOpen)}
                >
                  <AlertTriangle size={14} className="text-orange-500" />
                  {gaps.length} to complete
                </button>
                {gapsOpen && (
                  <div className="cd-gaps-pop">
                    <div className="cd-gaps-title">Unfinished details</div>
                    <ul>
                      {gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="btn-primary-orange text-xs py-1.5 px-3 h-8 w-full justify-center"
                      onClick={() => {
                        setGapsOpen(false);
                        onEdit(client);
                      }}
                    >
                      <Edit size={13} /> Complete in Edit
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className={`cd-insights-btn ${drawerOpen ? 'on' : ''}`}
              onClick={() => setDrawerOpen(!drawerOpen)}
            >
              <BarChart2 size={15} />
              Insights
            </button>

            <button
              type="button"
              className="action-icon-btn"
              title="Edit"
              onClick={() => onEdit(client)}
            >
              <Edit size={15} />
            </button>

            <button
              type="button"
              className={`action-icon-btn danger ${isLocked ? 'cd-locked' : ''}`}
              title={isLocked ? `Can't be deleted: this client has ${heldBy.join(', ')}` : 'Delete'}
              disabled={isLocked}
              onClick={() => !isLocked && onDelete(client.id)}
            >
              {isLocked ? <Lock size={15} /> : <Trash2 size={15} />}
            </button>

            <button
              type="button"
              className="action-icon-btn"
              title="Close"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Split Body */}
        <div className="cd-split">
          {/* Left Rail (330px) */}
          <aside className="cd-rail">
            {client.pendingValidation && (
              <div className="p-3 mb-4 bg-orange-50 border-l-4 border-orange-500 rounded text-xs text-stone-800">
                <b className="font-bold">Needs review.</b> Fix these with Edit and save:
                <ul className="list-disc pl-4 mt-1">
                  {(client.validationIssues || []).map((iss: string, i: number) => (
                    <li key={i}>{iss}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contact Block */}
            <section className="cd-block">
              <h4 className="cd-label">Contact</h4>
              {client.clientType === 'Business' && client.contactPerson && (
                <div className="cd-item">
                  <span className="cd-ico"><User size={16} /></span>
                  <div className="cd-item-body">
                    <div className="cd-person">{client.contactPerson}</div>
                    <div className="cd-cap">Contact person</div>
                  </div>
                </div>
              )}

              {phoneDetails.length > 0 ? (
                phoneDetails.map((p, idx) => (
                  <div className="cd-item" key={idx}>
                    <span className="cd-ico"><Phone size={16} /></span>
                    <div className="cd-item-body">
                      <div className="cd-phone-line">
                        <span className="font-semibold text-stone-900">
                          {p.dial && <span className="cd-dial">{p.dial}</span>}
                          {p.number}
                        </span>
                        {p.valid ? (
                          <span className="cd-valid" title="Valid number formatting">
                            <Check size={11} /> {p.kind || 'Valid'}
                          </span>
                        ) : (
                          <span className="cd-invalid" title="Invalid format">
                            <AlertTriangle size={11} /> Check
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="cd-item">
                  <span className="cd-ico"><Phone size={16} /></span>
                  <div className="cd-item-body clt-faint">No phone on file</div>
                </div>
              )}

              {(client.emails || []).map((e: string, idx: number) => (
                <div className="cd-item" key={idx}>
                  <span className="cd-ico"><Mail size={16} /></span>
                  <div className="cd-item-body">
                    <a href={`mailto:${e}`} className="text-stone-800 hover:text-orange-600 transition-colors">
                      {e}
                    </a>
                  </div>
                </div>
              ))}
            </section>

            {/* Billing Address Block */}
            <section className="cd-block">
              <h4 className="cd-label">Billing address</h4>
              <div className="cd-item">
                <span className="cd-ico"><MapPin size={16} /></span>
                <div className="cd-item-body">
                  {billing ? (
                    <div className="leading-relaxed">
                      {addressLines(billing).map((l, i) => (
                        <div key={i}>{l}</div>
                      ))}
                    </div>
                  ) : (
                    <span className="clt-faint">No address on file</span>
                  )}
                </div>
              </div>
            </section>

            {/* Details Block */}
            <section className="cd-block">
              <h4 className="cd-label">Details</h4>
              <div className="cd-item">
                <span className="cd-ico"><Tag size={16} /></span>
                <div className="cd-item-body">
                  <div className="cd-fact-label">Source</div>
                  <div className="cd-fact-val font-semibold">
                    {client.sourceCategory || client.sourceCategoryId || <span className="clt-faint">Not recorded</span>}
                  </div>
                </div>
              </div>

              {client.sourceName && (
                <div className="cd-item">
                  <span className="cd-ico"><Handshake size={16} /></span>
                  <div className="cd-item-body">
                    <div className="cd-fact-label">Referred by</div>
                    <div className="cd-fact-val font-semibold">{client.sourceName}</div>
                  </div>
                </div>
              )}

              <div className="cd-item">
                <span className="cd-ico"><Briefcase size={16} /></span>
                <div className="cd-item-body">
                  <div className="cd-fact-label">Business mode</div>
                  <div className="cd-fact-val font-semibold">{client.businessMode || 'B2B'}</div>
                </div>
              </div>

              {(client.taxId || client.countryIso2 === 'IN' || client.country === 'India') && (
                <div className="cd-item">
                  <span className="cd-ico"><Receipt size={16} /></span>
                  <div className="cd-item-body">
                    <div className="cd-fact-label">GSTIN</div>
                    <div className="cd-fact-val font-semibold">
                      {client.taxId || <span className="clt-faint">Not provided</span>}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </aside>

          {/* Right Main Body: Document Tabs */}
          <div className="cd-main">
            <div className="cd-tabs">
              <button
                type="button"
                className={`detail-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('orders')}
              >
                Job Orders
                <span className="cd-count">{activity.jobOrders?.length || 0}</span>
              </button>
              <button
                type="button"
                className={`detail-tab-btn ${activeTab === 'quotes' ? 'active' : ''}`}
                onClick={() => setActiveTab('quotes')}
              >
                Quotations
                <span className="cd-count">{activity.quotations?.length || 0}</span>
              </button>
              <button
                type="button"
                className={`detail-tab-btn ${activeTab === 'enquiries' ? 'active' : ''}`}
                onClick={() => setActiveTab('enquiries')}
              >
                Enquiries
                <span className="cd-count">{activity.enquiries?.length || 0}</span>
              </button>
            </div>

            <div className="cd-main-body">
              {/* TAB 1: JOB ORDERS */}
              {activeTab === 'orders' && (
                <div>
                  {activity.jobOrders?.length === 0 ? (
                    <div className="text-center py-12 text-sm text-stone-400">
                      No job orders for this client yet.
                    </div>
                  ) : (
                    activity.jobOrders.map((j: any) => {
                      const isOpen = expandedId === `job:${j.id}`;
                      const tracks = [
                        ['BOM', j.bomStatus],
                        ['Procurement', j.procurementStatus],
                        ['Production', j.productionStatus]
                      ];

                      // 7-Milestone Journey calculation
                      const isCancelled = j.status === 'Cancelled';
                      const isHold = j.status === 'On Hold';
                      const prodState = isCancelled ? 'bad' : isHold ? 'bad' : tracks.every(t => t[1] === 'Completed') ? 'done' : 'active';

                      const steps = [
                        { label: 'Enquiry', state: j.enquiryId ? 'done' : 'skip', sub: j.enquiryId ? shortDate(j.createdAt) : 'Direct order' },
                        { label: 'Quotation', state: j.quotationId ? 'done' : 'skip', sub: j.quotationId ? shortDate(j.createdAt) : 'Direct order' },
                        { label: 'Order', state: isCancelled ? 'bad' : 'done', sub: shortDate(j.orderDate) },
                        { label: 'Production', state: prodState, sub: isCancelled ? 'Cancelled' : isHold ? 'On hold' : shortDate(j.productionDueDate), tracks },
                        { label: 'QC', state: 'soon' },
                        { label: 'Dispatch', state: 'soon' },
                        { label: 'Installation', state: 'soon' }
                      ];

                      return (
                        <article
                          key={j.id}
                          className={`cdo ${isOpen ? 'open' : ''}`}
                          onClick={() => toggleExpand(`job:${j.id}`)}
                        >
                          <div className="cdo-top">
                            <div className="cdo-id">
                              <div className="cd-lead">{j.jobNumber}</div>
                              <div className="cd-sub">
                                {[j.orderTypeName, j.poNumber ? `PO ${j.poNumber}` : '', `${j.lineCount || 0} products`]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            </div>
                            <div className="cdo-value">
                              {j.currency !== 'INR' ? `${j.currency} ${j.grandTotal}` : formatRupees(j.rupees)}
                              {j.currency !== 'INR' && <div className="cd-sub">{formatRupees(j.rupees)}</div>}
                            </div>
                            {statusPill('job', j.status)}
                            <span className="clt-chev">
                              <ChevronDown size={16} />
                            </span>
                          </div>

                          {/* 7-Step Milestone Journey */}
                          <ol className="cdj">
                            {steps.map((st, sIdx) => {
                              const next = steps[sIdx + 1];
                              const lineDone = next && st.state === 'done' && ['done', 'active', 'bad'].includes(next.state);
                              return (
                                <li key={sIdx} className={`cdj-step cdj-${st.state} ${lineDone ? 'cdj-line-done' : ''}`}>
                                  <span className="cdj-dot">
                                    {st.state === 'done' && <Check size={11} />}
                                  </span>
                                  <span className="cdj-label">{st.label}</span>
                                  {st.state === 'soon' ? (
                                    <span className="cdj-sub cdj-soon">Soon</span>
                                  ) : (
                                    <span className="cdj-sub">{st.sub}</span>
                                  )}
                                  {st.tracks && (
                                    <span className="cdj-tracks">
                                      {st.tracks.map((t, tIdx) => (
                                        <i
                                          key={tIdx}
                                          className={`cdj-pip ${t[1] === 'Completed' ? 'done' : t[1] === 'In Progress' ? 'active' : ''}`}
                                          title={`${t[0]}: ${t[1] || 'Pending'}`}
                                        />
                                      ))}
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ol>

                          {/* Expandable in-place details */}
                          {isOpen && (
                            <div className="mt-4 pt-4 border-t border-dashed border-stone-200">
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <span className="font-bold text-stone-500 uppercase tracking-wider block mb-1">Products</span>
                                  <ul className="divide-y divide-stone-100">
                                    {(j.lines || []).map((l: any, lIdx: number) => (
                                      <li key={lIdx} className="py-1 flex justify-between">
                                        <span>{l.name}</span>
                                        <b className="tabular-nums">{l.quantity} {l.unit}</b>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="space-y-1">
                                  <div><span className="text-stone-400">Ordered:</span> <b>{formatDate(j.orderDate)}</b></div>
                                  <div><span className="text-stone-400">Due:</span> <b>{formatDate(j.productionDueDate)}</b></div>
                                  <div><span className="text-stone-400">Project Manager:</span> <b>{j.projectManagerName || '–'}</b></div>
                                  <div><span className="text-stone-400">Quotation:</span> <b>{j.quotationCode || 'Direct order'}</b></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2: QUOTATIONS */}
              {activeTab === 'quotes' && (
                <div>
                  {activity.quotations?.length === 0 ? (
                    <div className="text-center py-12 text-sm text-stone-400">
                      No quotations for this client yet.
                    </div>
                  ) : (
                    <table className="cd-table">
                      <thead>
                        <tr>
                          <th>Quotation</th>
                          <th>Date</th>
                          <th>Value</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activity.quotations.map((q: any) => (
                          <tr key={q.id}>
                            <td>
                              <div className="cd-lead">{q.code}</div>
                              <div className="cd-sub">Version v{q.versionNo || 1}</div>
                            </td>
                            <td>{formatDate(q.createdAt)}</td>
                            <td className="font-bold tabular-nums">{formatRupees(q.grandTotal)}</td>
                            <td>{statusPill('quote', q.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* TAB 3: ENQUIRIES */}
              {activeTab === 'enquiries' && (
                <div>
                  {activity.enquiries?.length === 0 ? (
                    <div className="text-center py-12 text-sm text-stone-400">
                      No enquiries for this client yet.
                    </div>
                  ) : (
                    <table className="cd-table">
                      <thead>
                        <tr>
                          <th>Enquiry</th>
                          <th>Date</th>
                          <th>Salesperson</th>
                          <th>Opportunity</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activity.enquiries.map((e: any) => (
                          <tr key={e.id}>
                            <td>
                              <div className="cd-lead">{e.code}</div>
                              <div className="cd-sub">{e.productCount || 0} products</div>
                            </td>
                            <td>{formatDate(e.createdAt)}</td>
                            <td>{e.salespersonName || '–'}</td>
                            <td className="font-bold tabular-nums">
                              {e.opportunityValue ? formatRupees(e.opportunityValue) : '–'}
                            </td>
                            <td>{statusPill('enquiry', e.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Insights Drawer (Photo 4) */}
      <aside className={`cd-drawer ${drawerOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="cdi-head">
          <h3>
            Insights
            <Info size={14} className="text-stone-400 ml-1 inline" />
          </h3>
          <button
            type="button"
            className="action-icon-btn"
            title="Close insights"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={15} />
          </button>
        </div>

        <div className="cdi-body">
          {/* Lifetime Order Value Hero */}
          <div className="cdi-hero">
            <span className="cd-label">Lifetime order value</span>
            <div className="cdi-big">
              {insights.lifetimeValue ? formatRupees(insights.lifetimeValue) : '–'}
            </div>
            <div className="cdi-hero-sub">
              {ordersStat.total ? `${ordersStat.total} orders` : 'No orders yet'}
              {ordersStat.cancelled ? ` · ${ordersStat.cancelled} cancelled` : ''}
              {insights.averageOrderValue ? ` · average ${formatRupees(insights.averageOrderValue)}` : ''}
            </div>

            {insights.sharePct != null && (
              <div className="cdi-share">
                <div className="cdi-bar">
                  <i style={{ width: `${Math.min(100, insights.sharePct)}%` }} />
                </div>
                <span>
                  {insights.sharePct.toFixed(1)}% of all order value · rank {insights.rank} of{' '}
                  {insights.clientsWithOrders} clients
                </span>
              </div>
            )}
          </div>

          {/* Order Rhythm Grid */}
          <div className="cdi-grid">
            <div className="cdi-stat">
              <span className="cd-label">Open orders</span>
              <b>{ordersStat.open || 0}</b>
              <small>{ordersStat.open ? `${formatRupees(insights.openOrderValue)} running` : 'none running'}</small>
            </div>
            <div className="cdi-stat">
              <span className="cd-label">Last order</span>
              <b>{insights.daysSinceLastOrder != null ? `${insights.daysSinceLastOrder} days ago` : '–'}</b>
              <small>{formatDate(insights.lastOrderDate)}</small>
            </div>
            <div className="cdi-stat">
              <span className="cd-label">Orders every</span>
              <b>{insights.averageDaysBetweenOrders != null ? `${insights.averageDaysBetweenOrders} days` : '–'}</b>
              <small>{insights.averageDaysBetweenOrders != null ? 'on average' : 'needs 2 orders'}</small>
            </div>
            <div className="cdi-stat">
              <span className="cd-label">First order</span>
              <b>{insights.firstOrderDate ? formatDate(insights.firstOrderDate) : '–'}</b>
              <small>{insights.clientSince ? `client since ${formatDate(insights.clientSince)}` : ''}</small>
            </div>
          </div>

          {/* Pipeline Grid */}
          <h4 className="cd-label cdi-h">Pipeline</h4>
          <div className="cdi-grid">
            <div className="cdi-stat">
              <span className="cd-label">Enquiries</span>
              <b>{insights.enquiries?.total || 0}</b>
              <small>
                {insights.enquiries?.total
                  ? `${insights.enquiries.converted} converted · ${insights.enquiries.lost} lost`
                  : 'none yet'}
              </small>
            </div>
            <div className="cdi-stat">
              <span className="cd-label">Enquiry to order</span>
              <b>{insights.enquiries?.conversionPct != null ? `${insights.enquiries.conversionPct}%` : '–'}</b>
              <small>of decided enquiries</small>
            </div>
            <div className="cdi-stat">
              <span className="cd-label">Quotations</span>
              <b>{insights.quotes?.total || 0}</b>
              <small>
                {insights.quotes?.total
                  ? `${insights.quotes.won} won · ${insights.quotes.lost} lost`
                  : 'none yet'}
              </small>
            </div>
            <div className="cdi-stat">
              <span className="cd-label">Win rate</span>
              <b>{insights.quotes?.winPct != null ? `${insights.quotes.winPct}%` : '–'}</b>
              <small>{insights.quotes?.open ? `${formatRupees(insights.quotes.openValue)} open` : 'none open'}</small>
            </div>
          </div>

          {/* What They Buy: Product Bars */}
          <h4 className="cd-label cdi-h">What they buy</h4>
          {(insights.topProducts || []).length > 0 ? (
            insights.topProducts.map((p: any, idx: number) => {
              const maxRupees = insights.topProducts[0]?.rupees || 1;
              const pct = Math.max(5, (p.rupees / maxRupees) * 100);
              return (
                <div key={idx} className="cdi-prod">
                  <div className="cdi-prod-top">
                    <span>{p.name}</span>
                    <b>{formatRupees(p.rupees)}</b>
                  </div>
                  <div className="cdi-bar thin">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <small>
                    {p.quantity} {p.unit} · {p.orders} order{p.orders === 1 ? '' : 's'}
                  </small>
                </div>
              );
            })
          ) : (
            <p className="cdi-note">Nothing ordered yet.</p>
          )}

          {/* Additional Facts */}
          <div className="cdi-more">
            <div>
              <span className="cd-label">Billed in</span>
              <span>{(insights.currencies || []).join(', ') || 'INR'}</span>
            </div>
            <div>
              <span className="cd-label">Handled by</span>
              <span>{(insights.salespersons || []).join(', ') || '–'}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
