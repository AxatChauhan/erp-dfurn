'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Edit,
  Eye,
  FileText,
  History,
  Link as LinkIcon,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  MoreVertical,
  Phone,
  Plus,
  Receipt,
  Trash2,
  Upload,
  User,
  X,
  AlertTriangle,
  Briefcase,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/lib/dates';
import {
  versionLabelOf,
  followupInfo,
  computeLineTotal,
  buildVersionComputedFields,
  readinessOf,
  clientChecks,
  isIndianBusiness,
  billingAddressOf,
  normalizeQuoteStatus
} from '@/lib/quotations/quoteService';
import { generateQuotationPDF } from '@/lib/quotations/quotePdfGenerator';
import ParameterHistoryModal from './ParameterHistoryModal';
import ReviseConfirmationModal from './ReviseConfirmationModal';
import ProductCatalogPickerModal, { SelectedProductItem } from '@/components/products/ProductCatalogPickerModal';

interface QuotationDetailModalProps {
  quoteId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'terms', label: 'Terms' },
  { key: 'history', label: 'History' },
  { key: 'logs', label: 'Communication' },
  { key: 'files', label: 'Files' }
] as const;

const STATUS_LABELS: Record<string, string> = {
  Draft: 'Draft',
  'Verification Required': 'Verification required',
  VERIFICATION_REQUIRED: 'Verification required',
  'Admin Approval Required': 'To approve',
  ADMIN_APPROVAL_REQUIRED: 'To approve',
  Approved: 'Approved',
  APPROVED: 'Approved',
  'Not Approved': 'Not approved',
  Sent: 'Sent',
  SENT: 'Sent',
  'Followup Needed': 'Follow up',
  Converted: 'Won',
  CONVERTED: 'Won',
  'Not Converted': 'Lost'
};

const STATUS_CLASSES: Record<string, string> = {
  Draft: 'neutral',
  'Verification Required': 'active',
  VERIFICATION_REQUIRED: 'active',
  'Admin Approval Required': 'active',
  ADMIN_APPROVAL_REQUIRED: 'active',
  Approved: 'done',
  APPROVED: 'done',
  'Not Approved': 'bad',
  Sent: 'active',
  SENT: 'active',
  'Followup Needed': 'bad',
  Converted: 'done',
  CONVERTED: 'done',
  'Not Converted': 'bad'
};

export default function QuotationDetailModal({
  quoteId,
  isOpen,
  onClose,
  onChanged
}: QuotationDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('SALES');

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)user_role=([^;]+)/);
    if (match) setUserRole(decodeURIComponent(match[1]));
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.user?.role) setUserRole(d.user.role);
      })
      .catch(() => {});
  }, []);

  // Editing state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('products');
  const [viewingVersionNo, setViewingVersionNo] = useState<number | null>(null);
  const [openSpecs, setOpenSpecs] = useState<Set<string>>(new Set());

  const toggleSpecs = (lineId: string) => {
    setOpenSpecs(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  const handlePickProduct = (selected: SelectedProductItem) => {
    const newItem = {
      lineId: `line-${Date.now()}`,
      refType: selected.refType || 'MasterProduct',
      refId: selected.refId,
      snapshot: {
        name: selected.name,
        code: selected.code,
        unit: selected.unit || 'Nos',
        imageUrl: selected.thumbnail,
      },
      description: selected.clientComment || selected.name,
      quantity: selected.quantity,
      unitPrice: selected.unitPrice,
      discountType: null,
      discountValue: 0,
      expectedDimensions: selected.expectedDimensions,
      materialPreference: selected.materialPreference || null,
      clientComment: selected.clientComment || null,
      customizations: [],
    };
    if (draft) {
      setDraft({ ...draft, items: [...(draft.items || []), newItem] });
    }
  };

  // Modals inside detail
  const [menuOpen, setMenuOpen] = useState(false);
  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [paramHistory, setParamHistory] = useState<{
    lineId: string;
    field: string;
    label: string;
    lineName: string;
  } | null>(null);

  // PDF Generation
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Quick Communication & File upload
  const [showLogForm, setShowLogForm] = useState(false);
  const [logMode, setLogMode] = useState('Call');
  const [logDesc, setLogDesc] = useState('');
  const [logComment, setLogComment] = useState('');

  // Fetch Quotation Details
  const fetchDetail = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/quotations/${id}`);
      if (!res.ok) throw new Error('Failed to load quotation');
      const data = await res.json();
      setQuote(data);
      initializeDraft(data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error fetching quotation detail');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const initializeDraft = (data: any) => {
    const v = data.latestVersion || {};
    setDraft({
      items: (v.items || []).map((it: any) => ({
        ...it,
        snapshot: { ...(it.snapshot || {}) },
        customizations: (it.customizations || []).map((c: any) => ({ ...c }))
      })),
      additionalCharges: (v.additionalCharges || []).map((c: any) => ({ ...c })),
      gstApplicable: v.gstApplicable !== false,
      gstRatePct: v.gstRatePct != null ? v.gstRatePct : 18.0,
      overallDiscountType: v.overallDiscountType || 'percent',
      overallDiscountVal: v.overallDiscountVal || 0,
      validUntil: v.validUntil ? v.validUntil.slice(0, 10) : '',
      terms: Array.isArray(v.terms) ? [...v.terms] : [],
      salespersonId: data.salespersonId || '',
      salespersonName: data.salespersonName || ''
    });
    setEditing(false);
    setViewingVersionNo(null);
  };

  useEffect(() => {
    if (isOpen && quoteId) {
      fetchDetail(quoteId);
    } else {
      setQuote(null);
      setDraft(null);
      setEditing(false);
      setViewingVersionNo(null);
    }
  }, [isOpen, quoteId]);

  if (!isOpen) return null;

  if (loading || !quote) {
    return (
      <div className="wizard-overlay">
        <div className="qd-modal" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: '#FF7700', marginBottom: 12 }} />
          <p style={{ color: '#8B8778', fontSize: 14 }}>Loading quotation...</p>
        </div>
      </div>
    );
  }

  // Active / Viewing Version
  const isViewingOld = viewingVersionNo !== null && viewingVersionNo !== quote.currentVersionNo;
  const currentVer = isViewingOld
    ? (quote.versions || []).find((v: any) => v.versionNo === viewingVersionNo) || quote.latestVersion || quote.versions?.[0] || { versionNo: 1, status: quote.status || 'Draft', items: [], additionalCharges: [] }
    : quote.latestVersion || quote.versions?.[0] || { versionNo: 1, status: quote.status || 'Draft', items: [], additionalCharges: [] };

  const effectiveVerLabel = versionLabelOf(currentVer.versionNo || 1);
  const canonicalStatus = normalizeQuoteStatus(currentVer.status || quote.status);

  // Live totals based on draft during editing or currentVer when viewing
  const currentTotals = editing && draft ? buildVersionComputedFields(draft) : currentVer;

  // Live readiness check
  const liveReadiness = readinessOf(
    {
      ...quote,
      latestVersion: {
        ...currentVer,
        ...(editing ? draft : {}),
        items: editing ? draft.items : currentVer.items
      }
    },
    quote.client
  );

  const clientChecklist = clientChecks(quote.client);
  const indianBiz = isIndianBusiness(quote.client);
  const isDraftStatus = canonicalStatus === 'Draft';

  // ---------------- Handlers ----------------

  const handleExecuteAction = async (action: string, payload: any = {}) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/quotations/${quote.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Action failed');
      }
      toast.success(`Quotation updated to ${data.status}`);
      await fetchDetail(quote.id);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update quotation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmSaveRevision = async (reason: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/quotations/${quote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          reason
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save changes');
      }
      toast.success(`Saved as ${data.versionLabel}`);
      setReviseModalOpen(false);
      setEditing(false);
      await fetchDetail(quote.id);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save changes');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!confirm('Delete this draft? It was never submitted, so it has no number. This cannot be undone.')) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/quotations/${quote.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success('Draft deleted');
      onClose();
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      await generateQuotationPDF(quote, currentVer);
      toast.success('Quotation PDF downloaded');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error(err.message || 'Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleAddLog = async () => {
    if (!logDesc.trim()) return toast.error('Please enter a description');
    await handleExecuteAction('LOG_FOLLOWUP', {
      mode: logMode,
      description: logDesc,
      comment: logComment
    });
    setLogDesc('');
    setLogComment('');
    setShowLogForm(false);
  };

  return (
    <div className="wizard-overlay">
      <div className="qd-modal" role="dialog" aria-modal="true">
        {/* ===================================================================
            HEADER: Back, Avatar, Title/Code, Total Chip, Workflow Actions
            =================================================================== */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderBottom: '1px solid #EEE9DF',
            background: '#FFFFFF'
          }}
        >
          {/* Left: Back + Avatar + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              className="hier-cancel-btn qd-btn"
              onClick={() => {
                if (editing && !confirm('Leave without saving changes?')) return;
                onClose();
              }}
              style={{ padding: '0 12px' }}
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#F4F1EA',
                color: '#736E62',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14
              }}
            >
              {(quote.clientName || 'C').slice(0, 2).toUpperCase()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
                  {quote.clientName}
                </h3>
                <span
                  className={`cd-st cd-st-${
                    canonicalStatus === 'Draft'
                      ? 'neutral'
                      : canonicalStatus === 'Converted'
                        ? 'done'
                        : canonicalStatus.includes('Not')
                          ? 'bad'
                          : 'active'
                  }`}
                >
                  <i /> {canonicalStatus}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#A39B8B', marginTop: 2 }}>
                {quote.code ? `${quote.code} · ${effectiveVerLabel}` : `Draft for ${quote.enquiryCode || 'Enquiry'}`}
                {quote.enquiryCode && ` · From ${quote.enquiryCode}`}
              </div>
            </div>
          </div>

          {/* Right: Total Chip + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="qd-total-chip">
              <small>TOTAL</small>
              <b>₹{Math.round(currentTotals.grandTotal || 0).toLocaleString('en-IN')}</b>
            </div>

            {editing ? (
              <>
                <button
                  type="button"
                  className="hier-cancel-btn qd-btn"
                  onClick={() => {
                    initializeDraft(quote);
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary qd-btn"
                  onClick={() => setReviseModalOpen(true)}
                  disabled={actionLoading}
                >
                  Save changes
                </button>
              </>
            ) : isViewingOld ? (
              <button
                type="button"
                className="btn-primary qd-btn"
                onClick={() => setViewingVersionNo(null)}
              >
                Back to current ({versionLabelOf(quote.currentVersionNo)})
              </button>
            ) : (
              <>
                {/* Edit Button */}
                {canonicalStatus !== 'Converted' && canonicalStatus !== 'Not Converted' && (
                  <button
                    type="button"
                    className="hier-cancel-btn qd-btn"
                    onClick={() => setEditing(true)}
                  >
                    <Edit size={14} /> Edit quotation
                  </button>
                )}

                {/* Workflow Transitions */}
                {isDraftStatus && (
                  <button
                    type="button"
                    className="btn-primary qd-btn"
                    onClick={() => handleExecuteAction('SUBMIT_FOR_VERIFICATION')}
                    disabled={!liveReadiness.ready || actionLoading}
                    title={!liveReadiness.ready ? `Needs: ${liveReadiness.items.filter(i => !i.done).map(i => i.label).join(', ')}` : ''}
                  >
                    Submit for approval
                    {!liveReadiness.ready && (
                      <span
                        style={{
                          background: '#FF7700',
                          color: '#FFF',
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 10,
                          marginLeft: 4
                        }}
                      >
                        {liveReadiness.left} left
                      </span>
                    )}
                  </button>
                )}

                {canonicalStatus === 'Verification Required' && (
                  <button
                    type="button"
                    className="btn-primary qd-btn"
                    onClick={() => handleExecuteAction('VERIFY')}
                    disabled={actionLoading}
                  >
                    Verify
                  </button>
                )}

                {canonicalStatus === 'Admin Approval Required' && (
                  userRole === 'SUPER_ADMIN' ? (
                    <>
                      <button
                        type="button"
                        className="btn-primary qd-btn"
                        onClick={() => handleExecuteAction('APPROVE')}
                        disabled={actionLoading}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="hier-cancel-btn qd-btn"
                        onClick={() => handleExecuteAction('REJECT_APPROVAL')}
                        disabled={actionLoading}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span
                      className="qd-pending-chip"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: '#FEF3C7',
                        color: '#92400E',
                        fontSize: 12,
                        fontWeight: 600
                      }}
                    >
                      <Clock size={13} /> Awaiting Super Admin Approval
                    </span>
                  )
                )}

                {canonicalStatus === 'Approved' && (
                  <button
                    type="button"
                    className="btn-primary qd-btn"
                    onClick={() => handleExecuteAction('MARK_SENT')}
                    disabled={actionLoading}
                  >
                    Mark as sent
                  </button>
                )}

                {canonicalStatus === 'Sent' && (
                  <>
                    <button
                      type="button"
                      className="hier-cancel-btn qd-btn"
                      onClick={() => {
                        setActiveTab('logs');
                        setShowLogForm(true);
                      }}
                      disabled={actionLoading}
                      style={
                        currentVer.followupNeeded
                          ? { borderColor: '#FF7700', color: '#B15E00', background: '#FFF6EC' }
                          : {}
                      }
                    >
                      Log follow-up{currentVer.followupNeeded ? ' (overdue)' : ''}
                    </button>
                    <button
                      type="button"
                      className="btn-primary qd-btn"
                      onClick={() => handleExecuteAction('CONVERT')}
                      disabled={actionLoading}
                    >
                      Client approved
                    </button>
                    <button
                      type="button"
                      className="hier-cancel-btn qd-btn"
                      onClick={() => {
                        const reason = prompt('Why was this quotation rejected by the client?');
                        if (reason) handleExecuteAction('REJECT_CLIENT', { reason });
                      }}
                      disabled={actionLoading}
                    >
                      Client rejected
                    </button>
                  </>
                )}

                {canonicalStatus === 'Converted' && (
                  quote.linkedJobOrder ? (
                    <a
                      href={`/production/job-orders?open=${quote.linkedJobOrder.id}`}
                      className="hier-cancel-btn qd-btn"
                      style={{ textDecoration: 'none' }}
                    >
                      View {quote.linkedJobOrder.jobNumber}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary qd-btn"
                      onClick={() => toast.info('Job order conversion wizard is active in production')}
                    >
                      Convert to job order
                    </button>
                  )
                )}

                {/* PDF Download Button */}
                <button
                  type="button"
                  className="hier-cancel-btn qd-btn qd-pdf"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf || actionLoading}
                  title="Download Commercial Quotation PDF"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {downloadingPdf ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>

                {/* More Menu */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="hier-action-btn"
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{ width: 36, height: 36 }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 42,
                        background: '#FFF',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        borderRadius: 8,
                        padding: '6px 0',
                        minWidth: 160,
                        zIndex: 100,
                        border: '1px solid #EEE9DF'
                      }}
                    >
                      <button
                        type="button"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 14px',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                        onClick={() => {
                          setMenuOpen(false);
                          handleDownloadPdf();
                        }}
                      >
                        <Download size={14} /> Download PDF
                      </button>
                      <button
                        type="button"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 14px',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                        onClick={() => {
                          setMenuOpen(false);
                          window.open(`/clients?search=${encodeURIComponent(quote.clientName)}`, '_blank');
                        }}
                      >
                        <Edit size={14} /> Edit client
                      </button>
                      {isDraftStatus && !quote.code && (
                        <button
                          type="button"
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 14px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: '#C0392B',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}
                          onClick={() => {
                            setMenuOpen(false);
                            handleDeleteDraft();
                          }}
                        >
                          <Trash2 size={14} /> Delete draft
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        {/* ===================================================================
            BANNER (Revise notice or Old version banner)
            =================================================================== */}
        {isViewingOld ? (
          <div className="qd-banner old">
            <History size={16} />
            <span>
              You are looking at <b>{effectiveVerLabel}</b>, an earlier version. It cannot be changed.
            </span>
            <button
              type="button"
              className="hier-cancel-btn"
              onClick={() => setViewingVersionNo(null)}
              style={{ height: 28, fontSize: 12 }}
            >
              Back to {versionLabelOf(quote.currentVersionNo)}
            </button>
          </div>
        ) : editing ? (
          <div className="qd-banner revise">
            <Edit size={16} />
            <span>
              You are editing this quotation. Make all your changes, then press <b>Save changes</b>: they will be
              saved together as <b>{versionLabelOf(quote.currentVersionNo + 1)}</b> and {effectiveVerLabel} stays as it was.
            </span>
          </div>
        ) : null}

        {/* ===================================================================
            3-PANE BODY CONTAINER
            =================================================================== */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr) 300px', flex: 1, overflow: 'hidden' }}>
          {/* -------------------------------------------------------------
              PANE 1: LEFT RAIL (Client Info, Live Client Checks, Metadata)
              ------------------------------------------------------------- */}
          <aside
            style={{
              borderRight: '1px solid #EEE9DF',
              background: '#FBFAF7',
              padding: '20px 18px',
              overflowY: 'auto'
            }}
          >
            {/* Client summary card */}
            <section style={{ marginBottom: 20 }}>
              <h4 className="cd-label" style={{ fontSize: 11, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                CLIENT
              </h4>

              {quote.client?.contactPerson && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                  <User size={16} style={{ color: '#8B8778', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1A' }}>
                      {quote.client.contactPerson}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#A39B8B' }}>Contact person</div>
                  </div>
                </div>
              )}

              {/* Phone with validation badge */}
              {(() => {
                const phoneDetail = Array.isArray(quote.client?.phoneDetails) && quote.client.phoneDetails[0] ? quote.client.phoneDetails[0] : null;
                const phoneStr = phoneDetail?.e164 || (Array.isArray(quote.client?.phones) ? quote.client.phones[0] : null);
                const phoneKind = phoneDetail?.kind || 'Mobile or landline';
                if (!phoneStr) return null;
                return (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                    <Phone size={16} style={{ color: '#8B8778', marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 600 }}>{phoneStr}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span className="cd-valid">
                          <Check size={11} strokeWidth={3} /> {phoneKind}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Email */}
              {Array.isArray(quote.client?.emails) && quote.client.emails[0] && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                  <Mail size={16} style={{ color: '#8B8778', flexShrink: 0 }} />
                  <a
                    href={`mailto:${quote.client.emails[0]}`}
                    style={{ fontSize: 13, color: '#1A1A1A', textDecoration: 'none' }}
                  >
                    {quote.client.emails[0]}
                  </a>
                </div>
              )}

              {/* Multi-line Structured Address */}
              {(() => {
                const billing = billingAddressOf(quote.client);
                const lines: string[] = [];
                if (billing) {
                  if (billing.street || billing.addressLine1 || billing.addressLine) {
                    lines.push(billing.street || billing.addressLine1 || billing.addressLine);
                  }
                  if (billing.city || billing.pincode) {
                    lines.push([billing.city, billing.pincode].filter(Boolean).join(' '));
                  }
                  if (billing.state && !lines.some(l => l.includes(billing.state))) {
                    lines.push(billing.state);
                  }
                  if (billing.country) {
                    lines.push(billing.country);
                  }
                }
                if (!lines.length) return null;
                return (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                    <MapPin size={16} style={{ color: '#8B8778', marginTop: 2, flexShrink: 0 }} />
                    <div style={{ fontSize: 12.5, color: '#403E39', lineHeight: 1.45 }}>
                      {lines.map((l, i) => (
                        <div key={i}>{l}</div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {indianBiz && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Receipt size={16} style={{ color: '#8B8778', flexShrink: 0 }} />
                  <div style={{ fontSize: 12.5, color: '#1A1A1A' }}>
                    {quote.client?.taxId || quote.client?.gstin ? (
                      <span style={{ fontWeight: 600 }}>{quote.client.taxId || quote.client.gstin}</span>
                    ) : (
                      <span style={{ color: '#C0392B' }}>GSTIN Missing</span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Client checks live validation */}
            <section
              style={{
                background: '#FFFFFF',
                border: '1px solid #EEE9DF',
                borderRadius: 10,
                padding: '14px',
                marginBottom: 20
              }}
            >
              <h4 style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                CLIENT CHECKS <span style={{ fontSize: 12, color: '#A39B8B' }}>ⓘ</span>
              </h4>
              {clientChecklist.every((c: any) => c.ok) ? (
                <div className="qd-cv-ok">
                  <Check size={14} strokeWidth={2.5} /> All client details are complete
                </div>
              ) : (
                <>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {clientChecklist.map((c, idx) => (
                      <li
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          color: c.ok ? '#1E8A4C' : '#C0392B'
                        }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: c.ok ? '#E6F5EC' : '#FBEAE7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9,
                            fontWeight: 800
                          }}
                        >
                          {c.ok ? '✓' : '!'}
                        </span>
                        <span style={{ color: c.ok ? '#403E39' : '#C0392B' }}>
                          {c.label} {c.msg && <small style={{ color: '#C0392B' }}>({c.msg})</small>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="link"
                    style={{ marginTop: 10, display: 'block', fontSize: 12 }}
                    onClick={() => window.open(`/clients?search=${encodeURIComponent(quote.clientName)}`, '_blank')}
                  >
                    Fix in client profile →
                  </button>
                </>
              )}
            </section>

            {/* Quotation Facts metadata with icons */}
            <section>
              <h4 className="cd-label" style={{ fontSize: 11, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                QUOTATION
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 12.5 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <FileText size={16} style={{ color: '#8B8778', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#A39B8B', fontSize: 11 }}>Quotation</div>
                    <div style={{ fontWeight: 700, color: '#1A1A1A' }}>
                      {quote.code || 'Numbered when first submitted'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <History size={16} style={{ color: '#8B8778', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#A39B8B', fontSize: 11 }}>Version</div>
                    <div style={{ fontWeight: 700, color: '#1A1A1A' }}>
                      {effectiveVerLabel} of {quote.versions.length}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <LinkIcon size={16} style={{ color: '#8B8778', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#A39B8B', fontSize: 11 }}>From enquiry</div>
                    <div
                      style={{ fontWeight: 600, color: '#FF7700', cursor: 'pointer' }}
                      onClick={() => window.open(`/enquiries?open=${quote.enquiryId}`, '_blank')}
                    >
                      {quote.enquiryCode || '–'} →
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Briefcase size={16} style={{ color: '#8B8778', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#A39B8B', fontSize: 11 }}>Salesperson</div>
                    {editing ? (
                      <input
                        type="text"
                        className="field-input"
                        value={draft.salespersonName || ''}
                        onChange={e => setDraft({ ...draft, salespersonName: e.target.value })}
                        placeholder="Salesperson name"
                        style={{ height: 32, fontSize: 12, marginTop: 2 }}
                      />
                    ) : (
                      <div style={{ fontWeight: 600, color: '#1A1A1A' }}>
                        {quote.salespersonName || 'Not assigned'}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Calendar size={16} style={{ color: '#8B8778', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#A39B8B', fontSize: 11 }}>Valid until</div>
                    {editing ? (
                      <input
                        type="date"
                        className="field-input"
                        value={draft.validUntil || ''}
                        onChange={e => setDraft({ ...draft, validUntil: e.target.value })}
                        style={{ height: 32, fontSize: 12, marginTop: 2 }}
                      />
                    ) : (
                      <div style={{ fontWeight: 600, color: '#1A1A1A' }}>
                        {currentVer.validUntil ? formatDate(currentVer.validUntil) : 'Not set'}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <User size={16} style={{ color: '#8B8778', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#A39B8B', fontSize: 11 }}>Prepared by</div>
                    <div style={{ color: '#1A1A1A', fontWeight: 600 }}>
                      {quote.versions[0]?.createdByName || 'Admin'}{' '}
                      <span style={{ color: '#A39B8B', fontWeight: 400 }}>{formatDate(quote.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </aside>

          {/* -------------------------------------------------------------
              PANE 2: CENTER PANE (Tabs & Tab Contents)
              ------------------------------------------------------------- */}
          <main style={{ padding: '20px 24px', overflowY: 'auto', background: '#FFFFFF' }}>
            {/* What the client asked for (brief from enquiry) */}
            {quote.brief && (
              <div className="qd-brief">
                <h4 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase' }}>
                  What the client asked for
                </h4>
                <p>{quote.brief}</p>
              </div>
            )}

            {/* Tab navigation bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1.5px solid #EEE9DF',
                marginBottom: 20
              }}
            >
              <div style={{ display: 'flex', gap: 2 }}>
                {TABS.map(t => {
                  const count =
                    t.key === 'products'
                      ? (editing ? draft.items.length : currentVer.items.length)
                      : t.key === 'terms'
                        ? (editing ? draft.terms.length : (currentVer.terms || []).length)
                        : t.key === 'history'
                          ? quote.versions.length
                          : t.key === 'logs'
                            ? quote.communications.length
                            : t.key === 'files'
                              ? quote.files.length
                              : null;

                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      style={{
                        padding: '10px 14px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: activeTab === t.key ? 700 : 500,
                        color: activeTab === t.key ? '#1A1A1A' : '#8B8778',
                        borderBottom: activeTab === t.key ? '2px solid #1A1A1A' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {t.label}
                      {count !== null && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '1px 6px',
                            borderRadius: 10,
                            background: activeTab === t.key ? '#F4F1EA' : '#F8F6F0',
                            color: '#736E62'
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Direct header shortcuts */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="hier-cancel-btn qd-btn"
                  style={{ height: 30, fontSize: 12 }}
                  onClick={() => {
                    setActiveTab('logs');
                    setShowLogForm(true);
                  }}
                >
                  <MessageSquare size={13} /> Log communication
                </button>
                <button
                  type="button"
                  className="hier-cancel-btn qd-btn"
                  style={{ height: 30, fontSize: 12 }}
                  onClick={() => {
                    setActiveTab('files');
                  }}
                >
                  <Upload size={13} /> Upload file
                </button>
              </div>
            </div>

            {/* TAB CONTENT: PRODUCTS */}
            {activeTab === 'products' && (
              <div>
                <h4 className="cd-label" style={{ fontSize: 12, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginBottom: 12 }}>
                  Products
                </h4>

                {(editing ? draft.items : currentVer.items).map((item: any, idx: number) => {
                  const lineTotal = computeLineTotal(item).lineTotal;
                  const thumb = item.snapshot?.imageUrl || item.snapshot?.thumbnailUrl;
                  const isOpen = openSpecs.has(item.lineId);

                  return (
                    <div key={item.lineId || idx} className="qd-line">
                      <div className="qd-line-head">
                        <span className="qd-no">{idx + 1}</span>

                        {thumb ? (
                          <img className="qd-thumb" src={thumb} alt="" />
                        ) : (
                          <div
                            className="qd-thumb"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#F4F1EA',
                              border: '1px solid #E5DFD3',
                              borderRadius: 9
                            }}
                          >
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8B8778" strokeWidth="1.8">
                              <path d="M4 18v3M20 18v3M4 11h16M5 11V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M3 15h18a1 1 0 0 1 1 1v2H2v-2a1 1 0 0 1 1-1z" />
                            </svg>
                          </div>
                        )}

                        <div className="qd-name">
                          <b>{item.snapshot?.name || item.description || 'Custom Unit'}</b>
                          <span style={{ fontSize: 11.5, color: '#A39B8B' }}>
                            {item.snapshot?.code || (item.refType === 'Variant' ? 'WOR-PED-MET-002' : 'PROD-CUSTOM')}
                            {item.refType === 'MasterProduct' && ' · General Product'}
                          </span>
                        </div>

                        {/* Figures Block: Qty × Unit rate = Line total */}
                        <div className="qd-figs">
                          <div className="qd-fig">
                            <span className="qd-fl">Qty</span>
                            <div className="qd-fv">
                              {editing ? (
                                <input
                                  type="number"
                                  className="qd-in"
                                  min="1"
                                  value={item.quantity}
                                  onChange={e => {
                                    const next = [...draft.items];
                                    next[idx].quantity = Math.max(1, Number(e.target.value) || 1);
                                    setDraft({ ...draft, items: next });
                                  }}
                                />
                              ) : (
                                <span>{item.quantity}</span>
                              )}
                              <em>{item.snapshot?.unit || 'Nos'}</em>
                              {/* Parameter history button */}
                              {quote.versions.length > 1 && (
                                <button
                                  type="button"
                                  className="qd-hist"
                                  title="History of quantity"
                                  onClick={() =>
                                    setParamHistory({
                                      lineId: item.lineId,
                                      field: 'quantity',
                                      label: 'Quantity',
                                      lineName: item.snapshot?.name || item.description
                                    })
                                  }
                                >
                                  <Clock size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          <i className="qd-op">×</i>

                          <div className="qd-fig">
                            <span className="qd-fl">Unit rate</span>
                            <div className="qd-fv">
                              <span style={{ color: '#A39B8B' }}>₹</span>
                              {editing ? (
                                <input
                                  type="number"
                                  className="qd-in"
                                  min="0"
                                  step="any"
                                  value={item.unitPrice}
                                  onChange={e => {
                                    const next = [...draft.items];
                                    next[idx].unitPrice = Math.max(0, Number(e.target.value) || 0);
                                    setDraft({ ...draft, items: next });
                                  }}
                                />
                              ) : (
                                <span>{Number(item.unitPrice || 0).toLocaleString('en-IN')}</span>
                              )}
                              {quote.versions.length > 1 && (
                                <button
                                  type="button"
                                  className="qd-hist"
                                  title="History of unit rate"
                                  onClick={() =>
                                    setParamHistory({
                                      lineId: item.lineId,
                                      field: 'unitPrice',
                                      label: 'Unit rate',
                                      lineName: item.snapshot?.name || item.description
                                    })
                                  }
                                >
                                  <Clock size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          <i className="qd-op">=</i>

                          <div className="qd-fig total">
                            <span className="qd-fl">Line total</span>
                            <b className="qd-total">₹{Math.round(lineTotal).toLocaleString('en-IN')}</b>
                          </div>
                        </div>

                        {/* Line actions */}
                        {editing && (
                          <button
                            type="button"
                            className="hier-action-btn danger"
                            onClick={() => {
                              const next = draft.items.filter((_: any, i: number) => i !== idx);
                              setDraft({ ...draft, items: next });
                            }}
                            title="Remove product"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      {/* Line body (Fixed specs accordion & Notes) */}
                      <div className="qd-line-body">
                        <div style={{ marginBottom: 8 }}>
                          <button
                            type="button"
                            className={`qd-fixed-toggle ${isOpen ? 'on' : ''}`}
                            onClick={() => toggleSpecs(item.lineId)}
                          >
                            <ChevronDown
                              size={13}
                              style={{
                                transform: isOpen ? 'none' : 'rotate(-90deg)',
                                transition: 'transform 0.15s ease',
                                color: '#A39B8B'
                              }}
                            />
                            Fixed specifications <em>4</em>
                          </button>

                          {isOpen && (
                            <div className="ps-fixed">
                              <div className="ps-tag">Fixed</div>
                              <div className="ps-frow">
                                <span className="ps-fkey">Size</span>
                                <span className="ps-fval">{item.expectedDimensions || 'W 1200 × D 600 × H 750 mm'}</span>
                              </div>
                              <div className="ps-frow">
                                <span className="ps-fkey">Material</span>
                                <span className="ps-fval">{item.materialPreference || 'Action TESA Prelam MDF'}</span>
                              </div>
                              <div className="ps-frow">
                                <span className="ps-fkey">Finish</span>
                                <span className="ps-fval">1mm Merino Suede Laminate</span>
                              </div>
                              <div className="ps-frow">
                                <span className="ps-fkey">Hardware</span>
                                <span className="ps-fval">Hettich soft-close with 5-yr warranty</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {editing ? (
                          <input
                            type="text"
                            className="field-input qd-note"
                            placeholder="A note for this product (optional)"
                            value={item.description || ''}
                            onChange={e => {
                              const next = [...draft.items];
                              next[idx].description = e.target.value;
                              setDraft({ ...draft, items: next });
                            }}
                          />
                        ) : item.description ? (
                          <div className="qd-note-ro">
                            <MessageSquare size={13} /> {item.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {editing && (
                  <button
                    type="button"
                    className="wizard-add-row-btn"
                    onClick={() => setPickerOpen(true)}
                    style={{
                      marginTop: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#000000',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 18px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={15} /> + Add from Product Catalog
                  </button>
                )}
              </div>
            )}

            {/* TAB CONTENT: COMMERCIAL */}
            {activeTab === 'commercial' && (
              <div>
                <h4 className="cd-label" style={{ fontSize: 12, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginBottom: 12 }}>
                  Rates and discounts
                </h4>

                <div className="qd-ctable-wrap">
                  <table className="qd-ctable">
                    <thead>
                      <tr>
                        <th className="n">#</th>
                        <th>Product</th>
                        <th className="n">Qty</th>
                        <th className="n">Unit rate</th>
                        <th>Unit discount</th>
                        <th className="n">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(editing ? draft.items : currentVer.items).map((item: any, idx: number) => {
                        const { unitDiscount, lineTotal } = computeLineTotal(item);
                        return (
                          <tr key={item.lineId || idx}>
                            <td className="n">{idx + 1}</td>
                            <td>
                              <b>{item.snapshot?.name || item.description || 'Product'}</b>
                            </td>
                            <td className="n">{item.quantity}</td>
                            <td className="n">₹{Number(item.unitPrice || 0).toLocaleString('en-IN')}</td>
                            <td>
                              {editing ? (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <select
                                    value={item.discountType || ''}
                                    onChange={e => {
                                      const next = [...draft.items];
                                      next[idx].discountType = e.target.value || null;
                                      setDraft({ ...draft, items: next });
                                    }}
                                    style={{ height: 28, fontSize: 12, borderRadius: 6, border: '1px solid #D9D2C4' }}
                                  >
                                    <option value="">None</option>
                                    <option value="percent">%</option>
                                    <option value="flat">₹ Flat</option>
                                  </select>
                                  {item.discountType && (
                                    <input
                                      type="number"
                                      className="qd-in"
                                      style={{ width: 60, height: 28 }}
                                      value={item.discountValue || 0}
                                      onChange={e => {
                                        const next = [...draft.items];
                                        next[idx].discountValue = Number(e.target.value) || 0;
                                        setDraft({ ...draft, items: next });
                                      }}
                                    />
                                  )}
                                </div>
                              ) : unitDiscount > 0 ? (
                                item.discountType === 'percent' ? `${item.discountValue}%` : `₹${item.discountValue} off`
                              ) : (
                                <span style={{ color: '#A39B8B' }}>None</span>
                              )}
                            </td>
                            <td className="n" style={{ fontWeight: 700, color: '#1A1A1A' }}>
                              ₹{Math.round(lineTotal).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Additional charges & Summary Grid */}
                <div className="qd-cgrid">
                  <div>
                    <h4 className="cd-label" style={{ fontSize: 12, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginBottom: 10 }}>
                      Additional charges
                    </h4>

                    {(editing ? draft.additionalCharges : currentVer.additionalCharges || []).map(
                      (c: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.title}</span>
                          {editing ? (
                            <input
                              type="number"
                              className="field-input"
                              style={{ width: 100, height: 32 }}
                              value={c.amount}
                              onChange={e => {
                                const next = [...draft.additionalCharges];
                                next[idx].amount = Number(e.target.value) || 0;
                                setDraft({ ...draft, additionalCharges: next });
                              }}
                            />
                          ) : (
                            <b style={{ fontSize: 13 }}>₹{Number(c.amount || 0).toLocaleString('en-IN')}</b>
                          )}
                          {editing && (
                            <button
                              type="button"
                              className="hier-action-btn danger"
                              onClick={() => {
                                const next = draft.additionalCharges.filter((_: any, i: number) => i !== idx);
                                setDraft({ ...draft, additionalCharges: next });
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )
                    )}

                    {editing && (
                      <button
                        type="button"
                        className="wizard-add-row-btn"
                        onClick={() => {
                          const title = prompt('Enter additional charge header (e.g. Transportation, Installation):');
                          if (title) {
                            setDraft({
                              ...draft,
                              additionalCharges: [...draft.additionalCharges, { title, amount: 1000, taxable: true }]
                            });
                          }
                        }}
                        style={{ marginTop: 6 }}
                      >
                        + Add charge
                      </button>
                    )}

                    <h4 className="cd-label" style={{ fontSize: 12, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginTop: 24, marginBottom: 10 }}>
                      GST
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13 }}>
                        {(editing ? draft.gstApplicable : currentVer.gstApplicable !== false)
                          ? `Applicable at ${(editing ? draft.gstRatePct : currentVer.gstRatePct) || 18}%`
                          : 'Not applicable'}
                      </span>
                      {indianBiz && (
                        <span style={{ fontSize: 11.5, color: '#B15E00', background: '#FFF6EC', padding: '2px 8px', borderRadius: 4 }}>
                          Mandatory for Indian business
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summary Card */}
                  <div className="qd-sum">
                    <div className="qd-sum-row">
                      <span>Gross total</span>
                      <b>₹{Math.round(currentTotals.grossTotal || 0).toLocaleString('en-IN')}</b>
                    </div>
                    <div className="qd-sum-row">
                      <span>Overall discount</span>
                      <b>–₹{Math.round(currentTotals.overallDiscountAmt || 0).toLocaleString('en-IN')}</b>
                    </div>
                    <div className="qd-sum-row">
                      <span>Additional charges</span>
                      <b>₹{Math.round(currentTotals.extraCostsTotal || 0).toLocaleString('en-IN')}</b>
                    </div>
                    <div className="qd-sum-row">
                      <span>GST ({currentTotals.gstRatePct || 18}%)</span>
                      <b>₹{Math.round(currentTotals.gstAmount || 0).toLocaleString('en-IN')}</b>
                    </div>
                    <div className="qd-sum-row grand">
                      <span>Total</span>
                      <b>₹{Math.round(currentTotals.grandTotal || 0).toLocaleString('en-IN')}</b>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: TERMS */}
            {activeTab === 'terms' && (
              <div>
                <h4 className="cd-label" style={{ fontSize: 12, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginBottom: 12 }}>
                  Terms & Conditions
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(editing ? draft.terms : currentVer.terms || []).map((t: any, idx: number) => (
                    <div
                      key={t.id || idx}
                      style={{
                        padding: '12px 14px',
                        border: '1px solid #EEE9DF',
                        borderRadius: 8,
                        background: '#FBFAF7'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A', marginBottom: 4 }}>
                        {t.title || t.text}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#6F6858' }}>
                        {t.text || t.body}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: HISTORY (Version Cards + Grouped Diffs) */}
            {activeTab === 'history' && (
              <div>
                <h4 className="cd-label" style={{ fontSize: 12, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginBottom: 12 }}>
                  Version History
                </h4>
                <div className="qh">
                  {quote.versions.map((v: any) => {
                    const isCur = v.versionNo === quote.currentVersionNo;
                    const viewing = viewingVersionNo === v.versionNo || (isCur && viewingVersionNo === null);
                    const changes = Array.isArray(v.changes) ? v.changes : [];

                    return (
                      <section key={v.id || v.versionNo} className={`qh-card ${isCur ? 'cur' : ''}`}>
                        <div className="qh-head">
                          <b>{v.versionLabel}</b>
                          <span style={{ fontSize: 12, color: '#8B8778' }}>
                            {isCur ? quote.effectiveStatus : v.supersededAt ? 'Superseded' : v.status}
                          </span>
                          {isCur && <span className="qd-ver-cur">Current</span>}
                          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#A39B8B' }}>
                            {formatDateTime(v.createdAt)} · {v.createdByName || 'Admin'}
                          </span>
                        </div>

                        <div className="qh-sum">
                          <b>₹{Math.round(v.grandTotal || 0).toLocaleString('en-IN')}</b>
                          {changes.length > 0 && (
                            <span style={{ fontSize: 12, color: '#A39B8B', fontWeight: 400, marginLeft: 8 }}>
                              · {changes.length} change{changes.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>

                        {v.reason && <div className="qh-reason">“{v.reason}”</div>}

                        {/* Grouped Changes List */}
                        {changes.length > 0 ? (
                          <div className="qh-changes">
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 12.5 }}>
                              {changes.map((c: any, cIdx: number) => (
                                <li key={cIdx} style={{ padding: '3px 0', color: '#403E39' }}>
                                  {c.type === 'added' ? (
                                    <span>
                                      <span style={{ background: '#E6F5EC', color: '#1E8A4C', padding: '1px 6px', borderRadius: 4, marginRight: 6, fontSize: 11, fontWeight: 700 }}>
                                        Added
                                      </span>{' '}
                                      {c.to}
                                    </span>
                                  ) : c.type === 'removed' ? (
                                    <span>
                                      <span style={{ background: '#FBEAE7', color: '#C0392B', padding: '1px 6px', borderRadius: 4, marginRight: 6, fontSize: 11, fontWeight: 700 }}>
                                        Removed
                                      </span>{' '}
                                      {c.from}
                                    </span>
                                  ) : (
                                    <span>
                                      <b>{c.label}:</b> <span style={{ textDecoration: 'line-through', color: '#A39B8B' }}>{c.from}</span> → <b>{c.to}</b>
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : v.versionNo === 1 ? (
                          <div style={{ marginTop: 8, fontSize: 12, color: '#8B8778' }}>
                            Started from enquiry {quote.enquiryCode} with {v.items?.length || 1} product(s).
                          </div>
                        ) : null}

                        <div style={{ marginTop: 12 }}>
                          {viewing ? (
                            <span style={{ fontSize: 12, color: '#A39B8B' }}>Showing this version</span>
                          ) : (
                            <button
                              type="button"
                              className="link"
                              onClick={() => setViewingVersionNo(v.versionNo)}
                            >
                              Open this version
                            </button>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: COMMUNICATION */}
            {activeTab === 'logs' && (
              <div>
                <h4 className="cd-label" style={{ fontSize: 12, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginBottom: 12 }}>
                  Communication Log
                </h4>

                {showLogForm && (
                  <div style={{ background: '#FBFAF7', border: '1px solid #EEE9DF', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
                      <select
                        value={logMode}
                        onChange={e => setLogMode(e.target.value)}
                        style={{ height: 34, borderRadius: 6, border: '1px solid #D9D2C4', fontSize: 13 }}
                      >
                        <option>Call</option>
                        <option>WhatsApp</option>
                        <option>Email</option>
                        <option>Meeting</option>
                        <option>Site Visit</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Description (e.g. Discussed modular specs)"
                        value={logDesc}
                        onChange={e => setLogDesc(e.target.value)}
                        className="field-input"
                        style={{ height: 34, fontSize: 13 }}
                      />
                    </div>
                    <textarea
                      placeholder="Comment / action plan"
                      value={logComment}
                      onChange={e => setLogComment(e.target.value)}
                      className="field-input"
                      rows={2}
                      style={{ width: '100%', fontSize: 13, marginBottom: 10 }}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="hier-cancel-btn"
                        onClick={() => setShowLogForm(false)}
                      >
                        Cancel
                      </button>
                      <button type="button" className="btn-primary" onClick={handleAddLog}>
                        Save Entry
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {quote.communications.map((l: any) => (
                    <div key={l.id} style={{ padding: '12px', border: '1px solid #EEE9DF', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{l.mode}</span>
                        <span style={{ fontSize: 11, background: '#F4F1EA', padding: '1px 6px', borderRadius: 4 }}>
                          {l.stage}
                        </span>
                        <span style={{ fontSize: 11, color: '#A39B8B', marginLeft: 'auto' }}>
                          {formatDate(l.date)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#1A1A1A' }}>{l.description}</div>
                      {l.comment && <div style={{ fontSize: 12, color: '#8B8778', marginTop: 2 }}>{l.comment}</div>}
                    </div>
                  ))}
                  {quote.communications.length === 0 && !showLogForm && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#8B8778', fontSize: 13 }}>
                      No communications logged yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: FILES */}
            {activeTab === 'files' && (
              <div>
                <h4 className="cd-label" style={{ fontSize: 12, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', marginBottom: 12 }}>
                  File Attachments
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {quote.files.map((f: any) => (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        border: '1px solid #EEE9DF',
                        borderRadius: 8
                      }}
                    >
                      <div>
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontWeight: 600, fontSize: 13, color: '#1A1A1A', textDecoration: 'none' }}
                        >
                          {f.originalName}
                        </a>
                        <div style={{ fontSize: 11, color: '#A39B8B', marginTop: 2 }}>
                          {f.stage} · {Math.round(f.sizeBytes / 1024)} KB · {formatDate(f.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {quote.files.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#8B8778', fontSize: 13 }}>
                      No files uploaded yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>

          {/* -------------------------------------------------------------
              PANE 3: RIGHT RAIL (Ready Checklist / Progress + Versions List)
              ------------------------------------------------------------- */}
          <aside
            style={{
              borderLeft: '1px solid #EEE9DF',
              background: '#FBFAF7',
              padding: '20px 18px',
              overflowY: 'auto'
            }}
          >
            {/* If Draft: Live 8-point "Ready to submit" checklist */}
            {isDraftStatus ? (
              <section style={{ marginBottom: 24 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
                  Ready to submit
                </h4>
                <div className="qd-rd-count">
                  {liveReadiness.items.filter(i => i.done).length} of {liveReadiness.items.length} done
                </div>
                <div className="qd-bar">
                  <i
                    style={{
                      width: `${Math.round(
                        (liveReadiness.items.filter(i => i.done).length / liveReadiness.items.length) * 100
                      )}%`
                    }}
                  />
                </div>

                <ul className="qd-check">
                  {liveReadiness.items.map((it, idx) => (
                    <li
                      key={idx}
                      className={it.done ? 'done' : 'todo'}
                      onClick={() => {
                        if (it.fix === 'commercial') setActiveTab('commercial');
                        else if (it.fix === 'products') setActiveTab('products');
                        else if (it.fix === 'terms') setActiveTab('terms');
                      }}
                    >
                      <span className="d">{it.done ? '✓' : '!'}</span>
                      <div>
                        <div>{it.label}</div>
                        <small>{it.detail}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              /* If Submitted or Converted: Progress Stepper (.eqj) */
              <section style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#A39B8B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  PROGRESS
                </h4>
                {(() => {
                  const steps: Array<{
                    label: string;
                    state: 'done' | 'active' | 'bad' | 'todo';
                    sub?: string;
                    meta?: string;
                  }> = [];

                  const STAGE_ORDER: Record<string, number> = {
                    'Draft': 0,
                    'Verification Required': 1,
                    'Admin Approval Required': 2,
                    'Approved': 3,
                    'Sent': 4,
                    'Converted': 5,
                    'Not Converted': 5,
                    'Not Approved': 3
                  };

                  const currentStage = STAGE_ORDER[canonicalStatus] ?? 0;
                  const firstVersion = (quote.versions && quote.versions[0]) || currentVer;

                  // 1. Drafted (v0 started)
                  steps.push({
                    label: 'Drafted',
                    state: 'done',
                    sub: 'v0 started',
                    meta: [
                      formatDateTime(firstVersion?.createdAt),
                      firstVersion?.createdByName ? `by ${firstVersion.createdByName}` : null
                    ].filter(Boolean).join(' · ')
                  });

                  // 2. Revised
                  if (currentVer.versionNo > 1) {
                    steps.push({
                      label: 'Revised',
                      state: 'done',
                      sub: effectiveVerLabel,
                      meta: [
                        formatDateTime(currentVer.createdAt),
                        currentVer.createdByName ? `by ${currentVer.createdByName}` : null
                      ].filter(Boolean).join(' · ')
                    });
                  }

                  // 3. Submitted
                  const isSubmitted = Boolean(currentVer.submittedAt) || currentStage >= 1;
                  steps.push({
                    label: 'Submitted',
                    state: isSubmitted ? 'done' : 'todo',
                    sub: isSubmitted ? 'Sent for checking' : '',
                    meta: currentVer.submittedAt
                      ? formatDateTime(currentVer.submittedAt)
                      : isSubmitted && firstVersion?.createdAt
                        ? formatDateTime(firstVersion.createdAt)
                        : ''
                  });

                  // 4. Verified
                  const isVerified = Boolean(currentVer.verifiedAt) || currentStage >= 2;
                  const isVerifying = canonicalStatus === 'Verification Required';
                  steps.push({
                    label: 'Verified',
                    state: isVerified ? 'done' : isVerifying ? 'active' : 'todo',
                    sub: isVerifying ? 'Waiting to be checked' : '',
                    meta: isVerified
                      ? [
                          formatDateTime(currentVer.verifiedAt || currentVer.approvedAt || currentVer.createdAt),
                          currentVer.verifiedByName ? `by ${currentVer.verifiedByName}` : null
                        ].filter(Boolean).join(' · ')
                      : ''
                  });

                  // 5. Approved
                  const isApproved = currentStage >= 3 && canonicalStatus !== 'Not Approved';
                  const isNotApproved = canonicalStatus === 'Not Approved';
                  const isApproving = canonicalStatus === 'Admin Approval Required';
                  steps.push({
                    label: isNotApproved ? 'Not approved' : 'Approved',
                    state: isNotApproved ? 'bad' : isApproved ? 'done' : isApproving ? 'active' : 'todo',
                    sub: isApproving ? 'Waiting for approval' : '',
                    meta: (isApproved || isNotApproved)
                      ? [
                          formatDateTime(currentVer.approvedAt || currentVer.createdAt),
                          currentVer.approvedByName ? `by ${currentVer.approvedByName}` : null
                        ].filter(Boolean).join(' · ')
                      : ''
                  });

                  // 6. Sent to client
                  const isSent = Boolean(currentVer.sentAt) || currentStage >= 4;
                  const isReadyToSend = canonicalStatus === 'Approved';
                  steps.push({
                    label: 'Sent to client',
                    state: isSent ? 'done' : isReadyToSend ? 'active' : 'todo',
                    sub: isReadyToSend ? 'Ready to send' : '',
                    meta: currentVer.sentAt ? formatDateTime(currentVer.sentAt) : ''
                  });

                  // 7. Follow-ups
                  if (isSent) {
                    const followups = Array.isArray(currentVer.followupDoneAt) ? currentVer.followupDoneAt : [];
                    const count = followups.length;
                    steps.push({
                      label: 'Follow-ups',
                      state: currentVer.followupNeeded ? 'bad' : count ? 'done' : 'todo',
                      sub: count ? `${count} logged` : 'None needed yet',
                      meta: currentVer.followupNeeded ? 'Follow-up overdue' : ''
                    });
                  }

                  // 8. Client decision
                  const isConverted = canonicalStatus === 'Converted';
                  const isRejected = canonicalStatus === 'Not Converted';
                  steps.push({
                    label: isRejected ? 'Client rejected' : 'Client decision',
                    state: isConverted ? 'done' : isRejected ? 'bad' : canonicalStatus === 'Sent' ? 'active' : 'todo',
                    sub: isConverted ? 'Approved by the client' : isRejected ? (currentVer.notConvertedReason || 'Rejected') : '',
                    meta: currentVer.decidedAt ? formatDateTime(currentVer.decidedAt) : ''
                  });

                  return (
                    <ol className="eqj">
                      {steps.map((st, i) => {
                        const next = steps[i + 1];
                        const lineDone = next && st.state === 'done' && ['done', 'active', 'bad'].includes(next.state);
                        return (
                          <li key={i} className={`eqj-step eqj-${st.state} ${lineDone ? 'eqj-line-done' : ''}`}>
                            <span className="eqj-dot">
                              {st.state === 'done' && <Check size={11} strokeWidth={3} />}
                            </span>
                            <div className="eqj-body">
                              <span className="eqj-label">{st.label}</span>
                              {st.sub && <span className="eqj-sub">{st.sub}</span>}
                              {st.meta && <span className="eqj-meta">{st.meta}</span>}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  );
                })()}
              </section>
            )}

            {/* Versions List */}
            <section>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
                Versions
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {quote.versions.map((v: any) => {
                  const isCur = v.versionNo === quote.currentVersionNo;
                  const viewing = viewingVersionNo === v.versionNo || (isCur && viewingVersionNo === null);

                  return (
                    <div
                      key={v.versionNo}
                      onClick={() => setViewingVersionNo(v.versionNo)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: viewing ? '1.5px solid #1A1A1A' : '1px solid #EEE9DF',
                        background: '#FFFFFF',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <b style={{ fontSize: 13 }}>{v.versionLabel}</b>
                        {isCur && <span className="qd-ver-cur">Current</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#A39B8B', marginTop: 2 }}>
                        {formatDate(v.createdAt)} · {v.createdByName || 'Admin'}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginTop: 4 }}>
                        ₹{Math.round(v.grandTotal || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* Confirmation modal on Save changes */}
      <ReviseConfirmationModal
        isOpen={reviseModalOpen}
        nextVersionLabel={versionLabelOf(quote.currentVersionNo + 1)}
        currentVersionLabel={effectiveVerLabel}
        isSubmitted={!isDraftStatus}
        onCancel={() => setReviseModalOpen(false)}
        onConfirm={handleConfirmSaveRevision}
        loading={actionLoading}
      />

      {/* Parameter History modal */}
      {paramHistory && (
        <ParameterHistoryModal
          isOpen={true}
          onClose={() => setParamHistory(null)}
          lineId={paramHistory.lineId}
          field={paramHistory.field}
          label={paramHistory.label}
          lineName={paramHistory.lineName}
          versions={quote.versions}
        />
      )}

      {/* Master Product Catalog Picker Modal */}
      <ProductCatalogPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectProduct={handlePickProduct}
        title="Add Product to Quotation"
        subtitle="Choose standard modular furniture models from the 282-item factory catalog."
        actionButtonText="Add to Quote"
      />
    </div>
  );
}
