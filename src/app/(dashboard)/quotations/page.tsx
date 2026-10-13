"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Search,
  X,
  ChevronDown,
  Check,
  CheckCircle2,
  Clock,
  Send,
  FileText,
  AlertCircle,
  Eye,
  Trash2,
  Download,
  Share2,
  Calendar,
  Building2,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  PhoneCall,
  Loader2,
  Edit,
  History
} from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// -------------------------------------------------------------
// TYPES & DATA STRUCTURES
// -------------------------------------------------------------

type Client = {
  id: string;
  name: string;
  clientCode?: string | null;
  phones?: string[];
  emails?: string[];
  addresses?: Array<{ street?: string; city?: string; state?: string; isBilling?: boolean }>;
};

type EnquiryItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  expectedDimensions?: string | null;
  materialPreference?: string | null;
  clientComment?: string | null;
};

type Enquiry = {
  id: string;
  enquiryNumber: string;
  clientId: string;
  clientName: string;
  clientPhones?: string[];
  stage: string;
  outcome: string;
  estimatedBudget?: number | null;
  expectedTimeline?: string | null;
  items: EnquiryItem[];
  notes?: string | null;
};

type QuoteItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountType?: "flat" | "percent" | null;
  discountValue?: number;
  discountAmount?: number;
  total: number;
  expectedDimensions?: string | null;
  materialPreference?: string | null;
  clientComment?: string | null;
};

type AdditionalCharge = {
  id?: string;
  title: string;
  amount: number;
  taxable: boolean;
};

type QuoteTerm = {
  id: string;
  title: string;
  body: string;
};

type QuoteVersion = {
  id: string;
  versionNo: number;
  versionCode: string;
  status: string;
  grossTotal: number;
  overallDiscountType?: "flat" | "percent" | null;
  overallDiscountVal?: number;
  overallDiscountAmt: number;
  discountedGross: number;
  extraCostsTotal: number;
  gstApplicable: boolean;
  gstRatePct: number;
  gstAmount: number;
  grandTotal: number;
  items: QuoteItem[];
  additionalCharges: AdditionalCharge[];
  terms?: QuoteTerm[];
  createdById?: string | null;
  createdByName?: string | null;
  verifiedById?: string | null;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  followupDoneAt?: string[];
  notConvertedReason?: string | null;
  supersededAt?: string | null;
  createdAt: string;
};

type Quotation = {
  id: string;
  quotationNumber: string;
  clientId: string;
  clientName: string;
  clientPhone?: string | null;
  clientAddress?: any;
  enquiryId?: string | null;
  enquiryNumber?: string | null;
  enquiryStage?: string | null;
  currentVersionNo: number;
  status: string;
  effectiveStatus: string;
  totalAmount: number;
  latestVersion?: QuoteVersion | null;
  versions?: QuoteVersion[];
  versionsCount?: number;
  createdAt: string;
  updatedAt: string;
};

// High-contrast status pill configuration matching Clients/Enquiries aesthetic
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  GENERATED: { label: "Draft", bg: "bg-slate-100", text: "text-slate-800", border: "border-2 border-slate-300" },
  VERIFICATION_REQUIRED: { label: "Needs Verification", bg: "bg-amber-50", text: "text-amber-900", border: "border-2 border-amber-300" },
  ADMIN_APPROVAL_REQUIRED: { label: "Needs Approval", bg: "bg-purple-50", text: "text-purple-900", border: "border-2 border-purple-300" },
  APPROVED: { label: "Approved", bg: "bg-blue-50", text: "text-blue-900", border: "border-2 border-blue-300" },
  NOT_APPROVED: { label: "Changes Requested", bg: "bg-rose-50", text: "text-rose-900", border: "border-2 border-rose-300" },
  SENT: { label: "Sent to Client", bg: "bg-indigo-50", text: "text-indigo-900", border: "border-2 border-indigo-300" },
  FOLLOWUP_NEEDED: { label: "Follow-up Due", bg: "bg-orange-50", text: "text-orange-950", border: "border-2 border-orange-400" },
  CONVERTED: { label: "Won (Approved)", bg: "bg-emerald-50", text: "text-emerald-900", border: "border-2 border-emerald-300" },
  NOT_CONVERTED: { label: "Lost (Rejected)", bg: "bg-red-50", text: "text-red-900", border: "border-2 border-red-300" }
};

const DEFAULT_TERMS: QuoteTerm[] = [
  { id: "TERM_PAYMENT", title: "Payment Terms", body: "50% advance with confirmed order, 40% before factory dispatch, 10% upon installation completion." },
  { id: "TERM_DELIVERY", title: "Delivery Timeline", body: "3 to 4 weeks from approval of final production drawings and receipt of advance." },
  { id: "TERM_VALIDITY", title: "Validity", body: "This quotation is valid for 15 calendar days from the date of issue." },
  { id: "TERM_WARRANTY", title: "Warranty", body: "5 years comprehensive warranty against manufacturing defects on structural hardware and fittings." }
];

// Helper: Format Display ID (Q-001 or DF_QT_000001)
export const formatDisplayId = (code: string, verNo: number = 1) => {
  if (!code) return "Q-001";
  if (code.startsWith("DF_QT_")) {
    const num = parseInt(code.replace("DF_QT_", ""), 10);
    return `Q-${String(num).padStart(3, "0")} (v${verNo})`;
  }
  return `${code} (v${verNo})`;
};

// Helper: Format Display Date
export const formatDisplayDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
};

// -------------------------------------------------------------
// MAIN COMPONENT
// -------------------------------------------------------------

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("SUPER_ADMIN");
  const [userName, setUserName] = useState<string>("Admin");

  // Tabs & Search
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [prefilledEnquiry, setPrefilledEnquiry] = useState<Enquiry | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);

  // Quick Action Modals
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);

  const [followupModalQuote, setFollowupModalQuote] = useState<Quotation | null>(null);
  const [rejectModalQuote, setRejectModalQuote] = useState<Quotation | null>(null);

  const activeMenuQuotation = useMemo(
    () => quotations.find(q => q.id === openStatusMenuId) || null,
    [quotations, openStatusMenuId]
  );

  // Detect logged-in user role from cookie
  useEffect(() => {
    setMounted(true);
    if (typeof document !== "undefined") {
      const getCookie = (name: string) => {
        const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? decodeURIComponent(match[2]) : null;
      };
      const role = getCookie("user_role");
      const name = getCookie("user_name");
      if (role) setUserRole(role);
      if (name) setUserName(name);
    }
  }, []);

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  useEffect(() => {
    fetchQuotations();
    fetchEnquiries();
    fetchClients();
  }, []);

  // Handle outside click, scroll, resize, or escape to dismiss status dropdown
  useEffect(() => {
    if (!openStatusMenuId) return;

    const handleScrollOrResize = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      setOpenStatusMenuId(null);
      setMenuPosition(null);
      triggerButtonRef.current = null;
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerButtonRef.current && !triggerButtonRef.current.contains(target)
      ) {
        setOpenStatusMenuId(null);
        setMenuPosition(null);
        triggerButtonRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenStatusMenuId(null);
        setMenuPosition(null);
        triggerButtonRef.current = null;
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openStatusMenuId]);

  const handleToggleStatusMenu = (e: React.MouseEvent<HTMLButtonElement>, quote: Quotation) => {
    e.stopPropagation();
    if (openStatusMenuId === quote.id) {
      setOpenStatusMenuId(null);
      setMenuPosition(null);
      triggerButtonRef.current = null;
      return;
    }

    const button = e.currentTarget;
    triggerButtonRef.current = button;
    const rect = button.getBoundingClientRect();
    const dropdownHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let pos: { top?: number; bottom?: number; left: number };
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      pos = {
        bottom: window.innerHeight - rect.top + 6,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - 240)),
      };
    } else {
      pos = {
        top: rect.bottom + 6,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - 240)),
      };
    }

    setMenuPosition(pos);
    setOpenStatusMenuId(quote.id);
  };

  const fetchQuotations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/quotations");
      const data = await res.json();
      if (Array.isArray(data)) setQuotations(data);
    } catch (err) {
      console.error("Failed to load quotations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEnquiries = async () => {
    try {
      const res = await fetch("/api/enquiries");
      const data = await res.json();
      if (Array.isArray(data)) setEnquiries(data);
    } catch (err) {
      console.error("Failed to load enquiries:", err);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      if (Array.isArray(data)) setClients(data);
    } catch (err) {
      console.error("Failed to load clients:", err);
    }
  };

  // 1. Qualified & Quoted Enquiries eligible for Quotations
  const qualifiedEnquiries = useMemo(() => {
    return enquiries.filter(e => (e.stage === "Qualified" || e.stage === "Quoted") && e.outcome === "Open");
  }, [enquiries]);

  // Enquiries waiting for quote that don't have an active submitted quote yet
  const awaitingQuoteEnquiries = useMemo(() => {
    const existingQuoteEnquiryIds = new Set(
      quotations
        .filter(q => q.status !== "NOT_CONVERTED")
        .map(q => q.enquiryId)
        .filter(Boolean)
    );
    return qualifiedEnquiries.filter(e => !existingQuoteEnquiryIds.has(e.id));
  }, [qualifiedEnquiries, quotations]);

  // Tab Counts
  const tabCounts = useMemo(() => {
    const all = quotations.length;
    const awaiting = awaitingQuoteEnquiries.length;
    const drafts = quotations.filter(q => q.status === "GENERATED").length;
    const reviews = quotations.filter(q => q.status === "VERIFICATION_REQUIRED" || q.status === "ADMIN_APPROVAL_REQUIRED").length;
    const approved = quotations.filter(q => q.status === "APPROVED").length;
    const sent = quotations.filter(q => q.status === "SENT" || q.effectiveStatus === "FOLLOWUP_NEEDED").length;
    const won = quotations.filter(q => q.status === "CONVERTED").length;
    const lost = quotations.filter(q => q.status === "NOT_CONVERTED").length;
    return { all, awaiting, drafts, reviews, approved, sent, won, lost };
  }, [quotations, awaitingQuoteEnquiries]);

  // Filtered Quotation list
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      // Tab filter
      if (activeTab === "DRAFTS" && q.status !== "GENERATED") return false;
      if (activeTab === "REVIEWS" && q.status !== "VERIFICATION_REQUIRED" && q.status !== "ADMIN_APPROVAL_REQUIRED") return false;
      if (activeTab === "APPROVED" && q.status !== "APPROVED") return false;
      if (activeTab === "SENT" && q.status !== "SENT" && q.effectiveStatus !== "FOLLOWUP_NEEDED") return false;
      if (activeTab === "WON" && q.status !== "CONVERTED") return false;
      if (activeTab === "LOST" && q.status !== "NOT_CONVERTED") return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesNum = (q.quotationNumber || "").toLowerCase().includes(query);
        const matchesClient = (q.clientName || "").toLowerCase().includes(query);
        const matchesEnq = (q.enquiryNumber || "").toLowerCase().includes(query);
        const matchesPhone = (q.clientPhone || "").toLowerCase().includes(query);
        if (!matchesNum && !matchesClient && !matchesEnq && !matchesPhone) return false;
      }
      return true;
    });
  }, [quotations, activeTab, searchQuery]);

  // Optimistic UI updates (0ms UI latency)
  const handleOptimisticUpdate = (updated: Quotation) => {
    setQuotations(prev => {
      const idx = prev.findIndex(q => q.id === updated.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [updated, ...prev];
    });
    if (activeQuotation?.id === updated.id) {
      setActiveQuotation(updated);
    }
  };

  // Workflow Actions (Submit, Verify, Approve, Mark Sent, Convert, Reject)
  const handleExecuteAction = async (quote: Quotation, action: string, extraPayload: any = {}) => {
    setOpenStatusMenuId(null);
    const previous = { ...quote };

    // 1. Instant Optimistic State Update
    let optimisticStatus = quote.status;
    if (action === "SUBMIT_VERIFICATION") optimisticStatus = "VERIFICATION_REQUIRED";
    if (action === "VERIFY") optimisticStatus = "ADMIN_APPROVAL_REQUIRED";
    if (action === "APPROVE") optimisticStatus = "APPROVED";
    if (action === "REJECT_APPROVAL") optimisticStatus = "NOT_APPROVED";
    if (action === "MARK_SENT") optimisticStatus = "SENT";
    if (action === "CONVERT") optimisticStatus = "CONVERTED";
    if (action === "REJECT_CLIENT") optimisticStatus = "NOT_CONVERTED";

    const optimisticQuote: Quotation = {
      ...quote,
      status: optimisticStatus,
      effectiveStatus: optimisticStatus
    };
    handleOptimisticUpdate(optimisticQuote);

    // 2. Background Sync
    try {
      const res = await fetch(`/api/quotations/${quote.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extraPayload })
      });
      const data = await res.json();
      if (!res.ok) {
        handleOptimisticUpdate(previous);
        alert(data.error || "Action failed");
      } else {
        fetchQuotations();
        fetchEnquiries();
      }
    } catch (err: any) {
      handleOptimisticUpdate(previous);
      alert(err.message || "Network error");
    }
  };

  const handleDeleteQuotation = async (quote: Quotation) => {
    if (!confirm(`Are you sure you want to delete quotation ${quote.quotationNumber}?`)) return;
    const previous = [...quotations];
    setQuotations(prev => prev.filter(q => q.id !== quote.id));
    if (activeQuotation?.id === quote.id) setIsDetailOpen(false);

    try {
      const res = await fetch(`/api/quotations/${quote.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setQuotations(previous);
        alert(data.error || "Failed to delete");
      }
    } catch (err: any) {
      setQuotations(previous);
      alert(err.message || "Error deleting quotation");
    }
  };

  // Launch New Quotation for a specific Qualified Enquiry
  const handleStartQuoteForEnquiry = (enquiry: Enquiry) => {
    setPrefilledEnquiry(enquiry);
    setEditingQuotation(null);
    setIsBuilderOpen(true);
  };

  // Export PDF Proposal (Clean D'Furn Factory Design)
  const handleDownloadPDF = (quotation: Quotation) => {
    const doc = new jsPDF();
    const ver = quotation.latestVersion;
    const items = ver?.items || [];
    const charges = ver?.additionalCharges || [];

    // Header banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 36, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("D'FURN MODULAR SYSTEMS", 14, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Commercial Furniture & Factory Modular Solutions | GSTIN: 24AADCD4139R1ZB", 14, 26);

    // Document Meta
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`PROPOSAL: ${quotation.quotationNumber}${ver ? `-v${ver.versionNo}` : ""}`, 14, 48);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Client: ${quotation.clientName}`, 14, 56);
    if (quotation.clientPhone) doc.text(`Phone: ${quotation.clientPhone}`, 14, 62);
    if (quotation.enquiryNumber) doc.text(`Enquiry Ref: ${quotation.enquiryNumber}`, 14, 68);

    doc.text(`Date: ${new Date(quotation.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`, 140, 56);
    doc.text(`Status: ${STATUS_CONFIG[quotation.status]?.label || quotation.status}`, 140, 62);
    doc.text(`Validity: 15 Days`, 140, 68);

    // Line items table
    const tableRows = items.map((it, idx) => [
      String(idx + 1),
      `${it.description}${it.expectedDimensions ? `\nDim: ${it.expectedDimensions}` : ""}${it.materialPreference ? `\nMat: ${it.materialPreference}` : ""}`,
      String(it.quantity),
      `₹ ${it.unitPrice.toLocaleString("en-IN")}`,
      it.discountAmount && it.discountAmount > 0 ? `₹ ${it.discountAmount.toLocaleString("en-IN")}` : "—",
      `₹ ${it.total.toLocaleString("en-IN")}`
    ]);

    autoTable(doc, {
      startY: 76,
      head: [["#", "Description / Specification", "Qty", "Unit Rate", "Disc", "Total"]],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 3.5 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 85 },
        2: { cellWidth: 15, halign: "center" },
        3: { cellWidth: 26, halign: "right" },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 30, halign: "right" }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;

    // Commercial Breakdown
    const rightMargin = 196;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Gross Scope Value:`, 120, finalY);
    doc.text(`₹ ${(ver?.grossTotal || quotation.totalAmount).toLocaleString("en-IN")}`, rightMargin, finalY, { align: "right" });

    let curY = finalY;
    if (ver && ver.overallDiscountAmt > 0) {
      curY += 6;
      doc.text(`Overall Discount:`, 120, curY);
      doc.text(`- ₹ ${ver.overallDiscountAmt.toLocaleString("en-IN")}`, rightMargin, curY, { align: "right" });
    }

    if (charges.length > 0) {
      charges.forEach(ch => {
        curY += 6;
        doc.text(`${ch.title}:`, 120, curY);
        doc.text(`₹ ${ch.amount.toLocaleString("en-IN")}`, rightMargin, curY, { align: "right" });
      });
    }

    if (ver && ver.gstApplicable) {
      curY += 6;
      doc.text(`GST (18%):`, 120, curY);
      doc.text(`₹ ${ver.gstAmount.toLocaleString("en-IN")}`, rightMargin, curY, { align: "right" });
    }

    curY += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Grand Total (INR):`, 120, curY);
    doc.text(`₹ ${(ver?.grandTotal || quotation.totalAmount).toLocaleString("en-IN")}`, rightMargin, curY, { align: "right" });

    // Terms
    curY += 14;
    if (curY < 240) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Standard Terms & Conditions:", 14, curY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const termsList = ver?.terms || DEFAULT_TERMS;
      termsList.slice(0, 3).forEach((t, i) => {
        curY += 5;
        doc.text(`${i + 1}. ${t.title}: ${t.body}`, 14, curY, { maxWidth: 180 });
      });
    }

    doc.save(`${quotation.quotationNumber}.pdf`);
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto pb-16 text-slate-900 transition-all font-sans p-4 sm:p-6 lg:p-8">

      {/* 1. TOP HEADER & NEW QUOTATION CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Quotations
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1">
            Build proposals for qualified leads with 18% GST, version snapshots & factory approvals
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (qualifiedEnquiries.length === 0) {
                alert("Only Qualified enquiries can be turned into quotations. Move an enquiry to 'Qualified' stage first.");
                return;
              }
              setEditingQuotation(null);
              setPrefilledEnquiry(qualifiedEnquiries[0]);
              setIsBuilderOpen(true);
            }}
            className="h-11 px-5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* 2. SEGMENTED TABS & SEARCH (MATCHING ENQUIRIES & REFERENCE PHOTO) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6">
        
        {/* Horizontal Segmented Tabs with 2px borders */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "ALL"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            All ({tabCounts.all})
          </button>

          <button
            onClick={() => setActiveTab("AWAITING")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "AWAITING"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-white text-amber-900 border-2 border-amber-300 hover:bg-amber-50"
            }`}
          >
            Awaiting Quote ({tabCounts.awaiting})
          </button>

          <button
            onClick={() => setActiveTab("DRAFTS")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "DRAFTS"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            Drafts ({tabCounts.drafts})
          </button>

          <button
            onClick={() => setActiveTab("REVIEWS")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "REVIEWS"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            Under Review ({tabCounts.reviews})
          </button>

          <button
            onClick={() => setActiveTab("APPROVED")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "APPROVED"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            Approved ({tabCounts.approved})
          </button>

          <button
            onClick={() => setActiveTab("SENT")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "SENT"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            Sent ({tabCounts.sent})
          </button>

          <button
            onClick={() => setActiveTab("WON")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "WON"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            Won ({tabCounts.won})
          </button>

          <button
            onClick={() => setActiveTab("LOST")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "LOST"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
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
            placeholder="Search by Quote #, client or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-8 bg-white border-2 border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

      </div>

      {/* 3. AWAITING QUOTE QUEUE (FROM QUALIFIED ENQUIRIES) */}
      {activeTab === "AWAITING" && (
        <div className="bg-amber-50/50 rounded-2xl border-2 border-amber-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-extrabold text-amber-950 flex items-center gap-2">
                <Sparkles size={18} className="text-amber-600" />
                <span>Qualified Leads Ready for Quotation ({awaitingQuoteEnquiries.length})</span>
              </h2>
              <p className="text-xs font-medium text-amber-800 mt-0.5">
                These customer requirements have completed qualification and need pricing proposals.
              </p>
            </div>
          </div>

          {awaitingQuoteEnquiries.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-amber-200 text-xs font-bold text-amber-900">
              Zero pending qualified leads. When new leads reach 'Qualified' in Enquiries, they will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {awaitingQuoteEnquiries.map(enq => (
                <div key={enq.id} className="bg-white p-4 rounded-xl border-2 border-amber-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                        {enq.enquiryNumber}
                      </span>
                      <span className="text-xs font-extrabold text-slate-900">
                        {enq.estimatedBudget ? `Est. ₹ ${enq.estimatedBudget.toLocaleString("en-IN")}` : "Unpriced"}
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 mt-2">{enq.clientName}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{enq.clientPhones?.[0] || "No phone"}</div>
                    <div className="text-xs text-slate-600 mt-2 line-clamp-2">
                      {enq.items?.length > 0 ? `${enq.items.length} line item(s): ${enq.items.map(i => i.description).join(", ")}` : "No line items"}
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartQuoteForEnquiry(enq)}
                    className="mt-4 w-full h-10 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <span>+ Generate Quotation</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. MAIN QUOTATIONS TABLE CARD CONTAINER (MATCHING REFERENCE PHOTO) */}
      <div className="bg-white rounded-2xl border-2 border-slate-200/90 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center">
            <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-600">Loading quotations...</div>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-base font-bold text-slate-900 mb-1">No quotations found</div>
            <p className="text-xs font-medium text-slate-500 mb-4">
              {searchQuery ? `No records matched "${searchQuery}"` : "No quotations in this category."}
            </p>
            {qualifiedEnquiries.length > 0 && (
              <button
                onClick={() => {
                  setEditingQuotation(null);
                  setPrefilledEnquiry(qualifiedEnquiries[0]);
                  setIsBuilderOpen(true);
                }}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                + Build Quote from Qualified Lead
              </button>
            )}
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
                {filteredQuotations.map((quote) => {
                  const statusKey = quote.effectiveStatus || quote.status;
                  const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.GENERATED;
                  const isMenuOpen = openStatusMenuId === quote.id;

                  return (
                    <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* 1. ID */}
                      <td className="py-4 px-6 align-middle font-bold text-slate-900 whitespace-nowrap">
                        <button
                          onClick={() => { setActiveQuotation(quote); setIsDetailOpen(true); }}
                          className="hover:text-blue-600 hover:underline cursor-pointer text-sm"
                          title={`Quotation ID: ${quote.quotationNumber}`}
                        >
                          {formatDisplayId(quote.quotationNumber, quote.currentVersionNo)}
                        </button>
                      </td>

                      {/* 2. Client */}
                      <td className="py-4 px-6 align-middle font-bold text-slate-900">
                        <button
                          onClick={() => { setActiveQuotation(quote); setIsDetailOpen(true); }}
                          className="hover:text-blue-600 hover:underline text-left cursor-pointer text-base"
                        >
                          {quote.clientName}
                        </button>
                        <div className="flex items-center gap-2 mt-0.5">
                          {quote.clientPhone && (
                            <span className="text-xs text-slate-500 font-mono font-medium">
                              {quote.clientPhone}
                            </span>
                          )}
                          {quote.enquiryNumber && (
                            <span className="text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                              Enq: {quote.enquiryNumber}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Amount */}
                      <td className="py-4 px-6 align-middle font-extrabold text-slate-900 whitespace-nowrap text-base">
                        ₹ {quote.totalAmount.toLocaleString("en-IN")}
                      </td>

                      {/* 4. Status with Dropdown */}
                      <td className="py-4 px-6 align-middle whitespace-nowrap">
                        <div className="inline-block">
                          <button
                            type="button"
                            onClick={(e) => handleToggleStatusMenu(e, quote)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                            title="Click to advance status"
                          >
                            <span>{statusConfig.label}</span>
                            <ChevronDown size={12} className={`opacity-70 transition-transform ${openStatusMenuId === quote.id ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      </td>

                      {/* 5. Date */}
                      <td className="py-4 px-6 align-middle text-slate-600 whitespace-nowrap text-sm font-medium">
                        {formatDisplayDate(quote.createdAt)}
                      </td>

                      {/* 6. Actions */}
                      <td className="py-4 px-6 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 text-xs font-bold">
                          
                          <button
                            onClick={() => { setActiveQuotation(quote); setIsDetailOpen(true); }}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            View
                          </button>

                          <span className="text-slate-300 font-normal">|</span>

                          <button
                            onClick={() => {
                              setEditingQuotation(quote);
                              setPrefilledEnquiry(null);
                              setIsBuilderOpen(true);
                            }}
                            className="text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                          >
                            Edit
                          </button>

                          <span className="text-slate-300 font-normal">|</span>

                          <button
                            onClick={() => handleDownloadPDF(quote)}
                            className="text-slate-600 hover:text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
                            title="Download PDF Proposal"
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </button>

                          <span className="text-slate-300 font-normal">|</span>

                          <button
                            onClick={() => handleDeleteQuotation(quote)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-0.5 cursor-pointer"
                            title="Delete Quotation"
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

      {/* 4.1 STATUS ACTION DROPDOWN (PORTALED TO DOCUMENT.BODY TO PREVENT OVERFLOW CLIPPING & TABLE SCROLLING) */}
      {mounted && openStatusMenuId && activeMenuQuotation && menuPosition && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPosition.top !== undefined ? `${menuPosition.top}px` : undefined,
            bottom: menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : undefined,
            left: `${menuPosition.left}px`,
          }}
          className="w-56 bg-white rounded-xl shadow-2xl border-2 border-slate-200 py-1.5 z-[9999] text-xs font-bold animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Advance Workflow:
          </div>

          {activeMenuQuotation.status === "GENERATED" && (
            <>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => handleExecuteAction(activeMenuQuotation, "APPROVE")}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-blue-900 cursor-pointer"
                >
                  <CheckCircle2 size={14} className="text-blue-600" />
                  <span>Direct Approve (Admin)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleExecuteAction(activeMenuQuotation, "SUBMIT_VERIFICATION")}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-amber-900 cursor-pointer"
                >
                  <Send size={14} className="text-amber-600" />
                  <span>Submit for Verification</span>
                </button>
              )}
            </>
          )}

          {activeMenuQuotation.status === "VERIFICATION_REQUIRED" && (
            <>
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecuteAction(activeMenuQuotation, "APPROVE")}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-blue-900 cursor-pointer"
                  >
                    <CheckCircle2 size={14} className="text-blue-600" />
                    <span>Approve Proposal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteAction(activeMenuQuotation, "REJECT_APPROVAL")}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-rose-900 cursor-pointer"
                  >
                    <X size={14} className="text-rose-600" />
                    <span>Request Changes</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleExecuteAction(activeMenuQuotation, "VERIFY")}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-purple-900 cursor-pointer"
                >
                  <ShieldCheck size={14} className="text-purple-600" />
                  <span>Verify (Manager)</span>
                </button>
              )}
            </>
          )}

          {activeMenuQuotation.status === "ADMIN_APPROVAL_REQUIRED" && (
            <>
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecuteAction(activeMenuQuotation, "APPROVE")}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-blue-900 cursor-pointer"
                  >
                    <CheckCircle2 size={14} className="text-blue-600" />
                    <span>Approve Proposal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteAction(activeMenuQuotation, "REJECT_APPROVAL")}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-rose-900 cursor-pointer"
                  >
                    <X size={14} className="text-rose-600" />
                    <span>Request Changes</span>
                  </button>
                </>
              ) : (
                <div className="px-3 py-2 text-slate-500 italic text-[11px]">
                  Awaiting Admin Approval
                </div>
              )}
            </>
          )}

          {activeMenuQuotation.status === "NOT_APPROVED" && (
            <button
              type="button"
              onClick={() => handleExecuteAction(activeMenuQuotation, "SUBMIT_VERIFICATION")}
              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-amber-900 cursor-pointer"
            >
              <Send size={14} className="text-amber-600" />
              <span>Re-submit for Verification</span>
            </button>
          )}

          {activeMenuQuotation.status === "APPROVED" && (
            <button
              type="button"
              onClick={() => handleExecuteAction(activeMenuQuotation, "MARK_SENT")}
              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-indigo-900 cursor-pointer"
            >
              <Send size={14} className="text-indigo-600" />
              <span>Mark Sent to Client</span>
            </button>
          )}

          {(activeMenuQuotation.status === "SENT" || activeMenuQuotation.effectiveStatus === "FOLLOWUP_NEEDED") && (
            <>
              <button
                type="button"
                onClick={() => {
                  setOpenStatusMenuId(null);
                  setFollowupModalQuote(activeMenuQuotation);
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-orange-950 cursor-pointer"
              >
                <Clock size={14} className="text-orange-600" />
                <span>Log Follow-up Done...</span>
              </button>
              <button
                type="button"
                onClick={() => handleExecuteAction(activeMenuQuotation, "CONVERT")}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-emerald-900 cursor-pointer"
              >
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Client Approved (Won)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenStatusMenuId(null);
                  setRejectModalQuote(activeMenuQuotation);
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-red-700 cursor-pointer"
              >
                <X size={14} className="text-red-600" />
                <span>Client Rejected...</span>
              </button>
            </>
          )}

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={() => {
              setOpenStatusMenuId(null);
              setEditingQuotation(activeMenuQuotation);
              setIsBuilderOpen(true);
            }}
            className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-800 cursor-pointer"
          >
            <Edit size={14} />
            <span>{activeMenuQuotation.status === "GENERATED" ? "Edit Draft" : "Fork New Version"}</span>
          </button>
        </div>,
        document.body
      )}

      {/* 5. MODAL: QUOTATION BUILDER & VERSION FORKER */}
      {isBuilderOpen && (
        <QuotationBuilderModal
          quotation={editingQuotation}
          prefilledEnquiry={prefilledEnquiry}
          qualifiedEnquiries={qualifiedEnquiries}
          clients={clients}
          userRole={userRole}
          onClose={() => { setIsBuilderOpen(false); setEditingQuotation(null); setPrefilledEnquiry(null); }}
          onSuccess={(saved) => {
            handleOptimisticUpdate(saved);
            setIsBuilderOpen(false);
            setEditingQuotation(null);
            setPrefilledEnquiry(null);
            fetchQuotations();
            fetchEnquiries();
          }}
        />
      )}

      {/* 6. MODAL: VIEW DETAILS & AUDIT TRAIL */}
      {isDetailOpen && activeQuotation && (
        <QuotationDetailModal
          quotation={activeQuotation}
          onClose={() => setIsDetailOpen(false)}
          onEdit={() => {
            setIsDetailOpen(false);
            setEditingQuotation(activeQuotation);
            setIsBuilderOpen(true);
          }}
          onDownloadPDF={() => handleDownloadPDF(activeQuotation)}
        />
      )}

      {/* 7. MODAL: LOG FOLLOW-UP */}
      {followupModalQuote && (
        <LogFollowupModal
          quotation={followupModalQuote}
          onClose={() => setFollowupModalQuote(null)}
          onSuccess={(res) => {
            setFollowupModalQuote(null);
            fetchQuotations();
            fetchEnquiries();
          }}
        />
      )}

      {/* 8. MODAL: REJECT REASON */}
      {rejectModalQuote && (
        <RejectModal
          quotation={rejectModalQuote}
          onClose={() => setRejectModalQuote(null)}
          onSuccess={(res) => {
            setRejectModalQuote(null);
            fetchQuotations();
            fetchEnquiries();
          }}
        />
      )}

    </div>
  );
}

// -------------------------------------------------------------
// COMPONENT: QUOTATION BUILDER MODAL (5-TAB FACTORY ERGONOMICS)
// -------------------------------------------------------------

function QuotationBuilderModal({
  quotation,
  prefilledEnquiry,
  qualifiedEnquiries,
  clients = [],
  userRole = "SUPER_ADMIN",
  onClose,
  onSuccess
}: {
  quotation: Quotation | null;
  prefilledEnquiry: Enquiry | null;
  qualifiedEnquiries: Enquiry[];
  clients?: Client[];
  userRole?: string;
  onClose: () => void;
  onSuccess: (q: Quotation) => void;
}) {
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";
  const [activeTab, setActiveTab] = useState<"ITEMS" | "COMMERCIALS" | "TERMS" | "AUDIT">("ITEMS");
  const [selectedEnquiryId, setSelectedEnquiryId] = useState<string>(
    quotation?.enquiryId || prefilledEnquiry?.id || (qualifiedEnquiries[0]?.id || "")
  );

  const selectedEnquiry = useMemo(() => {
    return qualifiedEnquiries.find(e => e.id === selectedEnquiryId) || prefilledEnquiry;
  }, [qualifiedEnquiries, selectedEnquiryId, prefilledEnquiry]);

  const linkedClient = useMemo(() => {
    const cId = selectedEnquiry?.clientId || quotation?.clientId;
    return clients.find(c => c.id === cId) || null;
  }, [clients, selectedEnquiry, quotation]);

  // Client billing / site address state
  const [addressLine, setAddressLine] = useState<string>(() => {
    if (quotation?.clientAddress) {
      return quotation.clientAddress.street || quotation.clientAddress.addressLine || "";
    }
    const cAddresses = linkedClient?.addresses;
    if (Array.isArray(cAddresses) && cAddresses.length > 0) {
      const b = cAddresses.find(a => a?.isBilling) || cAddresses[0];
      return b?.street || "";
    }
    return "";
  });

  const [city, setCity] = useState<string>(() => {
    if (quotation?.clientAddress) return quotation.clientAddress.city || "";
    const cAddresses = linkedClient?.addresses;
    if (Array.isArray(cAddresses) && cAddresses.length > 0) {
      const b = cAddresses.find(a => a?.isBilling) || cAddresses[0];
      return b?.city || "";
    }
    return "";
  });

  const [stateName, setStateName] = useState<string>(() => {
    if (quotation?.clientAddress) return quotation.clientAddress.state || "";
    const cAddresses = linkedClient?.addresses;
    if (Array.isArray(cAddresses) && cAddresses.length > 0) {
      const b = cAddresses.find(a => a?.isBilling) || cAddresses[0];
      return b?.state || "";
    }
    return "";
  });

  const [zipCode, setZipCode] = useState<string>(() => {
    if (quotation?.clientAddress) return quotation.clientAddress.zip || quotation.clientAddress.pincode || "";
    const cAddresses = linkedClient?.addresses;
    if (Array.isArray(cAddresses) && cAddresses.length > 0) {
      const b = cAddresses.find(a => a?.isBilling) || cAddresses[0];
      return (b as any)?.zip || "";
    }
    return "";
  });

  // Version being edited
  const ver = quotation?.latestVersion;

  // 1. Line Items state
  const [items, setItems] = useState<QuoteItem[]>(() => {
    if (ver?.items && ver.items.length > 0) return ver.items;
    if (selectedEnquiry?.items && selectedEnquiry.items.length > 0) {
      return selectedEnquiry.items.map(it => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice || 0,
        discountType: null,
        discountValue: 0,
        discountAmount: 0,
        total: (it.unitPrice || 0) * it.quantity,
        expectedDimensions: it.expectedDimensions,
        materialPreference: it.materialPreference,
        clientComment: it.clientComment
      }));
    }
    return [{ description: "Custom Modular Unit", quantity: 1, unitPrice: selectedEnquiry?.estimatedBudget || 0, total: selectedEnquiry?.estimatedBudget || 0 }];
  });

  // 2. Commercials & Taxes state
  const [overallDiscountType, setOverallDiscountType] = useState<"flat" | "percent" | "none">(
    (ver?.overallDiscountType as any) || "none"
  );
  const [overallDiscountVal, setOverallDiscountVal] = useState<string>(
    ver?.overallDiscountVal ? String(ver.overallDiscountVal) : ""
  );
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>(() => {
    if (ver?.additionalCharges && ver.additionalCharges.length > 0) return ver.additionalCharges;
    return [
      { title: "Packaging & Handling", amount: 0, taxable: true },
      { title: "Transportation & Freight", amount: 0, taxable: true }
    ];
  });
  const [gstApplicable, setGstApplicable] = useState<boolean>(ver?.gstApplicable !== false);
  const [gstRatePct, setGstRatePct] = useState<number>(ver?.gstRatePct || 18.0);

  // 3. Terms state
  const [terms, setTerms] = useState<QuoteTerm[]>(() => {
    if (ver?.terms && ver.terms.length > 0) return ver.terms;
    return DEFAULT_TERMS;
  });

  const [isSaving, setIsSaving] = useState(false);

  // If selecting a different enquiry during creation, load its items & client address
  const handleSelectEnquiry = (enqId: string) => {
    setSelectedEnquiryId(enqId);
    const found = qualifiedEnquiries.find(e => e.id === enqId);
    if (found && !quotation) {
      const c = clients.find(cl => cl.id === found.clientId);
      if (c?.addresses && Array.isArray(c.addresses) && c.addresses.length > 0) {
        const b = c.addresses.find(a => a?.isBilling) || c.addresses[0];
        setAddressLine(b?.street || "");
        setCity(b?.city || "");
        setStateName(b?.state || "");
        setZipCode((b as any)?.zip || "");
      } else {
        setAddressLine("");
        setCity("");
        setStateName("");
        setZipCode("");
      }

      if (found.items?.length > 0) {
        setItems(found.items.map(it => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice || 0,
          total: (it.unitPrice || 0) * it.quantity,
          expectedDimensions: it.expectedDimensions,
          materialPreference: it.materialPreference,
          clientComment: it.clientComment
        })));
      } else {
        setItems([{ description: "Custom Modular Unit", quantity: 1, unitPrice: found.estimatedBudget || 0, total: found.estimatedBudget || 0 }]);
      }
    }
  };

  // Real-time calculation
  const calculations = useMemo(() => {
    const processedItems = items.map(it => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const price = Math.max(0, Number(it.unitPrice) || 0);
      let discVal = Number(it.discountValue) || 0;
      let unitDiscount = 0;

      if (it.discountType === "percent") {
        discVal = Math.min(100, Math.max(0, discVal));
        unitDiscount = (price * discVal) / 100;
      } else if (it.discountType === "flat") {
        discVal = Math.min(price, Math.max(0, discVal));
        unitDiscount = discVal;
      }

      const lineTotal = Math.round((price - unitDiscount) * qty * 100) / 100;
      return {
        ...it,
        quantity: qty,
        unitPrice: price,
        discountValue: discVal,
        discountAmount: Math.round(unitDiscount * qty * 100) / 100,
        total: lineTotal
      };
    });

    const grossTotal = Math.round(processedItems.reduce((acc, it) => acc + it.total, 0) * 100) / 100;

    let overallDiscountAmt = 0;
    const oVal = Number(overallDiscountVal) || 0;
    if (overallDiscountType === "percent") {
      overallDiscountAmt = Math.round(((grossTotal * Math.min(100, oVal)) / 100) * 100) / 100;
    } else if (overallDiscountType === "flat") {
      overallDiscountAmt = Math.min(grossTotal, oVal);
    }

    const discountedGross = Math.max(0, Math.round((grossTotal - overallDiscountAmt) * 100) / 100);

    const extraCostsTotal = Math.round(additionalCharges.reduce((acc, c) => acc + (Number(c.amount) || 0), 0) * 100) / 100;
    const taxableChargesTotal = Math.round(additionalCharges.filter(c => c.taxable).reduce((acc, c) => acc + (Number(c.amount) || 0), 0) * 100) / 100;

    let gstAmount = 0;
    if (gstApplicable) {
      const gstBase = discountedGross + taxableChargesTotal;
      gstAmount = Math.round((gstBase * (gstRatePct / 100)) * 100) / 100;
    }

    const grandTotal = Math.round((discountedGross + extraCostsTotal + gstAmount) * 100) / 100;

    return {
      processedItems,
      grossTotal,
      overallDiscountAmt,
      discountedGross,
      extraCostsTotal,
      gstAmount,
      grandTotal
    };
  }, [items, overallDiscountType, overallDiscountVal, additionalCharges, gstApplicable, gstRatePct]);

  // Item handlers
  const handleItemChange = (idx: number, field: keyof QuoteItem, value: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Charge handlers
  const handleChargeChange = (idx: number, field: keyof AdditionalCharge, value: any) => {
    setAdditionalCharges(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleAddCharge = () => {
    setAdditionalCharges(prev => [...prev, { title: "Custom Service", amount: 0, taxable: true }]);
  };

  const handleRemoveCharge = (idx: number) => {
    setAdditionalCharges(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (submitForVerification: boolean = false) => {
    if (!selectedEnquiryId) {
      alert("Quotation must be linked to a qualified enquiry.");
      return;
    }

    setIsSaving(true);
    const hasAddress = Boolean(addressLine.trim() || city.trim() || stateName.trim() || zipCode.trim());
    const payload = {
      enquiryId: selectedEnquiryId,
      items: calculations.processedItems,
      overallDiscountType: overallDiscountType === "none" ? null : overallDiscountType,
      overallDiscountVal: Number(overallDiscountVal) || 0,
      additionalCharges,
      gstApplicable,
      gstRatePct,
      terms,
      userRole,
      submitForVerification,
      clientAddress: hasAddress
        ? {
            street: addressLine.trim(),
            city: city.trim(),
            state: stateName.trim(),
            zip: zipCode.trim()
          }
        : undefined
    };

    try {
      const url = quotation ? `/api/quotations/${quotation.id}` : "/api/quotations";
      const method = quotation ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save quotation");
      onSuccess(data);
    } catch (err: any) {
      alert(err.message || "Error saving quotation");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-3 sm:p-4 font-sans">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col overflow-hidden border-2 border-slate-200 max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {quotation ? `Edit Quotation (${quotation.quotationNumber}-v${quotation.currentVersionNo})` : "New Quotation"}
              </h2>
              {quotation && quotation.status !== "GENERATED" && quotation.status !== "APPROVED" && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                  Will Fork Version {quotation.currentVersionNo + 1}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600 mt-0.5">
              {isAdmin
                ? "Admin Direct Approval • Saves directly to Approved with zero verification delays"
                : "Strictly built for Qualified Leads • Non-admin quotes will be submitted to Admin"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 sm:px-8 border-b-2 border-slate-100 bg-slate-50/40 flex gap-2 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab("ITEMS")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all cursor-pointer ${
              activeTab === "ITEMS"
                ? "bg-white text-blue-600 border-t-2 border-x-2 border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Line Items ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("COMMERCIALS")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all cursor-pointer ${
              activeTab === "COMMERCIALS"
                ? "bg-white text-blue-600 border-t-2 border-x-2 border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Charges & Taxes (₹ {calculations.grandTotal.toLocaleString("en-IN")})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("TERMS")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all cursor-pointer ${
              activeTab === "TERMS"
                ? "bg-white text-blue-600 border-t-2 border-x-2 border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Terms & Conditions ({terms.length})
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          
          {/* Linked Qualified Enquiry Selection */}
          <div className="bg-slate-50 p-4.5 rounded-2xl border-2 border-slate-200">
            <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mb-1.5">
              Qualified Sales Lead *
            </label>
            {quotation ? (
              <div className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>{selectedEnquiry?.enquiryNumber} — {quotation.clientName}</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md font-bold">Qualified</span>
              </div>
            ) : (
              <select
                required
                value={selectedEnquiryId}
                onChange={e => handleSelectEnquiry(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-sm sm:text-base font-bold text-slate-900 bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                {qualifiedEnquiries.map(e => (
                  <option key={e.id} value={e.id}>
                    [{e.enquiryNumber}] {e.clientName} — Est: ₹ {(e.estimatedBudget || 0).toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Client Details & Site / Billing Address */}
          <div className="bg-slate-50 p-4.5 rounded-2xl border-2 border-slate-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 size={16} className="text-blue-600 shrink-0" />
                <span>Client & Billing / Site Address</span>
                <span className="text-[11px] font-medium text-slate-500 normal-case">(Optional at Proposal Stage)</span>
              </div>
              {selectedEnquiry?.clientPhones && selectedEnquiry.clientPhones.length > 0 && (
                <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  📞 {selectedEnquiry.clientPhones[0]}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Street / Site Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Plot 42, GIDC Estate or 3rd Floor, Tower B"
                  value={addressLine}
                  onChange={e => setAddressLine(e.target.value)}
                  className="w-full h-10 rounded-xl border-2 border-slate-200 px-3 text-xs sm:text-sm font-semibold text-slate-900 bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ahmedabad, Mumbai"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full h-10 rounded-xl border-2 border-slate-200 px-3 text-xs sm:text-sm font-semibold text-slate-900 bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gujarat"
                    value={stateName}
                    onChange={e => setStateName(e.target.value)}
                    className="w-full h-10 rounded-xl border-2 border-slate-200 px-3 text-xs sm:text-sm font-semibold text-slate-900 bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 380015"
                    value={zipCode}
                    onChange={e => setZipCode(e.target.value)}
                    className="w-full h-10 rounded-xl border-2 border-slate-200 px-3 text-xs sm:text-sm font-semibold text-slate-900 bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: LINE ITEMS */}
          {activeTab === "ITEMS" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                  Line Items Scope
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={16} strokeWidth={2.5} /> Add Line Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Description *</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. Conference Table 2400x1200"
                          value={item.description}
                          onChange={e => handleItemChange(idx, "description", e.target.value)}
                          className="w-full h-11 rounded-xl border-2 border-slate-200 px-3.5 text-sm font-bold text-slate-900 bg-white focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Qty *</label>
                        <input
                          required
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleItemChange(idx, "quantity", Number(e.target.value))}
                          className="w-full h-11 rounded-xl border-2 border-slate-200 px-2 text-sm font-bold text-slate-900 bg-white text-center focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Unit Rate (₹) *</label>
                        <input
                          required
                          type="number"
                          min="0"
                          value={item.unitPrice || ""}
                          onChange={e => handleItemChange(idx, "unitPrice", Number(e.target.value))}
                          className="w-full h-11 rounded-xl border-2 border-slate-200 px-3 text-sm font-bold text-slate-900 bg-white focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2 text-right">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Line Total</label>
                        <div className="h-11 flex items-center justify-end font-extrabold text-slate-900 text-sm">
                          ₹ {(item.total || 0).toLocaleString("en-IN")}
                        </div>
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="h-10 w-10 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Secondary Specs: Dimensions, Material & Comments */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <input
                        type="text"
                        placeholder="Dimensions (e.g. 2400x1200x750mm)"
                        value={item.expectedDimensions || ""}
                        onChange={e => handleItemChange(idx, "expectedDimensions", e.target.value)}
                        className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Material (e.g. Action TESA HDHMR, Teak Veneer)"
                        value={item.materialPreference || ""}
                        onChange={e => handleItemChange(idx, "materialPreference", e.target.value)}
                        className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Client special notes or comments"
                        value={item.clientComment || ""}
                        onChange={e => handleItemChange(idx, "clientComment", e.target.value)}
                        className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: CHARGES & TAXES */}
          {activeTab === "COMMERCIALS" && (
            <div className="space-y-6">
              
              {/* Summary Gross */}
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">Gross Items Scope Total:</span>
                <span className="text-base font-extrabold text-slate-900">₹ {calculations.grossTotal.toLocaleString("en-IN")}</span>
              </div>

              {/* Overall Quote Discount */}
              <div className="bg-slate-50 p-4.5 rounded-2xl border-2 border-slate-200 space-y-3">
                <label className="block text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Overall Quote Discount (Applied on Gross Total)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOverallDiscountType("none")}
                      className={`flex-1 h-11 rounded-xl text-xs font-bold border-2 transition-colors cursor-pointer ${
                        overallDiscountType === "none" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverallDiscountType("percent")}
                      className={`flex-1 h-11 rounded-xl text-xs font-bold border-2 transition-colors cursor-pointer ${
                        overallDiscountType === "percent" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      % Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverallDiscountType("flat")}
                      className={`flex-1 h-11 rounded-xl text-xs font-bold border-2 transition-colors cursor-pointer ${
                        overallDiscountType === "flat" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      ₹ Flat
                    </button>
                  </div>

                  {overallDiscountType !== "none" && (
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        placeholder={overallDiscountType === "percent" ? "Enter % (e.g. 5)" : "Enter ₹ discount (e.g. 25000)"}
                        value={overallDiscountVal}
                        onChange={e => setOverallDiscountVal(e.target.value)}
                        className="w-full h-11 rounded-xl border-2 border-slate-200 px-4 text-sm font-bold text-slate-900 bg-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Charges (Transportation, Packaging, Installation) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Additional Services & Freight Charges
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCharge}
                    className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={16} /> Add Charge
                  </button>
                </div>

                <div className="space-y-2.5">
                  {additionalCharges.map((charge, idx) => (
                    <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-200 flex items-center gap-3">
                      <input
                        type="text"
                        value={charge.title}
                        onChange={e => handleChargeChange(idx, "title", e.target.value)}
                        placeholder="Service name (e.g. Packaging, Freight)"
                        className="flex-1 h-10 rounded-xl border-2 border-slate-200 px-3 text-xs sm:text-sm font-bold bg-white"
                      />
                      <input
                        type="number"
                        min="0"
                        value={charge.amount || ""}
                        onChange={e => handleChargeChange(idx, "amount", Number(e.target.value))}
                        placeholder="Amount (₹)"
                        className="w-32 h-10 rounded-xl border-2 border-slate-200 px-3 text-xs sm:text-sm font-bold bg-white text-right"
                      />
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={charge.taxable}
                          onChange={e => handleChargeChange(idx, "taxable", e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <span>Taxable</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveCharge(idx)}
                        className="h-9 w-9 text-slate-400 hover:text-red-600 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* GST Toggle & Grand Total Highlight Card */}
              <div className="bg-blue-50/60 p-5 rounded-2xl border-2 border-blue-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-blue-950">GST (Goods & Services Tax)</div>
                    <div className="text-xs text-blue-700">Standard 18% applied on discounted gross + taxable services</div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-blue-900">
                    <input
                      type="checkbox"
                      checked={gstApplicable}
                      onChange={e => setGstApplicable(e.target.checked)}
                      className="w-5 h-5 rounded text-blue-600"
                    />
                    <span>18% GST Applicable</span>
                  </label>
                </div>

                <div className="pt-3 border-t-2 border-blue-200/80 flex justify-between items-baseline">
                  <span className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Grand Total Proposal:
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-blue-700">
                    ₹ {calculations.grandTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: TERMS & CONDITIONS */}
          {activeTab === "TERMS" && (
            <div className="space-y-4">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Standard Factory Terms & Conditions
              </span>
              <div className="space-y-3">
                {terms.map((t, idx) => (
                  <div key={t.id || idx} className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">{t.title}</div>
                    <textarea
                      rows={2}
                      value={t.body}
                      onChange={e => {
                        const copy = [...terms];
                        copy[idx].body = e.target.value;
                        setTerms(copy);
                      }}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm font-medium bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-3 border-t-2 border-slate-100">
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  <ShieldCheck size={14} className="text-blue-600" />
                  Admin Direct Mode • Saves as Approved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertCircle size={14} className="text-amber-600" />
                  Sales Mode • Requires Admin Verification
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-12 px-5 border-2 border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-700 cursor-pointer transition-colors"
              >
                Cancel
              </button>

              {isAdmin ? (
                <button
                  disabled={isSaving}
                  type="submit"
                  className="h-12 px-8 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 cursor-pointer disabled:opacity-60 shadow-xs transition-all"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  <span>
                    {isSaving
                      ? "Saving..."
                      : quotation
                      ? quotation.status === "GENERATED" || quotation.status === "APPROVED"
                        ? "Save & Approve Quotation"
                        : `Save & Approve Version ${quotation.currentVersionNo + 1}`
                      : "Save & Approve Quotation"}
                  </span>
                </button>
              ) : (
                <>
                  <button
                    disabled={isSaving}
                    type="button"
                    onClick={() => handleSave(false)}
                    className="h-12 px-6 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 border-2 border-slate-300 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer disabled:opacity-60 transition-all"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    <span>Save Draft</span>
                  </button>

                  <button
                    disabled={isSaving}
                    type="button"
                    onClick={() => handleSave(true)}
                    className="h-12 px-7 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 cursor-pointer disabled:opacity-60 shadow-xs transition-all"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    <span>Submit to Admin for Verification</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}

// -------------------------------------------------------------
// COMPONENT: QUOTATION DETAIL MODAL
// -------------------------------------------------------------

function QuotationDetailModal({
  quotation,
  onClose,
  onEdit,
  onDownloadPDF
}: {
  quotation: Quotation;
  onClose: () => void;
  onEdit: () => void;
  onDownloadPDF: () => void;
}) {
  const ver = quotation.latestVersion;
  const statusConfig = STATUS_CONFIG[quotation.effectiveStatus || quotation.status] || STATUS_CONFIG.GENERATED;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 font-sans">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col overflow-hidden border-2 border-slate-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm font-bold px-2.5 py-0.5 bg-slate-200 text-slate-800 rounded-md">
                {quotation.quotationNumber} (v{quotation.currentVersionNo})
              </span>
              <span className={`px-3.5 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                {statusConfig.label}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
              {quotation.clientName}
            </h2>
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
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Grand Total Proposal</div>
              <div className="text-xl sm:text-2xl font-extrabold text-blue-700 mt-1">
                ₹ {quotation.totalAmount.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Linked Enquiry</div>
              <div className="text-base font-bold text-slate-900 mt-1">
                {quotation.enquiryNumber || "No reference"}
              </div>
            </div>
          </div>

          {/* Client & Address Info */}
          {(quotation.clientPhone || (quotation.clientAddress && (quotation.clientAddress.street || quotation.clientAddress.city))) && (
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              {quotation.clientAddress && (quotation.clientAddress.street || quotation.clientAddress.city) && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Building2 size={16} className="text-blue-600 shrink-0" />
                  <span className="font-bold text-slate-900">
                    {[quotation.clientAddress.street, quotation.clientAddress.city, quotation.clientAddress.state, quotation.clientAddress.zip].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {quotation.clientPhone && (
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <PhoneCall size={14} className="text-emerald-600" />
                  <span>{quotation.clientPhone}</span>
                </div>
              )}
            </div>
          )}

          {/* Scope items */}
          <div>
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide mb-2">
              Scope Items ({ver?.items?.length || 0})
            </div>
            <div className="space-y-2">
              {(ver?.items || []).map((it, idx) => (
                <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-200 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold text-slate-900">{it.description}</span>
                    {it.expectedDimensions && <span className="text-slate-500 ml-2 text-xs">({it.expectedDimensions})</span>}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900">₹ {it.total.toLocaleString("en-IN")}</span>
                    <span className="text-xs text-slate-500 ml-2">Qty: {it.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commercial Breakdown */}
          <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 space-y-1.5 text-xs font-medium text-slate-700">
            <div className="flex justify-between">
              <span>Gross Scope Total:</span>
              <span className="font-bold">₹ {(ver?.grossTotal || 0).toLocaleString("en-IN")}</span>
            </div>
            {ver && ver.overallDiscountAmt > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Overall Discount:</span>
                <span className="font-bold">- ₹ {ver.overallDiscountAmt.toLocaleString("en-IN")}</span>
              </div>
            )}
            {ver && (
              <div className="flex justify-between">
                <span>Extra Services & Freight:</span>
                <span className="font-bold">₹ {ver.extraCostsTotal.toLocaleString("en-IN")}</span>
              </div>
            )}
            {ver && ver.gstApplicable && (
              <div className="flex justify-between">
                <span>GST (18%):</span>
                <span className="font-bold">₹ {ver.gstAmount.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>

          {/* Audit trail */}
          {ver && (
            <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>Created By: <strong className="text-slate-800">{ver.createdByName || "Sales"}</strong> on {formatDisplayDate(ver.createdAt)}</div>
              {ver.verifiedByName && <div>Verified By: <strong className="text-slate-800">{ver.verifiedByName}</strong> on {formatDisplayDate(ver.verifiedAt || "")}</div>}
              {ver.approvedByName && <div>Approved By: <strong className="text-slate-800">{ver.approvedByName}</strong> on {formatDisplayDate(ver.approvedAt || "")}</div>}
              {ver.sentAt && <div>Sent to Client: <strong className="text-slate-800">{formatDisplayDate(ver.sentAt)}</strong></div>}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-4 border-t-2 border-slate-100 flex justify-end gap-3 bg-slate-50/80">
          <button
            onClick={onDownloadPDF}
            className="h-11 px-5 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold text-xs sm:text-sm rounded-xl cursor-pointer flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Download PDF</span>
          </button>
          <button
            onClick={onEdit}
            className="h-11 px-6 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl cursor-pointer shadow-xs transition-all"
          >
            Edit / Fork
          </button>
          <button
            onClick={onClose}
            className="h-11 px-5 border-2 border-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// COMPONENT: LOG FOLLOW-UP MODAL
// -------------------------------------------------------------

function LogFollowupModal({
  quotation,
  onClose,
  onSuccess
}: {
  quotation: Quotation;
  onClose: () => void;
  onSuccess: (data: any) => void;
}) {
  const [channel, setChannel] = useState("Phone Call");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "LOG_FOLLOWUP", channel, note })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log follow-up");
      onSuccess(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-60 p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border-2 border-slate-200">
        <div className="px-6 py-5 border-b-2 border-slate-100 flex justify-between items-center bg-orange-50/70">
          <div>
            <h2 className="text-xl font-extrabold text-orange-950">Log Follow-up Activity</h2>
            <p className="text-xs font-medium text-orange-800 mt-0.5">Resets follow-up alert & records communication</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-orange-200 text-orange-900 flex items-center justify-center cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">Channel *</label>
            <select
              value={channel}
              onChange={e => setChannel(e.target.value)}
              className="w-full h-11 rounded-xl border-2 border-slate-200 px-3.5 text-xs sm:text-sm font-bold text-slate-900 bg-white"
            >
              <option value="Phone Call">Phone Call</option>
              <option value="WhatsApp">WhatsApp Message</option>
              <option value="Site Meeting">In-Person / Site Meeting</option>
              <option value="Email">Email</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">Discussion Notes *</label>
            <textarea
              required
              rows={3}
              placeholder="Client reaction, price feedback, decision timeline..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 p-3 text-xs sm:text-sm font-medium focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              type="submit"
              className="h-10 px-5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              <span>Save & Reset Alert</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// COMPONENT: CLIENT REJECT REASON MODAL
// -------------------------------------------------------------

function RejectModal({
  quotation,
  onClose,
  onSuccess
}: {
  quotation: Quotation;
  onClose: () => void;
  onSuccess: (data: any) => void;
}) {
  const [reason, setReason] = useState("Price Too High");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT_CLIENT", reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark rejected");
      onSuccess(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-center z-60 p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border-2 border-slate-200">
        <div className="px-6 py-5 border-b-2 border-slate-100 flex justify-between items-center bg-red-50/70">
          <div>
            <h2 className="text-xl font-extrabold text-red-950">Mark Client Rejected</h2>
            <p className="text-xs font-medium text-red-800 mt-0.5">Captures loss analytics & closes deal</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-red-200 text-red-900 flex items-center justify-center cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">Primary Reason *</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full h-11 rounded-xl border-2 border-slate-200 px-3.5 text-xs sm:text-sm font-bold text-slate-900 bg-white"
            >
              <option value="Price Too High">Price Too High / Out of Budget</option>
              <option value="Competitor Chosen">Competitor Chosen</option>
              <option value="Project Postponed">Project Postponed / Shelved</option>
              <option value="Delivery Timeline Too Long">Delivery Timeline Too Long</option>
              <option value="Specification Mismatch">Specification Mismatch</option>
              <option value="No Response">Client Stopped Responding</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              type="submit"
              className="h-10 px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              <span>Confirm Loss</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
