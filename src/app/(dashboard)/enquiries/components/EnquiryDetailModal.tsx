'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  MoreVertical, 
  AlertTriangle, 
  BarChart2, 
  Trash2, 
  RotateCcw, 
  XCircle, 
  Lock, 
  Check, 
  MessageSquare, 
  Upload, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Tag, 
  Handshake, 
  Briefcase, 
  FileText, 
  Calendar, 
  Info, 
  X, 
  Plus,
  ArrowRight,
  Package,
  Minus,
  Clock
} from 'lucide-react';
import { formatDate, formatDateTime, shortDate } from '@/lib/dates';
import { toast } from 'sonner';
import ProductCatalogPickerModal, { SelectedProductItem } from '@/components/products/ProductCatalogPickerModal';

interface EnquiryDetailModalProps {
  isOpen: boolean;
  enquiryId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenClient?: (clientId: string) => void;
  categories: Array<{ id: string; name: string }>;
  salespersons: Array<{ id: string; name: string }>;
  lostReasons: Array<{ id: string; name: string }>;
}

const TABS = [
  { key: 'qualification', label: 'Qualification' },
  { key: 'logs', label: 'Communication' },
  { key: 'files', label: 'Files' }
];

const LOG_MODES = ['Call', 'Email', 'WhatsApp', 'Meeting', 'Site Visit'];

const STATUS_CLASS: Record<string, string> = {
  New: 'neutral',
  Qualified: 'active',
  Quoted: 'quoted',
  Converted: 'done',
  Lost: 'bad'
};

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

const rupees = (n: number | null | undefined) =>
  '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const HISTORY_LABEL: Record<string, string> = {
  qualified: 'Marked as qualified',
  unqualified: 'Qualification reversed',
  lost: 'Marked as lost',
  reopened: 'Reopened'
};

const FILLER_ADDR_RE = /^(n\.?\s*\/?\s*a\.?|not applicable|nil|none|-+)$/i;
function formatAddressLines(a: any): string[] {
  if (!a) return [];
  const v = (k: string) => { const s = String(a[k] || '').trim(); return FILLER_ADDR_RE.test(s) ? '' : s; };
  const state = v('state').toLowerCase() === v('country').toLowerCase() ? '' : v('state');
  const cityState = [v('city'), state].filter(Boolean).join(', ');
  const place = [cityState, v('pincode')].filter(Boolean).join(' ');
  return [v('addressLine1'), v('addressLine2'), place, v('country')].filter(Boolean);
}

export default function EnquiryDetailModal({
  isOpen,
  enquiryId,
  onClose,
  onChanged,
  onOpenClient,
  categories,
  salespersons,
  lostReasons,
}: EnquiryDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [enquiry, setEnquiry] = useState<any>(null);

  // Tab & Panes state
  const [activeTab, setActiveTab] = useState<'qualification' | 'logs' | 'files'>('qualification');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Working copy for qualification
  const [brief, setBrief] = useState('');
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [opportunityValue, setOpportunityValue] = useState<number | null>(null);
  const [opportunityValueTouched, setOpportunityValueTouched] = useState(false);
  const [baselineSnapshot, setBaselineSnapshot] = useState('');
  const [showFixedSpecs, setShowFixedSpecs] = useState<Record<number, boolean>>({});

  // Sub-forms
  const [addingLog, setAddingLog] = useState(false);
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logMode, setLogMode] = useState('Call');
  const [logDescription, setLogDescription] = useState('');
  const [logComment, setLogComment] = useState('');

  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadingProgress, setUploadingProgress] = useState(false);

  // Mark as lost dialog
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [lostReasonId, setLostReasonId] = useState('');
  const [lostNote, setLostNote] = useState('');

  // Load Enquiry Detail
  useEffect(() => {
    if (!isOpen || !enquiryId) return;

    let isMounted = true;
    setLoading(true);

    fetch(`/api/enquiries/${enquiryId}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.error) {
          toast.error(data.error);
          onClose();
          return;
        }

        const eq = data.enquiry;
        setEnquiry(eq);

        const initialBrief = (eq.brief || '').trim();
        setBrief(initialBrief);
        
        const rawItems = (eq.items && eq.items.length > 0)
          ? eq.items
          : (eq.lineItems && eq.lineItems.length > 0 ? eq.lineItems : []);
        const items = rawItems.map((i: any) => ({
          ...i,
          name: i.name || i.description || 'Product Item',
          description: i.description || i.name || 'Product Item',
          code: i.code || i.productCode || 'PRD-001',
          quantity: Number(i.quantity) || 1,
          unit: i.unit || 'Nos',
          unitPrice: Number(i.unitPrice || i.baseSellingRate) || 0,
          comment: i.comment || '',
          refType: i.refType || 'MasterProduct',
        }));

        setLineItems(items);

        const currentOpp = eq.opportunityValue != null ? eq.opportunityValue : null;
        setOpportunityValue(currentOpp);

        const suggested = items.reduce((sum: number, it: any) => sum + (Number(it.unitPrice || 0) * Number(it.quantity || 0)), 0);
        const touched = currentOpp != null && Math.abs(currentOpp - suggested) > 0.5;
        setOpportunityValueTouched(touched);

        const base = JSON.stringify({
          b: initialBrief,
          o: currentOpp,
          l: items.map((l: any) => [l.description || l.name || '', Number(l.quantity || 0), Number(l.unitPrice || 0), (l.comment || '').trim()])
        });
        setBaselineSnapshot(base);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        toast.error('Failed to load enquiry details');
        setLoading(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, enquiryId]);

  if (!isOpen || !enquiryId) return null;

  // Unsaved changes check
  const isDirty = () => {
    const current = JSON.stringify({
      b: brief.trim(),
      o: opportunityValue,
      l: lineItems.map((l: any) => [l.description || l.name || '', Number(l.quantity || 0), Number(l.unitPrice || 0), (l.comment || '').trim()])
    });
    return current !== baselineSnapshot;
  };

  const handleRequestClose = () => {
    if (isDirty()) {
      if (confirm('Leave without saving? Your changes to the brief and products have not been saved.')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (loading || !enquiry) {
    return (
      <div className="detail-overlay">
        <div style={{ background: '#FFFFFF', padding: '32px 48px', borderRadius: 12, textAlign: 'center', boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}>
          <div style={{ fontSize: 14, color: '#6F6858', fontWeight: 600 }}>Loading enquiry details...</div>
        </div>
      </div>
    );
  }

  const client = enquiry.client || null;
  const category = enquiry.category || (enquiry.categoryName ? { name: enquiry.categoryName } : null);
  const isLost = enquiry.outcome === 'Lost';
  const bucket = isLost ? 'Lost' : enquiry.stage;
  const commsDone = !!(enquiry.hasCommunication || (enquiry.logs && enquiry.logs.length > 0));
  const hasQuote = !!enquiry.quote;

  const deleteWhy = hasQuote
    ? 'it has a quotation'
    : commsDone
      ? 'communication has been logged on it'
      : '';

  const reverseWhy = hasQuote
    ? 'a quotation has been made'
    : isLost
      ? 'reopen the enquiry first'
      : enquiry.stage !== 'Qualified'
        ? 'it has moved past qualification'
        : '';

  const qualifiable = !!brief.trim();
  const saveButtonLabel = enquiry.stage === 'New' ? 'Mark as qualified' : 'Save changes';

  const clientName = client?.name || enquiry.clientName || '–';
  const clientInitials = clientName !== '–'
    ? clientName
        .split(/\s+/)
        .slice(0, 2)
        .map((w: string) => w[0])
        .join('')
        .toUpperCase() || 'EN'
    : 'EN';

  const formatRupees = (n: number) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const quoteGrandTotal = Number(
    enquiry?.quote?.currentVersion?.totals?.grandTotal ??
    enquiry?.quote?.currentVersion?.grossTotal ??
    enquiry?.quote?.totalAmount ??
    enquiry?.quote?.grandTotal ??
    0
  );

  // Compute Gaps ("X to complete")
  const computeGaps = () => {
    if (isLost || enquiry.stage === 'Converted') return [];
    const g: Array<{ text: string; fix: string }> = [];

    if (enquiry.stage === 'New') {
      g.push(qualifiable
        ? { text: 'Ready to qualify: mark it as qualified', fix: 'qualification' }
        : { text: 'Not qualified: write a brief of what the client needs', fix: 'qualification' });
    } else if (!brief.trim()) {
      g.push({ text: 'No brief yet', fix: 'qualification' });
    } else if (!lineItems.length) {
      g.push({ text: 'No products added yet', fix: 'qualification' });
    } else if (enquiry.opportunityValue == null) {
      g.push({ text: 'Opportunity value not saved yet', fix: 'qualification' });
    }

    if (!enquiry.logs || !enquiry.logs.length) {
      g.push({ text: 'No communication logged yet', fix: 'logs' });
    }
    if (!enquiry.categoryId) {
      g.push({ text: 'No category assigned', fix: 'category' });
    }
    if (!enquiry.salespersonId) {
      g.push({ text: 'No salesperson assigned', fix: 'salesperson' });
    }
    return g;
  };
  const gapsList = computeGaps();

  // Opportunity Value Calculations
  const suggestedOppValue = lineItems.reduce(
    (sum, it) => sum + (Number(it.unitPrice || 0) * Number(it.quantity || 1)),
    0
  );

  const handleQtyChange = (idx: number, newQty: number) => {
    const updated = [...lineItems];
    updated[idx].quantity = Math.max(1, newQty);
    setLineItems(updated);
    if (!opportunityValueTouched) {
      const newSuggested = updated.reduce(
        (sum, it) => sum + (Number(it.unitPrice || 0) * Number(it.quantity || 1)),
        0
      );
      setOpportunityValue(newSuggested);
    }
  };

  const handleCommentChange = (idx: number, val: string) => {
    const updated = [...lineItems];
    updated[idx].comment = val;
    setLineItems(updated);
  };

  const handleRemoveLineItem = (idx: number) => {
    const updated = lineItems.filter((_, i) => i !== idx);
    setLineItems(updated);
    if (!opportunityValueTouched) {
      const newSuggested = updated.reduce(
        (sum, it) => sum + (Number(it.unitPrice || 0) * Number(it.quantity || 1)),
        0
      );
      setOpportunityValue(newSuggested);
    }
  };

  const handleSelectProduct = (selected: SelectedProductItem) => {
    const newItem = {
      refType: 'MasterProduct',
      refId: selected.refId,
      name: selected.name,
      description: selected.name,
      code: selected.code,
      quantity: selected.quantity,
      unit: selected.unit,
      unitPrice: selected.unitPrice,
      total: selected.total,
      thumbnail: selected.thumbnail,
      expectedDimensions: selected.expectedDimensions,
      materialPreference: selected.materialPreference,
      clientComment: selected.clientComment,
      comment: selected.clientComment || '',
      leadTimeDays: (selected as any).leadTimeDays,
      defaultDeliveryMode: (selected as any).defaultDeliveryMode,
    };
    const updated = [...lineItems, newItem];
    setLineItems(updated);
    if (!opportunityValueTouched) {
      const newSuggested = updated.reduce(
        (sum, it) => sum + (Number(it.unitPrice || 0) * Number(it.quantity || 1)),
        0
      );
      setOpportunityValue(newSuggested);
    }
  };

  const handleSaveQualification = async () => {
    if (!qualifiable) {
      toast.error('A brief is required: write what the client needs before qualifying');
      return;
    }

    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}/qualification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: brief.trim(),
          opportunityValue,
          lineItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save qualification');

      toast.success(enquiry.stage === 'New' ? 'Marked as qualified' : 'Changes saved');
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReverseQualification = async () => {
    setMenuOpen(false);
    if (reverseWhy) {
      toast.error(`Its qualification can't be reversed: ${reverseWhy}.`);
      return;
    }
    if (!confirm('Mark this enquiry as not qualified? It goes back to New. The brief and products stay. This is only possible until a quotation is made.')) {
      return;
    }

    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}/qualification`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reverse qualification');

      toast.success('Marked as not qualified');
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteEnquiry = async () => {
    setMenuOpen(false);
    if (deleteWhy) {
      toast.error(`This enquiry can't be deleted: ${deleteWhy}.`);
      return;
    }
    if (!confirm(`Delete enquiry "${enquiry.code || enquiry.enquiryNumber}"? Its communication log and files go with it. This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete');
      }
      toast.success('Enquiry deleted');
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMarkLost = async () => {
    if (!lostReasonId) {
      toast.error('Please choose why it was lost');
      return;
    }

    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: 'Lost',
          lostReasonId,
          lostNote: lostNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark as lost');

      toast.success('Marked as lost');
      setLostDialogOpen(false);
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReopen = async () => {
    setMenuOpen(false);
    if (!confirm('Reopen this enquiry? It moves back into the active pipeline.')) return;

    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: 'Open' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reopen enquiry');

      toast.success('Enquiry reopened');
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveLog = async () => {
    if (!logDescription.trim()) {
      toast.error('Description is required');
      return;
    }

    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: logDate,
          mode: logMode,
          description: logDescription.trim(),
          comment: logComment.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save log entry');

      toast.success('Log entry added');
      setAddingLog(false);
      setLogDescription('');
      setLogComment('');
      const updatedLogsRes = await fetch(`/api/enquiries/${enquiry.id}/logs`).then(r => r.json());
      setEnquiry((prev: any) => ({ ...prev, logs: updatedLogsRes.logs, hasCommunication: true }));
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Delete this log entry?')) return;
    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}/logs/${logId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete log entry');
      toast.success('Log entry deleted');
      setEnquiry((prev: any) => ({
        ...prev,
        logs: prev.logs.filter((l: any) => l.id !== logId),
      }));
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedUploadFile) {
      toast.error('Choose a file first');
      return;
    }

    setUploadingProgress(true);
    const fd = new FormData();
    fd.append('file', selectedUploadFile);
    fd.append('stage', 'Enquiry');

    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}/files`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      toast.success('File uploaded');
      setUploadingFile(false);
      setSelectedUploadFile(null);
      const updatedFilesRes = await fetch(`/api/enquiries/${enquiry.id}/files`).then(r => r.json());
      setEnquiry((prev: any) => ({ ...prev, files: updatedFilesRes.files }));
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingProgress(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Delete this file?')) return;
    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}/files/${fileId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete file');
      toast.success('File deleted');
      setEnquiry((prev: any) => ({
        ...prev,
        files: prev.files.filter((f: any) => f.id !== fileId),
      }));
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const QUOTE_SUB_MAP: Record<string, string> = {
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

  // Build Vertical 8-Step Pipeline Matching Sir's Exact Monotonic Engine
  const buildJourneySteps = () => {
    const stageIdx = { New: 0, Qualified: 1, Quoted: 2, Converted: 3 }[enquiry.stage as string] ?? 0;
    const dates = (typeof enquiry.stageDates === 'object' && enquiry.stageDates) ? enquiry.stageDates : {};
    const quote = enquiry.quote;
    const jobOrder = enquiry.jobOrder;
    const qs = quote ? (quote.effectiveStatus || quote.status) : null;
    const won = enquiry.stage === 'Converted' || qs === 'Converted';
    
    const tracks = jobOrder ? [
      ['BOM', jobOrder.bomStatus],
      ['Procurement', jobOrder.procurementStatus],
      ['Production', jobOrder.productionStatus]
    ] : null;
    const allTracksDone = !!tracks && tracks.every(t => t[1] === 'Completed');
    const trackStarted = !!tracks && tracks.some(t => t[1] && t[1] !== 'Pending');

    const left = [
      stageIdx >= 1,                     // Enquiry left once qualified
      !!quote || stageIdx >= 2,          // Qualified left once quote exists
      won,                               // Quote left once won
      !!jobOrder,                        // Order left once job order exists
      allTracksDone                      // Production left once tracks complete
    ];
    const cur = left.indexOf(false);     // -1: every built step is done

    const by = (name?: string | null) => (name ? 'by ' + name : '');
    const received = enquiry.enteredByName ? 'by ' + enquiry.enteredByName : '';

    const defs = [
      {
        label: 'Enquiry',
        done: 'Received',
        now: 'Needs qualifying',
        when: enquiry.createdAt,
        by: received
      },
      {
        label: 'Qualified',
        done: 'Qualified',
        now: stageIdx >= 1 ? 'Ready to quote' : '',
        when: dates.Qualified,
        by: by(enquiry.qualifiedByName)
      },
      {
        label: 'Quote',
        done: 'Won',
        now: quote ? (QUOTE_SUB_MAP[qs] || qs) : 'Not made yet',
        when: won ? (quote && (quote.decidedAt || quote.createdAt)) : (quote && quote.createdAt),
        verb: won ? 'Won' : 'Created',
        by: won ? '' : by(quote && quote.createdByName)
      },
      {
        label: 'Order',
        done: 'Created',
        now: 'To create',
        when: jobOrder && (jobOrder.createdAt || jobOrder.orderDate),
        by: by(jobOrder && jobOrder.createdByName)
      },
      {
        label: 'Production',
        done: 'Complete',
        tracks,
        now: !jobOrder ? '' : jobOrder.cancelledReason ? 'Cancelled' : jobOrder.holdReason ? 'On hold'
          : (trackStarted ? 'In progress' : 'Not started') + (jobOrder.productionDueDate ? ' · due ' + new Date(jobOrder.productionDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
      }
    ];

    const steps: any[] = defs.map((d, i) => {
      const base = { label: d.label, tracks: d.tracks || null };
      if (cur === -1 || i < cur) {
        const metaParts = [];
        if (d.when) metaParts.push((d.verb ? d.verb + ' ' : '') + formatDateTime(d.when));
        if (d.by) metaParts.push(d.by);
        return { ...base, state: 'done', sub: d.done, meta: metaParts.join(' · ') };
      }
      if (i === cur) {
        const metaParts = [];
        if (d.when && (i === 0 || i === 1 || (i === 2 && quote))) {
          metaParts.push((d.verb ? d.verb + ' ' : '') + formatDateTime(d.when));
        } else if (i === 1) {
          metaParts.push('Date not recorded');
        }
        if (d.by) metaParts.push(d.by);
        return { ...base, state: 'active', sub: d.now, meta: metaParts.join(' · ') };
      }
      return { label: d.label, state: 'todo', sub: '', meta: '', tracks: null };
    });

    ['QC', 'Dispatch', 'Installation'].forEach(label => steps.push({ label, state: 'todo', sub: '', meta: '', title: 'Not tracked yet' }));

    if (jobOrder && cur === 4) {
      if (jobOrder.cancelledReason) steps[4].state = 'off';
      else if (jobOrder.holdReason) steps[4].state = 'bad';
    }

    if (isLost && cur !== -1) {
      const ev = (enquiry.history || []).slice().reverse().find((h: any) => h.type === 'lost');
      const lostMeta = [
        enquiry.lostAt ? formatDateTime(enquiry.lostAt) : '',
        ev?.byName ? 'by ' + ev.byName : ''
      ].filter(Boolean).join(' · ');
      steps[cur] = {
        ...steps[cur],
        state: 'bad',
        sub: 'Lost' + (enquiry.lostReason ? `: ${enquiry.lostReason}` : ''),
        meta: lostMeta
      };
      steps.forEach((s, idx) => {
        if (idx > cur) {
          s.state = 'off';
          s.sub = '';
          s.meta = '';
        }
      });
    }

    return steps;
  };

  const journeySteps = buildJourneySteps();

  return (
    <div className={`detail-overlay cd-overlay ${drawerOpen ? 'cd-with-drawer' : ''}`} style={{ transition: 'padding-right 0.22s ease' }} onClick={handleRequestClose}>
      <div className="detail-modal cd-modal eqd-modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: drawerOpen ? 1220 : 1380, height: 'min(90vh, 900px)', background: '#FFFFFF', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', transition: 'max-width 0.22s ease' }}>
        
        {/* HEADER BAR matching Image 3 */}
        <div className="cd-head" style={{ padding: '16px 26px', borderBottom: '1px solid #EEE9DF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              className="eqd-back"
              onClick={handleRequestClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 36,
                padding: '0 14px 0 10px',
                borderRadius: 8,
                background: '#FFFFFF',
                border: '1px solid #DCD5C4',
                fontSize: 13,
                fontWeight: 600,
                color: '#333333',
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={16} /> Back
            </button>

            {/* Circular Avatar */}
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#F4F1EC', border: '1px solid #E5DFD3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#333333' }}>
              {clientInitials}
            </div>

            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111111', lineHeight: 1.25 }}>
                {clientName}
              </div>
              <div style={{ fontSize: 12, color: '#8B8778', marginTop: 2 }}>
                {enquiry.code || enquiry.enquiryNumber}{category?.name ? ` · ${category.name}` : ''}
              </div>
            </div>

            <div className="eqd-status" style={{ marginLeft: 8 }}>
              <span className={`cd-st cd-st-${STATUS_CLASS[bucket] || 'done'}`}>
                <i /> {bucket}
              </span>
            </div>
          </div>

          {/* Header Action Buttons on Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Gaps / To complete badge */}
            {gapsList.length > 0 && (
              <div className="cd-gaps-wrap" style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`cd-gaps-btn ${gapsOpen ? 'on' : ''}`}
                  onClick={() => { setGapsOpen(!gapsOpen); setMenuOpen(false); }}
                >
                  <AlertTriangle size={14} /> {gapsList.length} to complete
                </button>
                {gapsOpen && (
                  <div className="cd-gaps-pop">
                    <div className="cd-gaps-title">Unfinished details</div>
                    <ul className="eqd-gaps">
                      {gapsList.map((g, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            className="eqd-gap"
                            onClick={() => {
                              setGapsOpen(false);
                              if (g.fix === 'client' && client && onOpenClient) onOpenClient(client.id);
                              else if (g.fix === 'logs') { setActiveTab('logs'); setAddingLog(true); }
                              else setActiveTab('qualification');
                            }}
                          >
                            <span>{g.text}</span>
                            <ArrowRight size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Insights button (Turns black when open as in Image 4) */}
            <button
              type="button"
              className={`cd-insights-btn ${drawerOpen ? 'on' : ''}`}
              onClick={() => setDrawerOpen(!drawerOpen)}
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 8,
                border: drawerOpen ? '1px solid #000000' : '1px solid #DCD5C4',
                background: drawerOpen ? '#000000' : '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                color: drawerOpen ? '#FFFFFF' : '#333333',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <BarChart2 size={15} color={drawerOpen ? '#FFFFFF' : '#333333'} /> Insights
            </button>

            {/* More Menu (···) */}
            <div className="eqd-menu-wrap" style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => { setMenuOpen(!menuOpen); setGapsOpen(false); }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: '1px solid #DCD5C4',
                  background: menuOpen ? '#F4F1EC' : '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#333333'
                }}
              >
                <MoreVertical size={16} />
              </button>

              {menuOpen && (
                <div className="eqd-menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 260, background: '#FFFFFF', border: '1px solid #E5DFD3', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.14)', padding: 6, zIndex: 120 }}>
                  {!isLost ? (
                    <button
                      type="button"
                      className="eqd-menu-item danger"
                      onClick={() => {
                        setMenuOpen(false);
                        setLostDialogOpen(true);
                        setLostReasonId(lostReasons[0]?.id || '');
                      }}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#C0392B', cursor: 'pointer', textAlign: 'left', borderRadius: 8 }}
                    >
                      <XCircle size={15} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>Mark as lost</div>
                        <small style={{ color: '#A39B8B', fontSize: 11.5 }}>The client will not go ahead</small>
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="eqd-menu-item"
                      onClick={handleReopen}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#333333', cursor: 'pointer', textAlign: 'left', borderRadius: 8 }}
                    >
                      <RotateCcw size={15} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>Reopen</div>
                        <small style={{ color: '#A39B8B', fontSize: 11.5 }}>Back into the active pipeline</small>
                      </div>
                    </button>
                  )}

                  {enquiry.stage !== 'New' && (
                    <button
                      type="button"
                      className="eqd-menu-item"
                      onClick={handleReverseQualification}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: reverseWhy ? '#A39B8B' : '#333333', cursor: reverseWhy ? 'not-allowed' : 'pointer', textAlign: 'left', borderRadius: 8 }}
                    >
                      {reverseWhy ? <Lock size={15} style={{ marginTop: 2, flexShrink: 0 }} /> : <RotateCcw size={15} style={{ marginTop: 2, flexShrink: 0 }} />}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>Mark as not qualified</div>
                        <small style={{ color: '#A39B8B', fontSize: 11.5 }}>{reverseWhy ? `Not possible: ${reverseWhy}` : 'Back to New. Possible until quote is made'}</small>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    className="eqd-menu-item danger"
                    onClick={handleDeleteEnquiry}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: deleteWhy ? '#A39B8B' : '#C0392B', cursor: deleteWhy ? 'not-allowed' : 'pointer', textAlign: 'left', borderRadius: 8 }}
                  >
                    {deleteWhy ? <Lock size={15} style={{ marginTop: 2, flexShrink: 0 }} /> : <Trash2 size={15} style={{ marginTop: 2, flexShrink: 0 }} />}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>Delete enquiry</div>
                      <small style={{ color: '#A39B8B', fontSize: 11.5 }}>{deleteWhy ? `Not possible: ${deleteWhy}` : 'With its logs and files'}</small>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3-PANE SPLIT LAYOUT matching Image 3 */}
        <div className="cd-split eqd-split" style={{ display: 'grid', gridTemplateColumns: '290px minmax(0, 1fr) 320px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* PANE 1: LEFT RAIL (Client & Enquiry Facts) */}
          <aside className="cd-rail" style={{ overflowY: 'auto', padding: '22px 24px', background: '#FFFFFF', borderRight: '1px solid #EEE9DF' }}>
            {/* CLIENT SECTION */}
            <section style={{ marginBottom: 28 }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: 11, fontWeight: 800, color: '#4A4539', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                CLIENT
              </h4>

              {!client ? (
                <div style={{ fontSize: 13, color: '#8B8778', fontStyle: 'italic' }}>This client could not be found</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Contact person - Only for Business clients with contactPerson */}
                  {client.clientType?.toLowerCase() === 'business' && client.contactPerson ? (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <User size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111111', lineHeight: 1.3 }}>
                          {client.contactPerson}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#A39B8B' }}>Contact person</div>
                      </div>
                    </div>
                  ) : null}

                  {/* Phone */}
                  {Array.isArray(client.phones) && client.phones.length > 0 ? (
                    client.phones.map((p: string, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <Phone size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <a href={`tel:${p}`} style={{ fontSize: 13.5, color: '#111111', fontWeight: 600, textDecoration: 'none' }}>
                            {p}
                          </a>
                        </div>
                      </div>
                    ))
                  ) : null}

                  {/* Email */}
                  {Array.isArray(client.emails) && client.emails.length > 0 ? (
                    client.emails.map((e: string, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <Mail size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <a href={`mailto:${e}`} style={{ fontSize: 13.5, color: '#333333', textDecoration: 'none' }}>
                            {e}
                          </a>
                        </div>
                      </div>
                    ))
                  ) : null}

                  {/* Address */}
                  {(() => {
                    const billing = (Array.isArray(client.addresses) ? client.addresses : []).find((a: any) => a.isBilling) || (Array.isArray(client.addresses) ? client.addresses[0] : null);
                    const lines = formatAddressLines(billing);
                    if (!lines.length) return null;
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <MapPin size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                        <address style={{ fontSize: 13.5, color: '#333333', lineHeight: 1.5, fontStyle: 'normal' }}>
                          {lines.map((l, i) => <div key={i}>{l}</div>)}
                        </address>
                      </div>
                    );
                  })()}

                  {/* Empty state if nothing on file */}
                  {!(client.clientType?.toLowerCase() === 'business' && client.contactPerson) &&
                    (!Array.isArray(client.phones) || client.phones.length === 0) &&
                    (!Array.isArray(client.emails) || client.emails.length === 0) &&
                    (!Array.isArray(client.addresses) || client.addresses.length === 0 || formatAddressLines(client.addresses.find((a: any) => a.isBilling) || client.addresses[0]).length === 0) && (
                      <div style={{ fontSize: 13, color: '#8B8778', fontStyle: 'italic' }}>Nothing on file yet</div>
                  )}

                  {/* Open client button */}
                  <button
                    type="button"
                    onClick={() => onOpenClient && client && onOpenClient(client.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 8,
                      background: '#FFFFFF',
                      border: '1px solid #DCD5C4',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: '#333333',
                      cursor: 'pointer',
                      width: 'fit-content',
                      marginTop: 4
                    }}
                  >
                    <ArrowRight size={13} /> Open client
                  </button>
                </div>
              )}
            </section>

            {/* ENQUIRY FACTS SECTION */}
            <section>
              <h4 style={{ margin: '0 0 14px 0', fontSize: 11, fontWeight: 800, color: '#4A4539', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                ENQUIRY
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Category */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Tag size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6F6858' }}>Category</div>
                    <div style={{ fontSize: 13.5, color: category?.name ? '#111111' : '#8B8778' }}>
                      {category?.name || 'No category assigned'}
                    </div>
                  </div>
                </div>

                {/* Source */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Handshake size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6F6858' }}>Source</div>
                    <div style={{ fontSize: 13.5, color: enquiry.sourceCategory ? '#111111' : '#8B8778' }}>
                      {enquiry.sourceCategory || 'Not recorded'}
                    </div>
                  </div>
                </div>

                {/* Referred by */}
                {enquiry.sourceName && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <User size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6F6858' }}>Referred by</div>
                      <div style={{ fontSize: 13.5, color: '#111111' }}>{enquiry.sourceName}</div>
                    </div>
                  </div>
                )}

                {/* Salesperson */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Briefcase size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6F6858' }}>Salesperson</div>
                    <div style={{ fontSize: 13.5, color: enquiry.salespersonName ? '#111111' : '#8B8778' }}>
                      {enquiry.salespersonName || 'Not assigned'}
                    </div>
                  </div>
                </div>

                {/* Quotation - ONLY if enquiry.quote exists */}
                {enquiry.quote && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <FileText size={16} color="#FF7700" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6F6858' }}>Quotation</div>
                      <div style={{ fontSize: 13.5, color: '#FF7700', fontWeight: 600 }}>
                        {enquiry.quote.number ? `${enquiry.quote.number}${enquiry.quote.currentVersion?.versionLabel ? ' · ' + enquiry.quote.currentVersion.versionLabel : ''}` : 'Draft quotation'} →
                      </div>
                    </div>
                  </div>
                )}

                {/* Entered by */}
                {enquiry.enteredByName && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <User size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6F6858' }}>Entered by</div>
                      <div style={{ fontSize: 13.5, color: '#111111' }}>{enquiry.enteredByName}</div>
                    </div>
                  </div>
                )}

                {/* Received */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Calendar size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6F6858' }}>Received</div>
                    <div style={{ fontSize: 13.5, color: '#111111' }}>
                      {new Date(enquiry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Qualified by */}
                {enquiry.qualifiedByName && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Check size={16} color="#8B8778" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6F6858' }}>Qualified by</div>
                      <div style={{ fontSize: 13.5, color: '#111111' }}>{enquiry.qualifiedByName}</div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </aside>

          {/* PANE 2: MIDDLE MAIN (Tabs & Forms) */}
          <main className="cd-main" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, background: '#FFFFFF' }}>
            {/* Tabs Header */}
            <div className="detail-tabs cd-tabs eqd-tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid #EEE9DF' }}>
              <div className="eqd-tabs-l" style={{ display: 'flex', gap: 20 }}>
                {TABS.map(t => {
                  const isActive = activeTab === t.key;
                  const count = t.key === 'qualification'
                    ? lineItems.length
                    : t.key === 'logs'
                      ? (enquiry.logs?.length || 1)
                      : (enquiry.files?.length || 0);

                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key as any)}
                      style={{
                        padding: '16px 2px 14px',
                        border: 'none',
                        background: 'none',
                        fontSize: 14,
                        fontWeight: isActive ? 700 : 600,
                        color: isActive ? '#000000' : '#8B8778',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        borderBottom: isActive ? '2px solid #FF7700' : '2px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {t.label}
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          background: isActive ? '#000000' : '#E5DFD3',
                          color: isActive ? '#FFFFFF' : '#6F6858'
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Tab Buttons */}
              <div className="eqd-tabs-r" style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="clt-quiet-btn"
                  onClick={() => { setActiveTab('logs'); setAddingLog(true); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 8,
                    background: '#FFFFFF',
                    border: '1px solid #DCD5C4',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#333333',
                    cursor: 'pointer'
                  }}
                >
                  <MessageSquare size={13} /> Log communication
                </button>
                <button
                  type="button"
                  className="clt-quiet-btn"
                  onClick={() => { setActiveTab('files'); setUploadingFile(true); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 8,
                    background: '#FFFFFF',
                    border: '1px solid #DCD5C4',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#333333',
                    cursor: 'pointer'
                  }}
                >
                  <Upload size={13} /> Upload file
                </button>
              </div>
            </div>

            {/* TAB BODY */}
            <div className="cd-main-body" style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
              {activeTab === 'qualification' && (
                <div>
                  {/* Brief Section matching Image 3 */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#4A4539', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        BRIEF
                      </span>
                      <Info size={13} color="#8B8778" />
                    </div>
                    <textarea
                      className="eqd-brief"
                      rows={3}
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      placeholder="What does the client need?"
                      style={{
                        width: '100%',
                        borderRadius: 8,
                        border: '1px solid #DCD5C8',
                        padding: '12px 14px',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        lineHeight: 1.5,
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  {/* Products Section matching Image 3 */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#4A4539', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        PRODUCTS ({lineItems.length})
                      </div>
                      <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          height: 30,
                          padding: '0 12px',
                          borderRadius: 6,
                          background: '#000000',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={13} /> Add Product
                      </button>
                    </div>

                    {lineItems.length === 0 ? (
                      <div
                        style={{
                          border: '1.5px dashed #DCD5C8',
                          borderRadius: 8,
                          padding: '24px 16px',
                          textAlign: 'center',
                          background: '#FAF8F4',
                          marginBottom: 12,
                        }}
                      >
                        <Package size={28} style={{ margin: '0 auto 6px auto', color: '#A39B8B' }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#333333' }}>
                          No products scoped yet
                        </div>
                        <div style={{ fontSize: 12, color: '#8B8778', marginTop: 2, marginBottom: 10 }}>
                          Select from the 282 master furniture models to establish accurate opportunity pricing.
                        </div>
                        <button
                          type="button"
                          onClick={() => setPickerOpen(true)}
                          style={{
                            padding: '6px 16px',
                            borderRadius: 6,
                            border: '1px solid #000000',
                            background: '#FFFFFF',
                            color: '#000000',
                            fontWeight: 700,
                            fontSize: 12.5,
                            cursor: 'pointer',
                          }}
                        >
                          + Browse Catalog
                        </button>
                      </div>
                    ) : (
                      lineItems.map((item, idx) => {
                        const thumb = item.thumbnail || item.product?.thumbnail;
                        const lineTotal = Number(item.total) || (Number(item.quantity || 1) * Number(item.unitPrice || 0));

                        return (
                          <div key={idx} className="eqd-line" style={{ border: '1px solid #E5DFD3', borderRadius: 8, padding: '12px 14px', marginBottom: 12, background: '#FFFFFF' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              {/* Thumbnail Box */}
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt=""
                                  style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid #E5DFD3' }}
                                />
                              ) : (
                                <div style={{ width: 44, height: 44, borderRadius: 6, background: '#F4F1EC', border: '1px solid #E5DFD3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Package size={20} color="#8B8778" />
                                </div>
                              )}

                              {/* Name, SKU & Dimensions */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111111' }}>
                                    {item.name || item.description}
                                  </span>
                                  <span style={{ fontSize: 12, color: '#8B8778' }}>
                                    {item.code || item.productCode || 'Custom Unit'}
                                  </span>
                                </div>
                                {item.expectedDimensions && (
                                  <div style={{ fontSize: 11, color: '#5A554A', background: '#F4F1EA', padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginTop: 3, fontFamily: 'monospace' }}>
                                    {item.expectedDimensions}
                                  </div>
                                )}
                              </div>

                              {/* Quantity input & Pricing */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => handleQtyChange(idx, parseInt(e.target.value, 10))}
                                    style={{ width: 56, height: 34, padding: '4px 6px', borderRadius: 6, border: '1px solid #DCD5C8', textAlign: 'center', fontSize: 13, fontWeight: 600 }}
                                  />
                                  <span style={{ fontSize: 12.5, color: '#6F6858' }}>{item.unit || 'Nos'}</span>
                                </div>

                                <div style={{ textAlign: 'right', minWidth: 78 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
                                    ₹{lineTotal.toLocaleString('en-IN')}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#8B8778' }}>
                                    ₹{Number(item.unitPrice || 0).toLocaleString('en-IN')} each
                                  </div>
                                </div>
                              </div>

                              {/* Fixed Specs Toggle Link */}
                              <button
                                type="button"
                                onClick={() => setShowFixedSpecs(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                style={{ background: 'none', border: 'none', color: '#FF7700', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                              >
                                {showFixedSpecs[idx] ? 'Hide specs' : 'Show specs'}
                              </button>

                              {/* Trash Icon */}
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                style={{ background: 'none', border: 'none', color: '#8B8778', cursor: 'pointer', padding: 4 }}
                                title="Remove product"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>

                            {/* Comment Input Box */}
                            <div style={{ marginTop: 10 }}>
                              <input
                                type="text"
                                placeholder="Client specific specification notes or finish preferences (optional)"
                                value={item.comment || ''}
                                onChange={(e) => handleCommentChange(idx, e.target.value)}
                                style={{ width: '100%', height: 36, padding: '6px 12px', borderRadius: 6, border: '1px solid #DCD5C8', fontSize: 13, outline: 'none' }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Manufacturing Feasibility Indicator */}
                    {lineItems.some((it: any) => it.leadTimeDays || it.defaultDeliveryMode) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F8F6F0', borderRadius: 6, border: '1px solid #E5DFD3', fontSize: 12, color: '#5A554A', marginTop: 10, marginBottom: 12 }}>
                        <Clock size={14} color="#8B8778" />
                        <span>
                          Estimated Factory Lead Time: ~{Math.max(...lineItems.map((it: any) => it.leadTimeDays || 14))} Days
                          {lineItems.some((it: any) => it.defaultDeliveryMode) ? ` · Delivery Mode: ${lineItems.find((it: any) => it.defaultDeliveryMode)?.defaultDeliveryMode}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Opportunity Value */}
                  <div style={{ marginBottom: 24, maxWidth: 320 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 6 }}>
                      Opportunity value (₹)
                    </label>
                    <input
                      type="number"
                      value={opportunityValue != null ? opportunityValue : ''}
                      onChange={(e) => {
                        setOpportunityValueTouched(true);
                        setOpportunityValue(e.target.value === '' ? null : parseFloat(e.target.value));
                      }}
                      style={{ width: '100%', height: 38, padding: '6px 12px', borderRadius: 6, border: '1px solid #DCD5C8', fontSize: 14, outline: 'none' }}
                    />
                    <div style={{ fontSize: 12, color: '#8B8778', marginTop: 4 }}>
                      {opportunityValueTouched ? (
                        <span>
                          Set by hand. Product total is {rupees(suggestedOppValue)}{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setOpportunityValueTouched(false);
                              setOpportunityValue(suggestedOppValue);
                            }}
                            style={{ background: 'none', border: 'none', color: '#FF7700', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                          >
                            [Use product total]
                          </button>
                        </span>
                      ) : (
                        'Follows the products and quantities. Type to set your own value'
                      )}
                    </div>
                  </div>

                  {/* Save row */}
                  {qualifiable && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                      <button
                        type="button"
                        onClick={handleSaveQualification}
                        style={{
                          padding: '10px 24px',
                          borderRadius: 6,
                          background: '#FF7700',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(255,119,0,0.25)'
                        }}
                      >
                        {saveButtonLabel}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Communication Logs Tab */}
              {activeTab === 'logs' && (
                <div>
                  {addingLog ? (
                    <div style={{ padding: 18, border: '1px solid #E5DFD3', borderRadius: 10, background: '#FBFAF7', marginBottom: 16 }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700 }}>Log Communication</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6F6858', textTransform: 'uppercase', marginBottom: 4 }}>Date *</label>
                          <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={{ width: '100%', height: 36, padding: '0 8px', borderRadius: 6, border: '1px solid #E5DFD3' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6F6858', textTransform: 'uppercase', marginBottom: 4 }}>Mode *</label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {LOG_MODES.map(m => (
                              <button key={m} type="button" onClick={() => setLogMode(m)} style={{ padding: '5px 12px', borderRadius: 16, border: logMode === m ? '1.5px solid #FF7700' : '1px solid #E5DFD3', background: logMode === m ? 'rgba(255,119,0,0.1)' : '#FFFFFF', color: logMode === m ? '#FF7700' : '#333', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6F6858', textTransform: 'uppercase', marginBottom: 4 }}>Description *</label>
                        <input type="text" value={logDescription} onChange={e => setLogDescription(e.target.value)} style={{ width: '100%', height: 36, padding: '6px 12px', borderRadius: 6, border: '1px solid #E5DFD3' }} placeholder="Summary of discussion" />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button type="button" onClick={() => setAddingLog(false)} style={{ padding: '6px 14px', borderRadius: 6, background: '#FFF', border: '1px solid #DCD5C4', fontSize: 12.5, fontWeight: 600 }}>Cancel</button>
                        <button type="button" onClick={handleSaveLog} style={{ padding: '6px 16px', borderRadius: 6, background: '#FF7700', border: 'none', color: '#FFF', fontSize: 12.5, fontWeight: 700 }}>Save entry</button>
                      </div>
                    </div>
                  ) : null}

                  {enquiry.logs && enquiry.logs.length > 0 ? (
                    enquiry.logs.map((l: any) => (
                      <div key={l.id} className="eq-log-entry" style={{ border: '1px solid #EEE9DF', borderRadius: 8, padding: '12px 14px', marginBottom: 10, background: '#FFFFFF' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#FF7700', background: 'rgba(255,119,0,0.1)', padding: '2px 8px', borderRadius: 4 }}>{l.mode}</span>
                            <span style={{ fontSize: 12, color: '#8B8778' }}>{formatDate(l.date)}</span>
                          </div>
                          <button type="button" onClick={() => handleDeleteLog(l.id)} style={{ background: 'none', border: 'none', color: '#8B8778', cursor: 'pointer' }}><Trash2 size={13} /></button>
                        </div>
                        <div style={{ fontSize: 13, color: '#333333', marginTop: 4 }}>{l.description}</div>
                        {l.comment && <div style={{ fontSize: 12, color: '#8B8778', fontStyle: 'italic', marginTop: 2 }}>{l.comment}</div>}
                        <div style={{ fontSize: 11, color: '#A79F8F', marginTop: 6 }}>Logged by {l.loggedByName || 'Super Admin'}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#8B8778', fontSize: 13 }}>No communication logged yet.</div>
                  )}
                </div>
              )}

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div>
                  {uploadingFile ? (
                    <div style={{ padding: 18, border: '1px solid #E5DFD3', borderRadius: 10, background: '#FBFAF7', marginBottom: 16 }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700 }}>Upload File</h4>
                      <input type="file" onChange={e => setSelectedUploadFile(e.target.files?.[0] || null)} style={{ marginBottom: 12 }} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button type="button" onClick={() => setUploadingFile(false)} style={{ padding: '6px 14px', borderRadius: 6, background: '#FFF', border: '1px solid #DCD5C4', fontSize: 12.5, fontWeight: 600 }}>Cancel</button>
                        <button type="button" disabled={uploadingProgress} onClick={handleUploadFile} style={{ padding: '6px 16px', borderRadius: 6, background: '#FF7700', border: 'none', color: '#FFF', fontSize: 12.5, fontWeight: 700 }}>{uploadingProgress ? 'Uploading...' : 'Upload'}</button>
                      </div>
                    </div>
                  ) : null}

                  {enquiry.files && enquiry.files.length > 0 ? (
                    enquiry.files.map((f: any) => (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid #EEE9DF', borderRadius: 8, marginBottom: 8, background: '#FFFFFF' }}>
                        <div>
                          <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, fontWeight: 700, color: '#111', textDecoration: 'none' }}>{f.originalName}</a>
                          <div style={{ fontSize: 11.5, color: '#8B8778', marginTop: 2 }}>{formatSize(f.sizeBytes)} · {formatDate(f.createdAt)}</div>
                        </div>
                        <button type="button" onClick={() => handleDeleteFile(f.id)} style={{ background: 'none', border: 'none', color: '#8B8778', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#8B8778', fontSize: 13 }}>No files uploaded yet.</div>
                  )}
                </div>
              )}
            </div>
          </main>

          {/* PANE 3: RIGHT JOURNEY COLUMN matching Image 3 */}
          <aside className="eqd-jcol" style={{ overflowY: 'auto', padding: '22px 24px', background: '#FBFAF7', borderLeft: '1px solid #EEE9DF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#4A4539', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                JOURNEY
              </span>
              <Info size={13} color="#8B8778" />
            </div>

            {/* Lost banner */}
            {isLost && (
              <div className="eqd-lost" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#FBEAE7', color: '#C0392B', fontSize: 13, lineHeight: 1.45 }}>
                <AlertTriangle size={15} color="#C0392B" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <b>Lost at {enquiry.lostAtStage || enquiry.stage || '–'}</b>
                  {enquiry.lostReason && `: ${enquiry.lostReason}`}
                  {enquiry.lostNote && (
                    <div className="eqd-lost-note" style={{ fontWeight: 400, marginTop: 2 }}>{enquiry.lostNote}</div>
                  )}
                </div>
              </div>
            )}

            {/* 8-Step Vertical Pipeline */}
            <ol className="eqj" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {journeySteps.map((step, idx) => {
                const isStepDone = step.state === 'done';
                const isStepActive = step.state === 'active';
                const isStepBad = step.state === 'bad';
                const isStepOff = step.state === 'off';
                const hasNext = idx < journeySteps.length - 1;
                const nextStep = journeySteps[idx + 1];
                const lineGreen = isStepDone && nextStep && (nextStep.state === 'done' || nextStep.state === 'active' || nextStep.state === 'bad');

                return (
                  <li
                    key={step.label}
                    title={step.title || undefined}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      gap: 12,
                      paddingBottom: hasNext ? 18 : 0
                    }}
                  >
                    {/* Vertical connecting line */}
                    {hasNext && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 10,
                          top: 24,
                          bottom: 2,
                          width: 2,
                          background: lineGreen ? '#27AE60' : '#E5DFD3'
                        }}
                      />
                    )}

                    {/* Step Dot Icon */}
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        background: isStepDone ? '#27AE60' : isStepBad ? '#FBEAE7' : isStepOff ? '#F3EFE7' : '#FFFFFF',
                        border: isStepDone
                          ? '2px solid #27AE60'
                          : isStepActive
                            ? '2px solid #FF7700'
                            : isStepBad
                              ? '2px solid #C0392B'
                              : '2px solid #D6CFC0',
                        color: isStepDone ? '#FFFFFF' : isStepBad ? '#C0392B' : '#8B8778',
                        position: 'relative',
                        zIndex: 1,
                        boxShadow: isStepActive ? 'inset 0 0 0 3px #FFFFFF, inset 0 0 0 9px #FF7700' : 'none'
                      }}
                    >
                      {isStepDone ? <Check size={11} strokeWidth={3} /> : null}
                    </div>

                    {/* Step Body */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: isStepOff ? '#A39B8B' : step.state === 'todo' ? '#A39B8B' : '#333333',
                          textDecoration: isStepOff ? 'line-through' : 'none'
                        }}
                      >
                        {step.label}
                      </span>
                      {step.sub && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: (isStepActive || isStepBad) ? 600 : 400,
                            color: isStepActive ? '#FF7700' : isStepBad ? '#C0392B' : '#6F6858',
                            marginTop: 1
                          }}
                        >
                          {step.sub}
                        </span>
                      )}
                      {step.meta && (
                        <span style={{ fontSize: 11.5, color: '#A39B8B', marginTop: 2, lineHeight: 1.4 }}>
                          {step.meta}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Quick Links */}
            {(enquiry.quote || enquiry.jobOrder) && (
              <div className="eqd-journey-links" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px dashed #E5DFD3' }}>
                {enquiry.quote && (
                  <button type="button" className="clt-quiet-btn" style={{ height: 34, padding: '0 12px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, background: '#F4F1EC', border: '1px solid #E5DFD3', color: '#333333', fontWeight: 600, cursor: 'pointer' }}>
                    <FileText size={14} /> Quotation {enquiry.quote.currentVersion?.versionCode || 'v1'} · {enquiry.quote.effectiveStatus || enquiry.quote.status}
                  </button>
                )}
                {enquiry.jobOrder && (
                  <button type="button" className="clt-quiet-btn" style={{ height: 34, padding: '0 12px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, background: '#F4F1EC', border: '1px solid #E5DFD3', color: '#333333', fontWeight: 600, cursor: 'pointer' }}>
                    <Briefcase size={14} /> {enquiry.jobOrder.jobNumber}
                  </button>
                )}
              </div>
            )}

            {/* Status Changes Audit History */}
            {Array.isArray(enquiry.history) && enquiry.history.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 800, color: '#4A4539', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Status changes
                </h4>
                <ul className="eqj-hist" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {enquiry.history.slice().reverse().map((h: any, i: number) => {
                    const typeLabel = HISTORY_LABEL[h.type] || h.type;
                    const atStageText = (h.type === 'lost' && h.atStage) ? ` at ${h.atStage}` : '';
                    return (
                      <li key={i} style={{ display: 'flex', flexDirection: 'column', fontSize: 12.5, color: '#333333' }}>
                        <b style={{ fontWeight: 600 }}>{typeLabel}{atStageText}</b>
                        <span style={{ fontSize: 11.5, color: '#A39B8B' }}>
                          {formatDateTime(h.at)}{h.byName ? ` · by ${h.byName}` : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Slide-over Insights Drawer (Photo 1 Parity) */}
      <aside
        className={`cd-drawer ${drawerOpen ? 'open' : ''}`}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          maxWidth: '100%',
          background: '#FFFFFF',
          boxShadow: '-18px 0 48px rgba(0, 0, 0, 0.16)',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(105%)',
          transition: 'transform 0.22s ease',
          overflowY: 'auto'
        }}
      >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid #F0EBE0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111111' }}>Insights</h3>
                <Info size={13} color="#8B8778" />
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B8778', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Opportunity Value Hero */}
              <div style={{ paddingBottom: 16, borderBottom: '1px solid #F0EBE0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  OPPORTUNITY VALUE
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#111111', margin: '4px 0' }}>
                  {formatRupees(enquiry.opportunityValue != null ? enquiry.opportunityValue : suggestedOppValue)}
                </div>
                <div style={{ fontSize: 12.5, color: '#6F6858' }}>
                  {lineItems.length ? `${lineItems.length} product${lineItems.length === 1 ? '' : 's'}` : 'No products yet'}
                  {quoteGrandTotal > 0 ? ` · quoted ${formatRupees(quoteGrandTotal)}` : ''}
                </div>
                {quoteGrandTotal > 0 && (enquiry.opportunityValue || suggestedOppValue) > 0 && (
                  <div style={{ fontSize: 12, color: '#6F6858', marginTop: 4 }}>
                    {quoteGrandTotal >= (enquiry.opportunityValue || suggestedOppValue) ? '+' : ''}
                    {Math.round(((quoteGrandTotal - (enquiry.opportunityValue || suggestedOppValue)) / (enquiry.opportunityValue || suggestedOppValue)) * 100)}% against the estimate
                  </div>
                )}
              </div>

              {/* 2x2 Rhythm Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>OPEN FOR</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111111', marginTop: 2 }}>
                    {Math.max(0, Math.floor((Date.now() - new Date(enquiry.createdAt).getTime()) / (1000 * 60 * 60 * 24)))} days
                  </div>
                  <div style={{ fontSize: 11.5, color: '#A39B8B' }}>
                    since {new Date(enquiry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>LAST CONTACT</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111111', marginTop: 2 }}>
                    {enquiry.logs?.[0]?.date || '–'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#A39B8B' }}>
                    {enquiry.logs?.[0]?.mode ? `${enquiry.logs[0].mode}` : (enquiry.logs?.length ? 'logged' : 'none logged')}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>COMMUNICATION</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111111', marginTop: 2 }}>
                    {enquiry.logs?.length || 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#A39B8B' }}>
                    {enquiry.logs?.length ? 'entries' : 'none yet'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>FILES</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111111', marginTop: 2 }}>
                    {enquiry.files?.length || 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#A39B8B' }}>
                    {enquiry.files?.length ? 'attached' : 'none yet'}
                  </div>
                </div>
              </div>

              {/* PACE */}
              <div style={{ paddingTop: 16, borderTop: '1px solid #F0EBE0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#4A4539', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  PACE
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>TO QUALIFY</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#111111', marginTop: 2 }}>
                      {enquiry.stageDates?.Qualified
                        ? `${Math.max(0, Math.floor((new Date(enquiry.stageDates.Qualified).getTime() - new Date(enquiry.createdAt).getTime()) / (1000 * 60 * 60 * 24)))} days`
                        : (enquiry.stage !== 'New' ? 'Qualified' : '–')}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#A39B8B' }}>
                      {enquiry.stageDates?.Qualified
                        ? 'after receiving'
                        : (enquiry.stage === 'New' ? 'not yet' : 'date not recorded')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>TO QUOTE</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#111111', marginTop: 2 }}>
                      {enquiry.quote
                        ? `${Math.max(0, Math.floor((new Date(enquiry.quote.createdAt).getTime() - new Date(enquiry.createdAt).getTime()) / (1000 * 60 * 60 * 24)))} days`
                        : '–'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#A39B8B' }}>
                      {enquiry.quote ? 'quotation created' : 'no quotation'}
                    </div>
                  </div>
                </div>
              </div>

              {/* QUOTATION (Rendered only if quotation exists) */}
              {enquiry.quote ? (
                <div style={{ paddingTop: 16, borderTop: '1px solid #F0EBE0' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#4A4539', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                    QUOTATION
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>STATUS</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111111', marginTop: 2 }}>
                        {enquiry.quote.effectiveStatus || enquiry.quote.status || 'Draft'}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#A39B8B' }}>
                        {enquiry.quote.number || enquiry.quote.currentVersion?.versionCode || 'Draft'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>VALUE</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111111', marginTop: 2 }}>
                        {quoteGrandTotal ? formatRupees(quoteGrandTotal) : '–'}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#A39B8B' }}>
                        {enquiry.quote.currentVersion?.sentAt ? `sent ${new Date(enquiry.quote.currentVersion.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'not sent yet'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>FOLLOW-UPS</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111111', marginTop: 2 }}>
                        {enquiry.quote.currentVersion?.followupCount || enquiry.logs?.filter((l: any) => l.stage === 'Quote').length || 0}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#A39B8B' }}>done</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8778', textTransform: 'uppercase' }}>VERSION</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111111', marginTop: 2 }}>
                        v{enquiry.quote.currentVersion?.versionNo || 1}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#A39B8B' }}>
                        {enquiry.quote.versions && enquiry.quote.versions.length > 1 ? `${enquiry.quote.versions.length} versions made` : 'first version'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

      {/* MARK AS LOST DIALOG */}
      {lostDialogOpen && (
        <div className="wizard-overlay" style={{ zIndex: 1200 }}>
          <div className="eqd-dlg" style={{ width: 440, background: '#FFFFFF', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div className="eqd-dlg-head" style={{ padding: '20px 24px 10px' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111' }}>Mark as lost</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8B8778' }}>
                {clientName} · {enquiry.code || enquiry.enquiryNumber}. At stage <b>{enquiry.stage}</b>.
              </p>
            </div>
            <div className="eqd-dlg-body" style={{ padding: '14px 24px' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6F6858', textTransform: 'uppercase', marginBottom: 8 }}>
                Why was it lost? *
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {lostReasons.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setLostReasonId(r.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 16,
                      border: lostReasonId === r.id ? '1.5px solid #FF7700' : '1px solid #DCD5C4',
                      background: lostReasonId === r.id ? 'rgba(255,119,0,0.1)' : '#FFFFFF',
                      color: lostReasonId === r.id ? '#FF7700' : '#333333',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {r.name}
                  </button>
                ))}
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6F6858', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 }}>
                Note (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Anything worth remembering..."
                value={lostNote}
                onChange={(e) => setLostNote(e.target.value)}
                style={{ width: '100%', borderRadius: 6, border: '1px solid #DCD5C8', padding: '8px 12px', fontSize: 13, outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 24px 18px', borderTop: '1px solid #F0EBE0' }}>
              <button
                type="button"
                onClick={() => setLostDialogOpen(false)}
                style={{ padding: '8px 16px', borderRadius: 6, background: '#FFFFFF', border: '1px solid #DCD5C8', fontSize: 13, fontWeight: 600, color: '#333', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkLost}
                style={{ padding: '8px 18px', borderRadius: 6, background: '#C0392B', border: 'none', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Mark as lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Catalog Picker Modal */}
      <ProductCatalogPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectProduct={handleSelectProduct}
        title="Add Product to Enquiry Scope"
        subtitle="Choose standard modular furniture models from the 282-item factory catalog."
        actionButtonText="Add to Scope"
      />
    </div>
  );
}
