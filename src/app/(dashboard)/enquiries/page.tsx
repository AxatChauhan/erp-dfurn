'use client';
import { useState, useEffect, useMemo } from 'react';
import { Edit2, Loader2, Plus, Trash2, Calendar, IndianRupee, MapPin, Search, ArrowRight, ArrowLeft, FileText, Link as LinkIcon, Paperclip, AlertCircle, TrendingUp, Users } from 'lucide-react';

type Client = { id: string; clientType: string; name: string; };

type EnquiryItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  expectedDimensions?: string;
  materialPreference?: string;
};

type EnquiryAttachment = {
  name: string;
  url: string;
};

type Enquiry = {
  id: string;
  enquiryNumber: string;
  clientId: string;
  clientName: string;
  status: string;
  notes: string;
  expectedTimeline?: string;
  estimatedBudget?: number;
  propertyType?: string;
  nextFollowUp?: string;
  sourceCategory?: string;
  sourceName?: string;
  attachments?: EnquiryAttachment[];
  items: EnquiryItem[];
  createdAt: string;
  updatedAt?: string;
};

const STATUSES = [
  { id: 'NEW', label: 'New Lead', color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' },
  { id: 'QUALIFIED', label: 'Qualified', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  { id: 'CONVERTED', label: 'Converted', color: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500' },
  { id: 'DROPPED', label: 'Dropped', color: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' },
];

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingEnquiry, setViewingEnquiry] = useState<Enquiry | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'KANBAN' | 'LIST'>('KANBAN');

  useEffect(() => {
    fetchEnquiries();
    fetchClients();
  }, []);

  const fetchEnquiries = async () => {
    setIsLoading(true);
    const res = await fetch('/api/enquiries');
    const data = await res.json();
    setEnquiries(data.map((e: any) => ({
      ...e,
      attachments: e.attachments || []
    })));
    setIsLoading(false);
  };

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    const data = await res.json();
    setClients(data);
  };

  const handleOpenForm = (enquiry: Enquiry | null = null) => {
    setEditingEnquiry(enquiry);
    setIsFormOpen(true);
    setIsViewOpen(false);
  };

  const handleCloseForm = () => {
    setEditingEnquiry(null);
    setIsFormOpen(false);
  };

  const handleOpenView = (enquiry: Enquiry) => {
    setViewingEnquiry(enquiry);
    setIsViewOpen(true);
  };

  const handleCloseView = () => {
    setViewingEnquiry(null);
    setIsViewOpen(false);
  };

  const handleStatusChange = async (enquiry: Enquiry, newStatus: string) => {
    const prevEnquiries = [...enquiries];
    setEnquiries(enquiries.map(e => e.id === enquiry.id ? { ...e, status: newStatus } : e));
    
    if (viewingEnquiry && viewingEnquiry.id === enquiry.id) {
      setViewingEnquiry({ ...viewingEnquiry, status: newStatus });
    }

    const res = await fetch(`/api/enquiries/${enquiry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...enquiry, status: newStatus })
    });
    
    if (!res.ok) {
      alert("Failed to update status");
      setEnquiries(prevEnquiries);
    }
  };

  const convertToQuotation = async (enquiry: Enquiry) => {
    if (!confirm('Generate a Quotation from this Enquiry?')) return;
    
    const res = await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: enquiry.clientId,
        enquiryId: enquiry.id,
        items: enquiry.items,
        status: 'DRAFT'
      })
    });
    
    if (res.ok) {
      handleStatusChange(enquiry, 'CONVERTED');
      alert("Quotation generated successfully!");
    } else {
      alert("Failed to generate Quotation");
    }
  };

  const filteredEnquiries = enquiries.filter(e => {
    const q = searchQuery.toLowerCase();
    return e.enquiryNumber.toLowerCase().includes(q) || e.clientName.toLowerCase().includes(q);
  });


  // Calculate Insights
  const insights = useMemo(() => {
    const active = enquiries.filter(e => e.status !== 'DROPPED' && e.status !== 'CONVERTED');
    const pipelineValue = active.reduce((acc, curr) => acc + (curr.estimatedBudget || 0), 0);
    const newLeads = enquiries.filter(e => e.status === 'NEW').length;
    const overdue = active.filter(e => e.nextFollowUp && new Date(e.nextFollowUp) < new Date()).length;
    
    return { pipelineValue, activeLeads: active.length, newLeads, overdue };
  }, [enquiries]);

  const handleDragStart = (e: React.DragEvent, enquiryId: string) => {
    e.dataTransfer.setData('enquiryId', enquiryId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const enquiryId = e.dataTransfer.getData('enquiryId');
    const enquiry = enquiries.find(eq => eq.id === enquiryId);
    if (enquiry && enquiry.status !== newStatus) {
      handleStatusChange(enquiry, newStatus);
    }
  };


  return (
    <div className="max-w-[1600px] mx-auto h-[calc(100vh-100px)] flex flex-col">
      
      {/* INSIGHTS TOP BAR */}
      <div className="grid grid-cols-4 gap-4 mb-4 shrink-0 animate-slide-up stagger-1">
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-orange-50 text-orange-600 p-3 rounded-full"><TrendingUp size={20} /></div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Pipeline Value</div>
            <div className="text-xl font-bold text-gray-900">₹{insights.pipelineValue.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-full"><Users size={20} /></div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Active Leads</div>
            <div className="text-xl font-bold text-gray-900">{insights.activeLeads}</div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full"><Plus size={20} /></div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">New Leads</div>
            <div className="text-xl font-bold text-gray-900">{insights.newLeads}</div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-red-100 shadow-sm flex items-center gap-4">
          <div className="bg-red-50 text-red-600 p-3 rounded-full"><AlertCircle size={20} /></div>
          <div>
            <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-0.5">Needs Follow-up</div>
            <div className="text-xl font-bold text-red-600">{insights.overdue}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 animate-slide-up stagger-2 shrink-0 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search leads..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm border border-gray-200 rounded-md pl-9 pr-3 py-1.5 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300"
            />
          </div>
          <div className="bg-gray-100 p-1 rounded-md flex gap-1">
            <button onClick={() => setViewMode('KANBAN')} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${viewMode === 'KANBAN' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Board</button>
            <button onClick={() => setViewMode('LIST')} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${viewMode === 'LIST' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>List</button>
          </div>
        </div>
        <button onClick={() => handleOpenForm(null)} className="text-sm font-bold bg-[#ff7f11] hover:bg-[#e06d0b] text-white px-4 py-2 rounded transition-colors flex items-center gap-1 shrink-0">
          + New Enquiry
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-gray-300" />
        </div>
      ) : viewMode === 'KANBAN' ? (
        <div className="flex-1 overflow-x-auto flex gap-4 pb-2 animate-slide-up stagger-3">
          {STATUSES.map(statusObj => {
            const columnEnquiries = filteredEnquiries.filter(e => e.status === statusObj.id);
            return (
              <div 
              key={statusObj.id} 
              className="flex-shrink-0 w-[280px] bg-slate-50 rounded-lg flex flex-col h-full border border-slate-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, statusObj.id)}
            >
                
                {/* Column Header */}
                <div className="p-3 pb-2 flex items-center justify-between sticky top-0 bg-slate-50 z-10 rounded-t-lg">
                  <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusObj.dot}`}></span>
                    {statusObj.label}
                  </h3>
                  <span className="bg-white text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm">{columnEnquiries.length}</span>
                </div>
                
                {/* Cards Container */}
                <div className="p-2 pt-1 flex-1 overflow-y-auto space-y-2.5 custom-scrollbar">
                  {columnEnquiries.map(enquiry => (
                      <div 
                        key={enquiry.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, enquiry.id)}
                        className="bg-white rounded-md p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer mb-3 relative group"
                        onClick={() => handleOpenView(enquiry)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs text-gray-400 font-medium">{enquiry.enquiryNumber}</span>
                        </div>
                        
                        <div className="font-bold text-gray-900 text-sm mb-4">
                          {enquiry.clientName}
                        </div>
                        
                        <div className="flex items-center justify-between text-[11px] text-gray-400 mt-auto border-t border-gray-50 pt-3" onClick={e => e.stopPropagation()}>
                          <span>{enquiry.items.length} items</span>
                          
                          <div className="flex gap-1.5 text-gray-300">
                            {STATUSES.findIndex(s => s.id === enquiry.status) > 0 && (
                              <button onClick={() => handleStatusChange(enquiry, STATUSES[STATUSES.findIndex(s => s.id === enquiry.status) - 1].id)} className="hover:text-gray-500">
                                <ArrowLeft size={12} />
                              </button>
                            )}
                            {STATUSES.findIndex(s => s.id === enquiry.status) < STATUSES.length - 1 && (
                              <button onClick={() => handleStatusChange(enquiry, STATUSES[STATUSES.findIndex(s => s.id === enquiry.status) + 1].id)} className="hover:text-gray-500">
                                <ArrowRight size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1 animate-slide-up stagger-3">
           <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Enquiry</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Context</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {filteredEnquiries.map((enquiry) => (
                <tr key={enquiry.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => handleOpenView(enquiry)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{enquiry.enquiryNumber}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{new Date(enquiry.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{enquiry.clientName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <select 
                      value={enquiry.status}
                      onChange={(e) => handleStatusChange(enquiry, e.target.value)}
                      className={`text-xs font-bold rounded-full px-3 py-1 border outline-none cursor-pointer ${STATUSES.find(s => s.id === enquiry.status)?.color}`}
                    >
                      {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{enquiry.propertyType || '-'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{enquiry.estimatedBudget ? `₹${enquiry.estimatedBudget.toLocaleString()}` : '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-3 items-center h-full" onClick={e => e.stopPropagation()}>
                    {enquiry.status === 'QUALIFIED' && (
                      <button onClick={() => convertToQuotation(enquiry)} className="text-xs font-bold text-emerald-600 hover:text-emerald-800">
                        Generate Quote
                      </button>
                    )}
                    <button onClick={() => handleOpenForm(enquiry)} className="text-gray-400 hover:text-blue-600 transition-colors">
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isViewOpen && viewingEnquiry && (
        <EnquiryDetailsModal
          enquiry={viewingEnquiry}
          onClose={handleCloseView}
          onEdit={() => handleOpenForm(viewingEnquiry)}
          onConvert={() => convertToQuotation(viewingEnquiry)}
        />
      )}

      {isFormOpen && (
        <EnquiryForm 
          enquiry={editingEnquiry} 
          clients={clients}
          onClose={handleCloseForm} 
          onSuccess={() => { fetchEnquiries(); handleCloseForm(); }} 
        />
      )}
    </div>
  );
}

/* Modals kept exactly as before but ensuring they blend nicely... */
/* [Omitting details modal and form code from thought logic, retaining it fully in actual code] */

function EnquiryDetailsModal({ enquiry, onClose, onEdit, onConvert }: { enquiry: Enquiry, onClose: () => void, onEdit: () => void, onConvert: () => void }) {
  const [showLog, setShowLog] = useState(false);
  const statusObj = STATUSES.find(s => s.id === enquiry.status) || STATUSES[0];
  const isOverdue = enquiry.nextFollowUp && new Date(enquiry.nextFollowUp) < new Date() && enquiry.status !== 'CONVERTED' && enquiry.status !== 'DROPPED';

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl flex flex-col max-h-full animate-slide-up">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-start bg-gray-50 rounded-t-xl">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-gray-900">{enquiry.enquiryNumber}</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusObj.color}`}>{statusObj.label}</span>
            </div>
            <p className="text-sm text-gray-500">For <span className="font-bold text-gray-900">{enquiry.clientName}</span> &middot; Created {new Date(enquiry.createdAt).toLocaleDateString()}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 font-bold text-2xl transition-colors">&times;</button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3 uppercase tracking-wider">Context & Source</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-3 text-sm">
                  <span className="text-gray-500 col-span-1">Property Type</span>
                  <span className="text-gray-900 col-span-2 font-medium">{enquiry.propertyType || '-'}</span>
                </div>
                <div className="grid grid-cols-3 text-sm">
                  <span className="text-gray-500 col-span-1">Timeline</span>
                  <span className="text-gray-900 col-span-2 font-medium">{enquiry.expectedTimeline || '-'}</span>
                </div>
                <div className="grid grid-cols-3 text-sm">
                  <span className="text-gray-500 col-span-1">Budget</span>
                  <span className="text-gray-900 col-span-2 font-medium">{enquiry.estimatedBudget ? `₹${enquiry.estimatedBudget.toLocaleString()}` : '-'}</span>
                </div>
                <div className="grid grid-cols-3 text-sm">
                  <span className="text-gray-500 col-span-1">Follow-up</span>
                  <span className={`col-span-2 font-bold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                    {enquiry.nextFollowUp ? new Date(enquiry.nextFollowUp).toLocaleDateString() : '-'}
                  </span>
                </div>
                <div className="grid grid-cols-3 text-sm mt-2 pt-2 border-t border-dashed">
                  <span className="text-gray-500 col-span-1">Source</span>
                  <span className="text-gray-900 col-span-2 font-medium">
                    {enquiry.sourceCategory ? enquiry.sourceCategory.replace('_', ' ') : '-'}
                    {enquiry.sourceName && ` (${enquiry.sourceName})`}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3 uppercase tracking-wider">Notes & Documents</h3>
              <div className="bg-orange-50/50 border border-orange-100 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap min-h-[80px]">
                {enquiry.notes || <span className="text-gray-400 italic">No internal notes added.</span>}
              </div>
              
              <div className="mt-4">
                <h4 className="text-xs font-bold text-gray-500 mb-2">ATTACHMENTS</h4>
                {enquiry.attachments && enquiry.attachments.length > 0 ? (
                  <ul className="space-y-2">
                    {enquiry.attachments.map((file, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded border border-gray-200">
                        <FileText size={14} className="text-blue-500" />
                        <a href={file.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex-1 truncate">{file.name}</a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400">No files attached.</p>
                )}
              </div>
            </div>
          </div>

          <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3 uppercase tracking-wider">Requirements ({enquiry.items.length})</h3>
          {enquiry.items.length > 0 ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Item</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Specs / Material</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500">Est. Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {enquiry.items.map(item => (
                    <tr key={item.id} className="text-sm">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {item.expectedDimensions && <div>Dim: {item.expectedDimensions}</div>}
                        {item.materialPreference && <div>Mat: {item.materialPreference}</div>}
                        {!item.expectedDimensions && !item.materialPreference && '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{item.unitPrice > 0 ? `₹${item.unitPrice.toLocaleString()}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No items specified for this enquiry.</p>
          )}
        </div>        <div className="px-6 py-4 bg-gray-50 border-t rounded-b-xl flex justify-between items-center">
          <div className="flex gap-2">
            <button onClick={onEdit} className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 bg-blue-50 px-4 py-2 rounded-md transition-colors">
              <Edit2 size={16} /> Edit Enquiry
            </button>
            <button onClick={() => setShowLog(true)} className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-sm rounded-md hover:bg-slate-300 transition-colors flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> View Log
            </button>
          </div>
          
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100 text-sm font-medium transition-colors">Close</button>
            {enquiry.status === 'QUALIFIED' && (
              <button onClick={onConvert} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-bold text-sm transition-colors shadow-sm">
                Generate Quotation
              </button>
            )}
          </div>
        </div>
      </div>

      {showLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[60] p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
            <div className="px-5 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Activity Log
              </h3>
              <button onClick={() => setShowLog(false)} className="text-gray-400 hover:text-gray-900 font-bold text-xl">&times;</button>
            </div>
            <div className="p-5 space-y-5 bg-white">
              <div className="flex gap-3 items-start">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]"></div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Enquiry Created</p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(enquiry.createdAt).toLocaleString(undefined, {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
              {enquiry.updatedAt && new Date(enquiry.updatedAt).getTime() - new Date(enquiry.createdAt).getTime() > 60000 && (
                <div className="flex gap-3 items-start relative before:absolute before:left-[4px] before:top-[-25px] before:w-[2px] before:h-[25px] before:bg-slate-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-400 mt-1 shrink-0 shadow-[0_0_0_3px_rgba(251,146,60,0.2)]"></div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Enquiry Updated</p>
                    <p className="text-xs text-slate-500">Record modified or status changed to {STATUSES.find(s => s.id === enquiry.status)?.label || enquiry.status}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(enquiry.updatedAt).toLocaleString(undefined, {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
                </div>
              )}
              {enquiry.status === 'CONVERTED' && (
                <div className="flex gap-3 items-start relative before:absolute before:left-[4px] before:top-[-25px] before:w-[2px] before:h-[25px] before:bg-slate-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500 mt-1 shrink-0 shadow-[0_0_0_3px_rgba(168,85,247,0.2)]"></div>
                  <div>
                    <p className="text-sm font-bold text-purple-700">Converted to Quotation</p>
                    <p className="text-xs text-slate-500">A quotation has been generated from this lead.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setShowLog(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-xs font-bold hover:bg-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EnquiryForm({ enquiry, clients, onClose, onSuccess }: { enquiry: Enquiry | null, clients: Client[], onClose: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState<Partial<Enquiry>>(enquiry || {
    clientId: '', status: 'NEW', notes: '', expectedTimeline: '', estimatedBudget: 0, propertyType: '', nextFollowUp: '', sourceCategory: '', sourceName: '', attachments: [], items: []
  });
  const [isSaving, setIsSaving] = useState(false);
  
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const payload = {
      ...formData,
      items: (formData.items || []).map(i => ({...i, total: i.quantity * i.unitPrice}))
    };

    const url = enquiry ? `/api/enquiries/${enquiry.id}` : '/api/enquiries';
    const method = enquiry ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      onSuccess();
    } else {
      alert("Error saving enquiry");
      setIsSaving(false);
    }
  };

  const handleQuickClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClientName, phones: newClientPhone ? [newClientPhone] : [], clientType: 'BUSINESS' })
    });
    if (res.ok) {
      const createdClient = await res.json();
      setFormData({...formData, clientId: createdClient.id});
      setIsQuickClientOpen(false);
      clients.push(createdClient);
    } else {
      alert("Error creating client");
    }
  };

  const addItem = () => {
    setFormData({
      ...formData, 
      items: [...(formData.items || []), { id: Math.random().toString(), description: '', quantity: 1, unitPrice: 0, total: 0, expectedDimensions: '', materialPreference: '' }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({...formData, items: newItems});
  };

  const removeItem = (index: number) => {
    const newItems = [...(formData.items || [])];
    newItems.splice(index, 1);
    setFormData({...formData, items: newItems});
  };

  const addAttachment = () => {
    if (!newAttachmentName || !newAttachmentUrl) return;
    setFormData({
      ...formData,
      attachments: [...(formData.attachments || []), { name: newAttachmentName, url: newAttachmentUrl }]
    });
    setNewAttachmentName('');
    setNewAttachmentUrl('');
  };

  const removeAttachment = (index: number) => {
    const newAtt = [...(formData.attachments || [])];
    newAtt.splice(index, 1);
    setFormData({...formData, attachments: newAtt});
  };

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-end z-[60]">
      <div className="bg-white w-full max-w-3xl h-full shadow-xl flex flex-col animate-slide-up border-l">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">{enquiry ? `Edit Enquiry (${enquiry.enquiryNumber})` : 'New Enquiry'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 font-bold text-xl transition-colors">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-8 bg-white">
          
          <section className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <div className="flex justify-between items-end mb-1">
                <label className="block text-sm font-medium text-gray-700">Client *</label>
                {!isQuickClientOpen && <button type="button" onClick={() => setIsQuickClientOpen(true)} className="text-xs font-bold text-orange-600 hover:text-orange-800">+ Quick Add</button>}
              </div>
              
              {isQuickClientOpen ? (
                <div className="p-3 border border-orange-200 bg-orange-50 rounded-md">
                  <input type="text" placeholder="Client/Company Name" className="w-full mb-2 p-2 border rounded text-sm" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                  <input type="tel" placeholder="Phone Number" className="w-full mb-2 p-2 border rounded text-sm" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsQuickClientOpen(false)} className="text-xs px-3 py-1 text-gray-500 hover:bg-gray-200 rounded">Cancel</button>
                    <button type="button" onClick={handleQuickClientSubmit} className="text-xs px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 font-bold">Save & Select</button>
                  </div>
                </div>
              ) : (
                <select required className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white" value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                  <option value="" disabled>Select a client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline Status</label>
              <select className="w-full p-2 border border-gray-300 rounded text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none bg-white" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4 uppercase tracking-wider">Context & Discovery</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <input type="text" placeholder="e.g. Residential, Office, Retail" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
                  value={formData.propertyType || ''} onChange={e => setFormData({...formData, propertyType: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Timeline</label>
                <input type="text" placeholder="e.g. Urgent, 2-3 Months" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
                  value={formData.expectedTimeline || ''} onChange={e => setFormData({...formData, expectedTimeline: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Budget (₹)</label>
                <input type="number" placeholder="50000" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
                  value={formData.estimatedBudget || ''} onChange={e => setFormData({...formData, estimatedBudget: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Follow-up Date</label>
                <input type="date" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
                  value={formData.nextFollowUp ? new Date(formData.nextFollowUp).toISOString().split('T')[0] : ''} 
                  onChange={e => setFormData({...formData, nextFollowUp: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Category</label>
                <select className="w-full rounded-md border-gray-300 p-2 border focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-white"
                  value={formData.sourceCategory || ''} onChange={e => setFormData({...formData, sourceCategory: e.target.value})}>
                  <option value="">Select Category...</option>
                  <option value="DIRECT_ENQUIRY">Direct Enquiry</option>
                  <option value="SOCIAL_MEDIA">Social Media</option>
                  <option value="WEBSITE">DFurn Website</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="ARCHITECT_DESIGNER">Architect / Designer</option>
                  <option value="EXHIBITION">Exhibition / Event</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Name / Referrer</label>
                <input type="text" placeholder="e.g. 'John Doe Architects'" className="w-full rounded-md border-gray-300 p-2 border focus:ring-2 focus:ring-orange-500 outline-none text-sm" 
                  value={formData.sourceName || ''} onChange={e => setFormData({...formData, sourceName: e.target.value})} />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes / Log</label>
                <textarea rows={3} placeholder="Met with client, discussed teak options..." className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
                  value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4 uppercase tracking-wider">Document Attachments</h3>
            <div className="space-y-3 mb-4">
              {(formData.attachments || []).map((att, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-200">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText size={16} className="text-gray-400 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 truncate">{att.name}</div>
                      <a href={att.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1"><LinkIcon size={10}/> Link</a>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeAttachment(i)} className="text-red-500 hover:bg-red-100 p-2 rounded shrink-0"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 items-end bg-gray-50 p-3 rounded-md border border-gray-200 border-dashed">
              <div className="flex-1">
                <input type="text" placeholder="Document Name (e.g. Site Floor Plan)" className="w-full p-2 border border-gray-300 rounded text-sm mb-2" value={newAttachmentName} onChange={e => setNewAttachmentName(e.target.value)} />
                <input type="url" placeholder="File URL (e.g. Drive link, Image link)" className="w-full p-2 border border-gray-300 rounded text-sm" value={newAttachmentUrl} onChange={e => setNewAttachmentUrl(e.target.value)} />
              </div>
              <button type="button" onClick={addAttachment} disabled={!newAttachmentName || !newAttachmentUrl} className="px-4 py-2 bg-gray-200 text-gray-700 font-bold text-sm rounded hover:bg-gray-300 disabled:opacity-50 h-[80px]">Add</button>
            </div>
          </section>

          <section>
            <div className="flex justify-between items-end border-b pb-2 mb-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Requirements Gathering</h3>
              <button type="button" onClick={addItem} className="text-xs font-bold text-[#ff7f11] hover:text-[#e06d0b] flex items-center gap-1">+ Add Requirement</button>
            </div>
            
            <div className="space-y-4">
              {(formData.items || []).map((item, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded p-4 relative group">
                  <button type="button" onClick={() => removeItem(index)} className="absolute top-2 right-2 text-red-500 hover:bg-red-100 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                  
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12">
                      <input required type="text" placeholder="Item Description (e.g. Wardrobe, Conference Table)" className="w-full p-2 border border-gray-300 rounded text-sm bg-white" 
                        value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} />
                    </div>
                    
                    <div className="col-span-6 md:col-span-4">
                      <input type="text" placeholder="Dimensions (L x W x H)" className="w-full p-2 border border-gray-300 rounded text-sm bg-white" 
                        value={item.expectedDimensions || ''} onChange={e => updateItem(index, 'expectedDimensions', e.target.value)} />
                    </div>
                    <div className="col-span-6 md:col-span-4">
                      <input type="text" placeholder="Material (e.g. Teak, MDF)" className="w-full p-2 border border-gray-300 rounded text-sm bg-white" 
                        value={item.materialPreference || ''} onChange={e => updateItem(index, 'materialPreference', e.target.value)} />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <input required type="number" min="1" placeholder="Qty" className="w-full p-2 border border-gray-300 rounded text-sm bg-white" 
                        value={item.quantity || ''} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} />
                    </div>
                    <div className="col-span-8 md:col-span-2">
                       <input type="number" placeholder="Target Price" className="w-full p-2 border border-gray-300 rounded text-sm bg-white" 
                        value={item.unitPrice || ''} onChange={e => updateItem(index, 'unitPrice', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              ))}
              {(!formData.items || formData.items.length === 0) && (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400">
                  No items added yet. Click "+ Add Requirement" to begin.
                </div>
              )}
            </div>
          </section>

          <div className="pt-4 flex justify-end gap-3 border-t mt-8 pb-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors active:scale-95 text-sm font-medium">Cancel</button>
            <button disabled={isSaving} type="submit" className="px-4 py-2 bg-[#ff7f11] text-white rounded-md hover:bg-[#e06d0b] transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2 text-sm font-bold">
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Enquiry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
