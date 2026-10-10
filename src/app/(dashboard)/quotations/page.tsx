"use client";
import { useState, useEffect } from "react";
import { Plus, Edit2, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Client = { id: string; name: string };
type EnquiryItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};
type Enquiry = {
  id: string;
  enquiryNumber: string;
  clientId: string;
  clientName: string;
  notes: string;
  items: EnquiryItem[];
};
type QuotationItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};
type Quotation = {
  id: string;
  quotationNumber: string;
  clientId: string;
  clientName: string;
  status: string;
  totalAmount: number;
  items: QuotationItem[];
  createdAt?: string;
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(
    null,
  );
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState("USER");
  const [isPendingReviewsModalOpen, setIsPendingReviewsModalOpen] =
    useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; user_role=`);
    if (parts.length === 2) {
      setUserRole(parts.pop()?.split(";").shift() || "USER");
    }
    fetchQuotations();
    fetchClients();
    fetchEnquiries();
  }, []);

  const fetchEnquiries = async () => {
    const res = await fetch("/api/enquiries");
    const data = await res.json();
    setEnquiries(data);
  };

  const fetchQuotations = async () => {
    setIsLoading(true);
    const res = await fetch("/api/quotations");
    const data = await res.json();
    setQuotations(data);
    setIsLoading(false);
  };

  const fetchClients = async () => {
    const res = await fetch("/api/clients");
    const data = await res.json();
    setClients(data);
  };

  const handleOpenForm = (quotation: Quotation | null = null) => {
    setEditingQuotation(quotation);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setEditingQuotation(null);
    setIsFormOpen(false);
  };

  const optimisticUpdate = (quotation: Quotation) => {
    setQuotations((prev) => {
      const exists = prev.find((q) => q.id === quotation.id);
      if (exists) {
        return prev.map((q) => (q.id === quotation.id ? quotation : q));
      }
      return [...prev, quotation];
    });
  };

  const handleSendApproval = async (quotation: Quotation) => {
    const updated = { ...quotation, status: "PENDING_APPROVAL" };
    optimisticUpdate(updated);
    setViewingQuotation(null);
    await fetch(`/api/quotations/${quotation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  };

  const handleDirectApprove = async (quotation: Quotation) => {
    const updated = { ...quotation, status: "APPROVED" };
    optimisticUpdate(updated);
    await fetch(`/api/quotations/${quotation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  };

  const handleDownloadPDF = (quotation: Quotation) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`QUOTATION: ${quotation.quotationNumber}`, 14, 22);

    doc.setFontSize(11);
    doc.text(`Client: ${quotation.clientName}`, 14, 32);
    doc.text(`Status: ${quotation.status}`, 14, 38);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 44);

    const tableData = quotation.items.map((item) => [
      item.description,
      item.quantity.toString(),
      `₹${item.unitPrice.toFixed(2)}`,
      `₹${item.total.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 55,
      head: [["Description", "Qty", "Unit Price", "Total"]],
      body: tableData,
      foot: [["", "", "Grand Total", `₹${quotation.totalAmount.toFixed(2)}`]],
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`${quotation.quotationNumber}.pdf`);
  };

  const pendingCount = quotations.filter(
    (q) => q.status === "PENDING_APPROVAL",
  ).length;

  const filteredQuotations = quotations.filter(q => {
    const matchesSearch = q.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (q.clientName && q.clientName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 grid grid-cols-5 gap-4 animate-slide-up stagger-1">
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            TOTAL QUOTES
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {quotations.length}
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            OVERDUE FOLLOW-UPS
          </div>
          <div className="text-3xl font-bold text-gray-900">0</div>
          <div className="text-xs text-gray-400 mt-2">all caught up</div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            WON
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {quotations.filter((q) => q.status === "APPROVED").length}
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            CONVERSION RATE
          </div>
          <div className="text-3xl font-bold text-gray-900">—</div>
          <div className="text-xs text-gray-400 mt-2">none decided yet</div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            TOTAL PIPELINE VALUE
          </div>
          <div className="text-3xl font-bold text-gray-900">
            ₹
            {quotations
              .reduce((acc, q) => acc + q.totalAmount, 0)
              .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 animate-slide-up stagger-2">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input 
            type="text" 
            placeholder="Search quotes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
          />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          {userRole === "SUPER_ADMIN" && pendingCount > 0 && (
            <div
              onClick={() => setIsPendingReviewsModalOpen(true)}
              className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded border border-orange-200 shadow-sm animate-pulse cursor-pointer hover:bg-orange-100 transition-colors shrink-0"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
              </span>
              <span className="text-xs font-bold flex items-center gap-1">
                {pendingCount} Pending Review
              </span>
            </div>
          )}
          <button
            onClick={() => handleOpenForm(null)}
            className="text-sm font-bold bg-[#ff7f11] hover:bg-[#e06d0b] text-white px-5 py-2.5 rounded shadow-sm transition-colors flex items-center gap-1 shrink-0"
          >
            + New Quote
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up stagger-3">
          <table className="min-w-full">
            <tbody className="bg-white">
              {Array.from({ length: 4 }).map((_, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-50 last:border-0 animate-pulse"
                >
                  <td className="px-6 py-4">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-gray-200 rounded w-40"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center animate-slide-up stagger-3">
          <div className="text-[#c3b6a2] text-sm">
            No Quotations match your filters.
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up stagger-3">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Number
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredQuotations.map((qt) => (
                <tr
                  key={qt.id}
                  onClick={() => setViewingQuotation(qt)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {qt.quotationNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {qt.clientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ₹{qt.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {qt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <span className="text-gray-400 font-bold hover:text-gray-600 transition-colors">
                      View &rarr;
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <QuotationForm
          quotation={editingQuotation}
          userRole={userRole}
          clients={clients}
          enquiries={enquiries}
          onClose={handleCloseForm}
          onSuccess={() => {
            fetchQuotations();
            handleCloseForm();
          }}
          optimisticUpdate={optimisticUpdate}
        />
      )}

      {viewingQuotation && (
        <QuotationViewCard
          quotation={viewingQuotation}
          userRole={userRole}
          onClose={() => setViewingQuotation(null)}
          onEdit={() => handleOpenForm(viewingQuotation)}
          onDownload={() => handleDownloadPDF(viewingQuotation)}
          onSendApproval={() => handleSendApproval(viewingQuotation)}
          onDirectApprove={() => {
            setViewingQuotation(null);
            handleDirectApprove(viewingQuotation);
          }}
        />
      )}

      {isPendingReviewsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl shadow-xl flex flex-col rounded-2xl overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                </span>
                Pending Approvals
              </h2>
              <button
                onClick={() => setIsPendingReviewsModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 text-2xl font-light transition-colors"
              >
                &times;
              </button>
            </div>
            <div className="p-0 overflow-y-auto max-h-[70vh]">
              <table className="min-w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Number
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {quotations
                    .filter((q) => q.status === "PENDING_APPROVAL")
                    .map((qt) => (
                      <tr
                        key={qt.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                          {qt.quotationNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                          {qt.clientName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                          ₹{qt.totalAmount?.toFixed(2) || "0.00"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                setIsPendingReviewsModalOpen(false);
                                setViewingQuotation(qt);
                              }}
                              className="text-blue-600 hover:text-blue-900 font-bold bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors active:scale-95"
                            >
                              View full
                            </button>
                            <button
                              onClick={() => handleDirectApprove(qt)}
                              className="text-white font-bold bg-green-600 px-3 py-1.5 rounded-full hover:bg-green-700 transition-colors active:scale-95"
                            >
                              Quick Approve
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {quotations.filter((q) => q.status === "PENDING_APPROVAL")
                    .length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-gray-400"
                      >
                        All caught up! No pending approvals.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuotationForm({
  quotation,
  userRole,
  clients,
  enquiries,
  onClose,
  onSuccess,
  optimisticUpdate,
}: {
  quotation: Quotation | null;
  userRole: string;
  clients: Client[];
  enquiries: Enquiry[];
  onClose: () => void;
  onSuccess: () => void;
  optimisticUpdate: (q: Quotation) => void;
}) {
  const [formData, setFormData] = useState({
    clientId: quotation?.clientId || (clients.length > 0 ? clients[0].id : ""),
    status: quotation?.status || "DRAFT",
    items: quotation?.items || [
      {
        id: Math.random().toString(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ],
  });

  const [selectedEnquiryId, setSelectedEnquiryId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleEnquirySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const enqId = e.target.value;
    setSelectedEnquiryId(enqId);

    const enq = enquiries.find((eq) => eq.id === enqId);
    if (enq) {
      setFormData({
        ...formData,
        clientId: enq.clientId,
        items:
          enq.items && enq.items.length > 0
            ? enq.items.map((item) => ({
                ...item,
                id: Math.random().toString(),
              }))
            : [
                {
                  id: Math.random().toString(),
                  description: enq.notes || "Imported from Enquiry",
                  quantity: 1,
                  unitPrice: 0,
                  total: 0,
                },
              ],
      });
    }
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      item.total = Number(item.quantity) * Number(item.unitPrice);
    }
    newItems[index] = item as QuotationItem;
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          id: Math.random().toString(),
          description: "",
          quantity: 1,
          unitPrice: 0,
          total: 0,
        },
      ],
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e?: React.FormEvent, overrideStatus?: string) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    const selectedClient = clients.find((c) => c.id === formData.clientId);
    const totalAmount = formData.items.reduce(
      (sum, item) => sum + item.total,
      0,
    );

    const dataToSubmit = {
      ...formData,
      status: overrideStatus || formData.status,
      clientName: selectedClient?.name || "",
      totalAmount,
    };

    // Optimistic Update
    const mockId = quotation?.id || Math.random().toString();
    optimisticUpdate({
      ...dataToSubmit,
      id: mockId,
      quotationNumber: quotation?.quotationNumber || "QT-...",
    } as Quotation);
    onClose();

    const url = quotation
      ? `/api/quotations/${quotation.id}`
      : "/api/quotations";
    const method = quotation ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSubmit),
    });

    if (res.ok) {
      onSuccess();
    } else {
      alert("Error saving quotation");
    }
  };

  const grandTotal = formData.items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl h-[90vh] shadow-xl flex flex-col rounded-lg animate-slide-up">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h2 className="text-xl font-bold">
            {quotation ? "Edit Quotation" : "New Quotation"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 font-bold text-xl transition-colors"
          >
            &times;
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 flex-1 overflow-y-auto space-y-6"
        >
          {!quotation && enquiries.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
              <label className="block text-sm font-semibold text-blue-900 mb-1">
                Make from existing Enquiry (Optional)
              </label>
              <select
                className="block w-full rounded-md border-blue-300 shadow-sm p-2 border bg-white transition-shadow"
                value={selectedEnquiryId}
                onChange={handleEnquirySelect}
              >
                <option value="">-- Start from scratch --</option>
                {enquiries.map((enq) => (
                  <option key={enq.id} value={enq.id}>
                    {enq.enquiryNumber} - {enq.clientName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Client
              </label>
              <select
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow"
                value={formData.clientId}
                onChange={(e) =>
                  setFormData({ ...formData, clientId: e.target.value })
                }
              >
                <option value="" disabled>
                  Select a client...
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            {userRole === "SUPER_ADMIN" && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved (Internal)</option>
                  <option value="SENT">Sent to Client</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Line Items
              </label>
              <button
                type="button"
                onClick={addItem}
                className="text-xs bg-gray-100 px-3 py-1 rounded border hover:bg-gray-200 transition-colors active:scale-95"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div
                  key={item.id}
                  className="flex gap-2 items-center bg-gray-50 p-2 rounded border"
                >
                  <input
                    required
                    type="text"
                    placeholder="Description"
                    className="flex-1 p-2 text-sm border rounded outline-none focus:ring-2 transition-shadow"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, "description", e.target.value)
                    }
                  />
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Qty"
                    className="w-20 p-2 text-sm border rounded outline-none focus:ring-2 transition-shadow"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, "quantity", Number(e.target.value))
                    }
                  />
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    className="w-28 p-2 text-sm border rounded outline-none focus:ring-2 transition-shadow"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(index, "unitPrice", Number(e.target.value))
                    }
                  />
                  <div className="w-24 text-right font-semibold text-sm">
                    ₹{item.total.toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-red-500 hover:text-red-700 px-2 font-bold transition-colors"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 text-right text-lg font-bold text-gray-900 border-t pt-4">
              Grand Total: ₹{grandTotal.toFixed(2)}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors active:scale-95"
            >
              Cancel
            </button>
            {userRole !== "SUPER_ADMIN" && (
              <button
                disabled={isSaving}
                type="button"
                onClick={() => handleSubmit(undefined, "PENDING_APPROVAL")}
                className="px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-md hover:bg-orange-100 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2 font-bold"
              >
                Save & Submit for Approval
              </button>
            )}
            <button
              disabled={isSaving}
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {userRole === "SUPER_ADMIN"
                ? isSaving
                  ? "Saving..."
                  : "Save Quotation"
                : isSaving
                  ? "Saving Draft..."
                  : "Save as Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuotationViewCard({
  quotation,
  userRole,
  onClose,
  onEdit,
  onDownload,
  onSendApproval,
  onDirectApprove,
}: {
  quotation: Quotation;
  userRole: string;
  onClose: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onSendApproval: () => void;
  onDirectApprove: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl shadow-xl flex flex-col rounded-2xl overflow-hidden animate-slide-up">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-slate-900">
            Quotation Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 text-2xl font-light transition-colors"
          >
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-gray-100">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                Quotation Number
              </p>
              <p className="font-bold text-slate-900">
                {quotation.quotationNumber}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                Client
              </p>
              <p className="font-bold text-slate-900">{quotation.clientName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                Status
              </p>
              <span
                className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full 
                ₹{
                  quotation.status === "APPROVED"
                    ? "bg-green-100 text-green-800"
                    : quotation.status === "REJECTED"
                      ? "bg-red-100 text-red-800"
                      : quotation.status === "PENDING_APPROVAL"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-blue-100 text-blue-800"
                }`}
              >
                {quotation.status.replace("_", " ")}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                Date
              </p>
              <p className="font-bold text-slate-900">
                {quotation.createdAt
                  ? new Date(quotation.createdAt).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-3">
              Line Items
            </p>
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-bold text-gray-500">
                      Description
                    </th>
                    <th className="px-4 py-3 font-bold text-gray-500 text-center">
                      Qty
                    </th>
                    <th className="px-4 py-3 font-bold text-gray-500 text-right">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 font-bold text-gray-500 text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {quotation.items?.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-800">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-slate-800 text-center font-medium">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-right">
                        ₹{item.unitPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-bold text-right">
                        ₹{item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {(!quotation.items || quotation.items.length === 0) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-gray-400"
                      >
                        No items specified.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="px-4 py-3 bg-slate-50 text-right font-black text-slate-900 text-lg border-t border-gray-200">
                Grand Total: ₹{quotation.totalAmount?.toFixed(2) || "0.00"}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-gray-200 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => {
                onDownload();
              }}
              className="px-5 py-2.5 rounded-full text-sm font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 shadow-sm flex items-center gap-2 transition-colors active:scale-95"
            >
              <Download size={16} /> Download PDF
            </button>
            {userRole !== "SUPER_ADMIN" && quotation.status === "DRAFT" && (
              <button
                onClick={() => {
                  onClose();
                  onSendApproval();
                }}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 shadow-sm flex items-center gap-2 transition-colors active:scale-95"
              >
                Submit for Approval
              </button>
            )}
            {userRole === "SUPER_ADMIN" &&
              quotation.status === "PENDING_APPROVAL" && (
                <button
                  onClick={() => {
                    onClose();
                    onDirectApprove();
                  }}
                  className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-sm flex items-center gap-2 transition-colors active:scale-95"
                >
                  Approve Quotation
                </button>
              )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 shadow-sm hover:shadow transition-colors active:scale-95"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-full hover:bg-slate-800 flex items-center gap-2 shadow-sm hover:shadow transition-all active:scale-95"
            >
              <Edit2 size={16} /> Edit Quotation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
