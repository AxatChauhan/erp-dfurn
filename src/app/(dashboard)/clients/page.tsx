'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  CreditCard, 
  Download, 
  Edit2, 
  FileSpreadsheet, 
  Globe, 
  HelpCircle, 
  Loader2, 
  MessageCircle, 
  Phone, 
  Plus, 
  Search, 
  ShieldAlert, 
  Trash2, 
  Upload, 
  User, 
  X 
} from 'lucide-react';
import { analyzeGstin, COMMON_COUNTRIES, normalizePhoneNumber } from '@/lib/clientUtils';

type Address = {
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isBilling?: boolean;
  isShipping?: boolean;
};

type Client = {
  id: string;
  clientCode?: string;
  clientType: string;
  name: string;
  contactPerson?: string;
  emails: string[];
  phones: string[];
  addresses: Address[];
  sourceCategory?: string;
  sourceName?: string;
  taxId?: string;
  pan?: string;
  state?: string;
  country?: string;
  paymentTerms?: string;
  creditLimit?: number;
  outstandingBalance?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      if (Array.isArray(data)) {
        setClients(data.map((c: any) => ({
          ...c,
          emails: Array.isArray(c.emails) ? c.emails : [],
          phones: Array.isArray(c.phones) ? c.phones : [],
          addresses: Array.isArray(c.addresses) ? c.addresses : []
        })));
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForm = (client: Client | null = null) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setEditingClient(null);
    setIsFormOpen(false);
  };

  const optimisticUpdate = (client: Client) => {
    if (editingClient) {
      setClients(clients.map(c => c.id === client.id ? client : c));
    } else {
      setClients([client, ...clients]);
    }
  };

  // Aggregated Analytics
  const analytics = useMemo(() => {
    const total = clients.length;
    const businessCount = clients.filter(c => c.clientType === 'BUSINESS').length;
    const individualCount = clients.filter(c => c.clientType === 'INDIVIDUAL').length;
    const gstinCount = clients.filter(c => !!c.taxId).length;
    const totalOutstanding = clients.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
    const atRiskCount = clients.filter(c => (c.outstandingBalance || 0) > (c.creditLimit || 0) && (c.outstandingBalance || 0) > 0).length;

    return {
      total,
      businessCount,
      individualCount,
      gstinCount,
      totalOutstanding,
      atRiskCount
    };
  }, [clients]);

  // Filtered Client List
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        c.name.toLowerCase().includes(q) ||
        (c.clientCode && c.clientCode.toLowerCase().includes(q)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
        (c.taxId && c.taxId.toLowerCase().includes(q)) ||
        (c.emails && c.emails.some(e => e.toLowerCase().includes(q))) ||
        (c.phones && c.phones.some(p => p.includes(q)));

      const matchesType = typeFilter === 'ALL' || c.clientType === typeFilter;

      let matchesRisk = true;
      if (riskFilter === 'OVERDUE') {
        matchesRisk = (c.outstandingBalance || 0) > 0;
      } else if (riskFilter === 'AT_RISK') {
        matchesRisk = (c.outstandingBalance || 0) > (c.creditLimit || 0) && (c.outstandingBalance || 0) > 0;
      }

      return matchesSearch && matchesType && matchesRisk;
    });
  }, [clients, searchQuery, typeFilter, riskFilter]);

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* 1. TOP METRICS STRIP */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 animate-slide-up">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:border-gray-200 transition-all">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Total Clients</span>
            <Building2 size={16} className="text-gray-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{analytics.total}</div>
          <div className="text-[11px] text-gray-500 mt-1">
            <span className="text-blue-600 font-semibold">{analytics.businessCount} B2B</span> · {analytics.individualCount} B2C
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:border-gray-200 transition-all">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>GST Verified</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{analytics.gstinCount}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {analytics.total ? Math.round((analytics.gstinCount / analytics.total) * 100) : 0}% compliant
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:border-gray-200 transition-all">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Outstanding Dues</span>
            <CreditCard size={16} className="text-orange-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{analytics.totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Total credit exposure</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:border-gray-200 transition-all">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Credit Risk</span>
            <ShieldAlert size={16} className={analytics.atRiskCount > 0 ? "text-red-500" : "text-gray-400"} />
          </div>
          <div className={`text-2xl font-black ${analytics.atRiskCount > 0 ? "text-red-600" : "text-slate-900"}`}>
            {analytics.atRiskCount}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {analytics.atRiskCount > 0 ? "Over credit limit" : "All accounts healthy"}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:border-gray-200 transition-all col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Quick Import</span>
            <FileSpreadsheet size={16} className="text-indigo-500" />
          </div>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="w-full mt-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Upload size={14} /> Import CSV
          </button>
        </div>
      </div>

      {/* 2. SEARCH, FILTERS & PRIMARY ACTIONS */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search code (DF_CL_001), name, phone, GSTIN..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-sm cursor-pointer font-medium text-slate-700"
          >
            <option value="ALL">All Client Types</option>
            <option value="BUSINESS">Business (B2B)</option>
            <option value="INDIVIDUAL">Individual (B2C)</option>
          </select>

          <select 
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-sm cursor-pointer font-medium text-slate-700"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="OVERDUE">Has Dues (&gt; ₹0)</option>
            <option value="AT_RISK">Over Credit Limit ⚠️</option>
          </select>
        </div>

        <button 
          onClick={() => handleOpenForm(null)} 
          className="text-sm font-bold bg-[#ff7f11] hover:bg-[#e06d0b] text-white px-5 py-2.5 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
        >
          <Plus size={16} /> New Client
        </button>
      </div>

      {/* 3. CLIENTS DATA TABLE */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center animate-pulse">
          <Loader2 size={28} className="animate-spin text-orange-500 mx-auto mb-2" />
          <div className="text-sm text-gray-500">Loading client directory...</div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Building2 size={24} />
          </div>
          <div className="text-base font-bold text-slate-900 mb-1">No clients found</div>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
            {searchQuery ? `No results match your search "${searchQuery}".` : "You haven't added any clients yet."}
          </p>
          <button 
            onClick={() => handleOpenForm(null)}
            className="text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1"
          >
            <Plus size={14} /> Add First Client
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Client Identity</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type & Origin</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact & WhatsApp</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tax & Location</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Financial Risk</th>
                  <th className="px-5 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {filteredClients.map((client) => {
                  const isAtRisk = (client.outstandingBalance || 0) > (client.creditLimit || 0) && (client.outstandingBalance || 0) > 0;
                  const primaryPhone = client.phones?.[0];
                  const cleanPhoneForWa = primaryPhone ? primaryPhone.replace(/[^\d]/g, '') : null;

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Identity */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                            {client.clientCode || 'NO-CODE'}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{client.name}</span>
                        </div>
                        {client.contactPerson && (
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <User size={12} className="text-gray-400" /> {client.contactPerson}
                          </div>
                        )}
                        {client.pan && (
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">PAN: {client.pan}</div>
                        )}
                      </td>

                      {/* Type & Origin */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${client.clientType === 'BUSINESS' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                            {client.clientType === 'BUSINESS' ? 'B2B Business' : 'B2C Individual'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {client.sourceCategory ? client.sourceCategory.replace(/_/g, ' ') : 'Direct'}
                          {client.sourceName && ` (${client.sourceName})`}
                        </div>
                      </td>

                      {/* Contact & WhatsApp */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {primaryPhone ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{primaryPhone}</span>
                            {cleanPhoneForWa && (
                              <a 
                                href={`https://wa.me/${cleanPhoneForWa}`} 
                                target="_blank" 
                                rel="noreferrer"
                                title="Chat on WhatsApp"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-1 rounded transition-colors"
                              >
                                <MessageCircle size={15} />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No phone logged</span>
                        )}
                        {client.emails?.[0] && (
                          <div className="text-xs text-gray-500 mt-0.5">{client.emails[0]}</div>
                        )}
                      </td>

                      {/* Tax & Location */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {client.taxId ? (
                          <div className="flex items-center gap-1 text-xs font-mono font-medium text-slate-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                            {client.taxId}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">Unregistered</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {client.state ? `${client.state}, ` : ''}{client.country || 'IN'}
                        </div>
                      </td>

                      {/* Financial Risk */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${client.outstandingBalance ? "text-red-600" : "text-slate-800"}`}>
                            ₹{(client.outstandingBalance || 0).toLocaleString('en-IN')}
                          </span>
                          {isAtRisk && (
                            <span title="Over Credit Limit!" className="px-1.5 py-0.2 bg-red-100 text-red-700 text-[10px] font-black rounded">
                              EXCEEDED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Limit: ₹{(client.creditLimit || 0).toLocaleString('en-IN')}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right text-sm">
                        <button 
                          onClick={() => handleOpenForm(client)} 
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1 active:scale-95"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CLIENT CREATION / EDIT DRAWER */}
      {isFormOpen && (
        <ClientFormDrawer 
          client={editingClient} 
          onClose={handleCloseForm} 
          onSuccess={() => { fetchClients(); handleCloseForm(); }} 
          optimisticUpdate={optimisticUpdate}
        />
      )}

      {/* 5. CSV BULK IMPORT MODAL */}
      {isImportModalOpen && (
        <CsvImportModal 
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => { fetchClients(); setIsImportModalOpen(false); }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// CLIENT FORM DRAWER (Ergonomic, High Contrast, Auto-Validation)
// -------------------------------------------------------------
function ClientFormDrawer({ 
  client, 
  onClose, 
  onSuccess, 
  optimisticUpdate 
}: { 
  client: Client | null; 
  onClose: () => void; 
  onSuccess: () => void; 
  optimisticUpdate: (c: Client) => void;
}) {
  const [formData, setFormData] = useState<Partial<Client>>(client || {
    name: '',
    clientType: 'BUSINESS',
    contactPerson: '',
    phones: [''],
    emails: [''],
    addresses: [{ label: 'Main Office', street: '', city: '', state: '', zip: '', isBilling: true, isShipping: true }],
    sourceCategory: 'DIRECT_ENQUIRY',
    sourceName: '',
    taxId: '',
    pan: '',
    state: '',
    country: 'IN',
    paymentTerms: '',
    creditLimit: 0,
    outstandingBalance: 0
  });

  const [countryDial, setCountryDial] = useState('+91');
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [gstinStatus, setGstinStatus] = useState<{ isValid?: boolean; stateName?: string; pan?: string; error?: string } | null>(null);

  // Auto-analyze GSTIN as user types
  const handleGstinChange = (raw: string) => {
    const val = raw.toUpperCase().trim();
    setFormData(prev => ({ ...prev, taxId: val }));

    if (val.length === 15) {
      const res = analyzeGstin(val);
      setGstinStatus(res);
      if (res.isValid) {
        setFormData(prev => ({
          ...prev,
          taxId: val,
          pan: res.pan || prev.pan,
          state: res.stateName || prev.state
        }));
      }
    } else {
      setGstinStatus(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent, ignoreDuplicatePhone = false) => {
    e.preventDefault();
    setIsSaving(true);
    setDuplicateWarning(null);

    // Clean data
    const cleanPhones = (formData.phones || []).map(p => p.trim()).filter(Boolean);
    const cleanEmails = (formData.emails || []).map(e => e.trim()).filter(Boolean);

    const payload = {
      ...formData,
      phones: cleanPhones,
      emails: cleanEmails,
      ignoreDuplicatePhone
    };

    try {
      const url = client ? `/api/clients/${client.id}` : '/api/clients';
      const method = client ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();

      if (res.status === 409) {
        // Duplicate Phone Conflict
        setDuplicateWarning(resData.error || 'A client with this phone number already exists.');
        setIsSaving(false);
        return;
      }

      if (!res.ok) {
        throw new Error(resData.error || 'Failed to save client');
      }

      optimisticUpdate(resData);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Error saving client');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex justify-end z-50 animate-fade-in">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-slide-left overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/80">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {client ? `Edit Client (${client.clientCode || client.name})` : 'New Client Registration'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Quick numeric entry & factory billing setup</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* Duplicate Phone Alert Banner */}
          {duplicateWarning && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
              <ShieldAlert size={20} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 text-xs text-amber-900">
                <div className="font-bold mb-1">Duplicate Phone Detected!</div>
                <p>{duplicateWarning}</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={(e) => handleSubmit(e, true)}
                    className="px-3 py-1 bg-amber-600 text-white font-bold rounded text-xs hover:bg-amber-700 transition-colors"
                  >
                    Save Anyway (Allow Duplicate)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setDuplicateWarning(null)}
                    className="px-3 py-1 bg-white border border-amber-300 text-amber-800 font-bold rounded text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 1. IDENTITY & TYPE */}
          <section className="bg-slate-50/50 p-4 rounded-xl border border-gray-100">
            <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">1. Client Identity</div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Client Category</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 cursor-pointer flex-1 font-medium text-xs text-slate-800">
                    <input 
                      type="radio" 
                      name="clientType" 
                      value="BUSINESS" 
                      checked={formData.clientType === 'BUSINESS'} 
                      onChange={e => setFormData({...formData, clientType: e.target.value})} 
                      className="accent-orange-500" 
                    />
                    <span>B2B Business / Firm</span>
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 cursor-pointer flex-1 font-medium text-xs text-slate-800">
                    <input 
                      type="radio" 
                      name="clientType" 
                      value="INDIVIDUAL" 
                      checked={formData.clientType === 'INDIVIDUAL'} 
                      onChange={e => setFormData({...formData, clientType: e.target.value})} 
                      className="accent-orange-500" 
                    />
                    <span>B2C Individual Homeowner</span>
                  </label>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {formData.clientType === 'BUSINESS' ? 'Company Name *' : 'Full Name *'}
                </label>
                <input 
                  required 
                  type="text" 
                  placeholder={formData.clientType === 'BUSINESS' ? "e.g. Apex Architect Studio" : "e.g. Rajesh Sharma"}
                  className="w-full rounded-lg border-gray-200 p-2.5 border text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-gray-700 mb-1">Contact Person Name</label>
                <input 
                  type="text" 
                  placeholder="Primary representative name"
                  className="w-full rounded-lg border-gray-200 p-2.5 border text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none" 
                  value={formData.contactPerson || ''} 
                  onChange={e => setFormData({...formData, contactPerson: e.target.value})} 
                />
              </div>
            </div>
          </section>

          {/* 2. CONTACT CHANNELS */}
          <section className="bg-slate-50/50 p-4 rounded-xl border border-gray-100">
            <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">2. Phones & Emails</div>
            
            <div className="space-y-3">
              {/* Phone Rows */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone Numbers (for WhatsApp & SMS)</label>
                {(formData.phones || []).map((phone, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select 
                      value={countryDial}
                      onChange={(e) => setCountryDial(e.target.value)}
                      className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-2 font-mono text-slate-700 outline-none"
                    >
                      {COMMON_COUNTRIES.map(c => (
                        <option key={c.code} value={c.dial}>{c.flag} {c.dial}</option>
                      ))}
                    </select>
                    <input 
                      type="tel" 
                      placeholder="Mobile or office number..."
                      value={phone} 
                      onChange={e => {
                        const newPhones = [...(formData.phones || [])];
                        newPhones[i] = e.target.value;
                        setFormData({ ...formData, phones: newPhones });
                      }}
                      className="flex-1 rounded-lg border-gray-200 p-2 border text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none" 
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        const newPhones = [...(formData.phones || [])];
                        newPhones.splice(i, 1);
                        setFormData({ ...formData, phones: newPhones });
                      }}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={() => setFormData({ ...formData, phones: [...(formData.phones || []), ''] })}
                  className="text-xs text-orange-600 font-bold flex items-center gap-1 hover:text-orange-700 mt-1"
                >
                  <Plus size={13} /> Add Another Phone
                </button>
              </div>

              {/* Email Rows */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Email Addresses</label>
                {(formData.emails || []).map((email, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input 
                      type="email" 
                      placeholder="accounts@apex.com"
                      value={email} 
                      onChange={e => {
                        const newEmails = [...(formData.emails || [])];
                        newEmails[i] = e.target.value;
                        setFormData({ ...formData, emails: newEmails });
                      }}
                      className="flex-1 rounded-lg border-gray-200 p-2 border text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none" 
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        const newEmails = [...(formData.emails || [])];
                        newEmails.splice(i, 1);
                        setFormData({ ...formData, emails: newEmails });
                      }}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={() => setFormData({ ...formData, emails: [...(formData.emails || []), ''] })}
                  className="text-xs text-orange-600 font-bold flex items-center gap-1 hover:text-orange-700 mt-1"
                >
                  <Plus size={13} /> Add Another Email
                </button>
              </div>
            </div>
          </section>

          {/* 3. TAX & COMMERCIAL INTELLIGENCE */}
          <section className="bg-slate-50/50 p-4 rounded-xl border border-gray-100">
            <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">3. Tax & Financial Terms</div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>GSTIN (Auto-detects State & PAN)</span>
                  {gstinStatus?.isValid && (
                    <span className="text-[10px] text-emerald-600 font-black">VALID GSTIN ✓</span>
                  )}
                </label>
                <input 
                  type="text" 
                  maxLength={15}
                  placeholder="24XXXXX0000X1ZX"
                  value={formData.taxId || ''} 
                  onChange={e => handleGstinChange(e.target.value)}
                  className={`w-full rounded-lg border p-2.5 text-sm font-mono uppercase font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none ${gstinStatus?.isValid ? "border-emerald-300 bg-emerald-50/30" : "border-gray-200"}`} 
                />
                {gstinStatus?.error && (
                  <div className="text-[11px] text-amber-600 mt-1">{gstinStatus.error}</div>
                )}
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-gray-700 mb-1">PAN Number</label>
                <input 
                  type="text" 
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  value={formData.pan || ''} 
                  onChange={e => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border-gray-200 p-2.5 border text-sm font-mono uppercase font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none" 
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-gray-700 mb-1">Primary State (For GST Tax Type)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Gujarat, Maharashtra"
                  value={formData.state || ''} 
                  onChange={e => setFormData({ ...formData, state: e.target.value })}
                  className="w-full rounded-lg border-gray-200 p-2.5 border text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none" 
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-gray-700 mb-1">Credit Limit (₹)</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={formData.creditLimit || ''} 
                  onChange={e => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border-gray-200 p-2.5 border text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none" 
                />
              </div>
            </div>
          </section>

          {/* 4. ADDRESSES WITH BILLING / SHIPPING CHECK */}
          <section className="bg-slate-50/50 p-4 rounded-xl border border-gray-100">
            <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">4. Delivery & Billing Addresses</div>

            <div className="space-y-3">
              {(formData.addresses || []).map((addr, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-3.5 relative space-y-2.5 shadow-sm">
                  <div className="flex justify-between items-center">
                    <input 
                      type="text" 
                      placeholder="Address Label (e.g. Registered Office, Factory Site)" 
                      value={addr.label} 
                      onChange={e => {
                        const newAddresses = [...(formData.addresses || [])];
                        newAddresses[i].label = e.target.value;
                        setFormData({ ...formData, addresses: newAddresses });
                      }}
                      className="font-bold text-xs text-slate-900 border-b pb-0.5 outline-none focus:border-orange-500"
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        const newAddresses = [...(formData.addresses || [])];
                        newAddresses.splice(i, 1);
                        setFormData({ ...formData, addresses: newAddresses });
                      }}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <input 
                    type="text" 
                    placeholder="Street Address / Plot No / Area"
                    value={addr.street} 
                    onChange={e => {
                      const newAddresses = [...(formData.addresses || [])];
                      newAddresses[i].street = e.target.value;
                      setFormData({ ...formData, addresses: newAddresses });
                    }}
                    className="w-full rounded-lg border-gray-200 p-2 border text-xs font-medium outline-none focus:ring-1 focus:ring-orange-500"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <input 
                      type="text" 
                      placeholder="City"
                      value={addr.city} 
                      onChange={e => {
                        const newAddresses = [...(formData.addresses || [])];
                        newAddresses[i].city = e.target.value;
                        setFormData({ ...formData, addresses: newAddresses });
                      }}
                      className="rounded-lg border-gray-200 p-2 border text-xs font-medium outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="State"
                      value={addr.state} 
                      onChange={e => {
                        const newAddresses = [...(formData.addresses || [])];
                        newAddresses[i].state = e.target.value;
                        setFormData({ ...formData, addresses: newAddresses });
                      }}
                      className="rounded-lg border-gray-200 p-2 border text-xs font-medium outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="PIN Code"
                      value={addr.zip} 
                      onChange={e => {
                        const newAddresses = [...(formData.addresses || [])];
                        newAddresses[i].zip = e.target.value;
                        setFormData({ ...formData, addresses: newAddresses });
                      }}
                      className="rounded-lg border-gray-200 p-2 border text-xs font-medium outline-none"
                    />
                  </div>

                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={addr.isBilling !== false} 
                        onChange={e => {
                          const newAddresses = [...(formData.addresses || [])];
                          newAddresses[i].isBilling = e.target.checked;
                          setFormData({ ...formData, addresses: newAddresses });
                        }}
                        className="rounded text-orange-500 focus:ring-0" 
                      />
                      <span>Is Billing Address</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={addr.isShipping !== false} 
                        onChange={e => {
                          const newAddresses = [...(formData.addresses || [])];
                          newAddresses[i].isShipping = e.target.checked;
                          setFormData({ ...formData, addresses: newAddresses });
                        }}
                        className="rounded text-orange-500 focus:ring-0" 
                      />
                      <span>Is Site / Shipping Address</span>
                    </label>
                  </div>
                </div>
              ))}

              <button 
                type="button" 
                onClick={() => setFormData({ 
                  ...formData, 
                  addresses: [...(formData.addresses || []), { label: 'Site Address', street: '', city: '', state: '', zip: '', isBilling: false, isShipping: true }] 
                })}
                className="text-xs text-orange-600 font-bold flex items-center gap-1 hover:text-orange-700 mt-1"
              >
                <Plus size={13} /> Add Site / Delivery Address
              </button>
            </div>
          </section>

          {/* Footer Actions */}
          <div className="pt-4 flex justify-end gap-3 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button 
              disabled={isSaving} 
              type="submit" 
              className="px-5 py-2.5 bg-[#ff7f11] text-white rounded-lg hover:bg-[#e06d0b] transition-all font-bold text-xs flex items-center gap-2 active:scale-95 disabled:opacity-70 shadow-sm"
            >
              {isSaving && <Loader2 size={15} className="animate-spin" />}
              {isSaving ? 'Saving...' : (client ? 'Update Client' : 'Register Client')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CSV BULK IMPORT MODAL (Preview, Duplicate Filter & Quarantine)
// -------------------------------------------------------------
function CsvImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; skippedCount: number; skippedRows: any[] } | null>(null);

  const sampleCsv = `Name,Phone,Email,Client Type,GSTIN,City,State
Apex Architects,9876543210,contact@apex.com,BUSINESS,24AAAAA0000A1Z5,Ahmedabad,Gujarat
Sunita Mehta,9822334455,sunita@gmail.com,INDIVIDUAL,,Mumbai,Maharashtra`;

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setIsProcessing(true);
    setResult(null);

    try {
      // Parse CSV into rows
      const lines = csvText.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("CSV must have at least one header and one data row.");

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rows.push(rowObj);
      }

      const res = await fetch('/api/clients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setResult(data);
      if (data.importedCount > 0) {
        onSuccess();
      }
    } catch (err: any) {
      alert(err.message || 'Error processing import');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Bulk Client CSV Import</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 font-bold">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-xs text-gray-600">
            Paste your raw CSV text or export from Google Sheets below. Headers should include: 
            <span className="font-mono text-slate-800 font-bold"> Name, Phone, Email, Client Type, GSTIN, City, State</span>.
          </div>

          <textarea 
            rows={7}
            placeholder={sampleCsv}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full font-mono text-xs p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />

          <div className="flex items-center justify-between text-xs">
            <button 
              type="button" 
              onClick={() => setCsvText(sampleCsv)}
              className="text-indigo-600 font-bold hover:underline"
            >
              Load Sample Template
            </button>
            <span className="text-gray-400">Duplicates by phone are auto-quarantined</span>
          </div>

          {result && (
            <div className="p-4 bg-slate-50 border border-gray-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                <span className="text-emerald-700">✓ Successfully Imported: {result.importedCount}</span>
                <span className="text-amber-700">⚠️ Skipped / Duplicates: {result.skippedCount}</span>
              </div>
              {result.skippedRows.length > 0 && (
                <div className="max-h-24 overflow-y-auto text-[11px] text-gray-500 space-y-1">
                  {result.skippedRows.map((s, idx) => (
                    <div key={idx}>• Row {s.row}: {s.reason}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button 
              disabled={isProcessing || !csvText.trim()}
              onClick={handleImport}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 disabled:opacity-60 shadow-sm"
            >
              {isProcessing && <Loader2 size={14} className="animate-spin" />}
              {isProcessing ? 'Processing Import...' : 'Import Clients'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
