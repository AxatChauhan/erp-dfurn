'use client';
import { useState, useEffect } from 'react';
import { Edit2, Loader2, Plus, Trash2 } from 'lucide-react';

type Address = { label: string; street: string; city: string; state: string; zip: string; };

type Client = {
  id: string;
  clientType: string;
  name: string;
  contactPerson?: string;
  emails: string[];
  phones: string[];
  addresses: Address[];
  sourceCategory?: string;
  sourceName?: string;
  taxId?: string;
  paymentTerms?: string;
  creditLimit?: number;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    const res = await fetch('/api/clients');
    const data = await res.json();
    // Parse JSON fields if they come as strings, usually Next.js/Prisma returns them as parsed JSON objects (arrays)
    setClients(data.map((c: any) => ({
      ...c,
      emails: c.emails || [],
      phones: c.phones || [],
      addresses: c.addresses || []
    })));
    setIsLoading(false);
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

  const filteredClients = clients.filter(c => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(searchLower) || 
                          (c.contactPerson && c.contactPerson.toLowerCase().includes(searchLower)) ||
                          (c.emails && c.emails.some(e => e.toLowerCase().includes(searchLower))) ||
                          (c.phones && c.phones.some(p => p.includes(searchQuery)));
    const matchesType = typeFilter === 'ALL' || c.clientType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 grid grid-cols-5 gap-4 animate-slide-up stagger-1">
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">TOTAL CLIENTS</div>
          <div className="text-3xl font-bold text-gray-900">{clients.length}</div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">BUSINESS CLIENTS</div>
          <div className="text-3xl font-bold text-gray-900">{clients.filter(c => c.clientType === 'BUSINESS').length}</div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">INDIVIDUAL CLIENTS</div>
          <div className="text-3xl font-bold text-gray-900">{clients.filter(c => c.clientType === 'INDIVIDUAL').length}</div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">GSTIN ON FILE</div>
          <div className="text-3xl font-bold text-gray-900">{clients.filter(c => !!c.taxId).length}</div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">TOP SOURCE</div>
          <div className="text-3xl font-bold text-gray-900">
            {(() => {
              const sources = clients.map(c => c.sourceCategory).filter(Boolean);
              if (!sources.length) return '—';
              const counts = sources.reduce((acc, val) => ({...acc, [val as string]: (acc[val as string] || 0) + 1}), {} as Record<string, number>);
              return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b).replace('_', ' ');
            })()}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 animate-slide-up stagger-2">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input 
            type="text" 
            placeholder="Search clients..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
          />
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="BUSINESS">Business</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
        </div>
        <button onClick={() => handleOpenForm(null)} className="text-sm font-bold bg-[#ff7f11] hover:bg-[#e06d0b] text-white px-5 py-2.5 rounded shadow-sm transition-colors flex items-center gap-1 shrink-0">
          + New Client
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up stagger-3">
          <table className="min-w-full">
            <tbody className="bg-white">
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0 animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32 mb-2"></div><div className="h-3 bg-gray-100 rounded w-24"></div></td>
                  <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-40 mb-2"></div><div className="h-3 bg-gray-100 rounded w-24"></div></td>
                  <td className="px-6 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center animate-slide-up stagger-3">
          <div className="text-[#c3b6a2] text-sm">No Clients match your filters.</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up stagger-3">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Identity</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Source</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{client.name}</div>
                    {client.clientType === 'BUSINESS' && client.contactPerson && (
                      <div className="text-xs text-gray-500 mt-0.5">Contact: {client.contactPerson}</div>
                    )}
                    {client.taxId && <div className="text-xs text-gray-400 mt-0.5">GSTIN: {client.taxId}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-sm ${client.clientType === 'BUSINESS' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                      {client.clientType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.emails && client.emails.length > 0 && <div className="text-sm text-gray-900">{client.emails[0]} {client.emails.length > 1 && <span className="text-xs text-gray-400">(+{client.emails.length - 1})</span>}</div>}
                    {client.phones && client.phones.length > 0 && <div className="text-sm text-gray-500 mt-0.5">{client.phones[0]} {client.phones.length > 1 && <span className="text-xs text-gray-400">(+{client.phones.length - 1})</span>}</div>}
                    {(!client.emails?.length && !client.phones?.length) && <span className="text-xs text-gray-400">No contact info</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{client.sourceCategory?.replace('_', ' ') || 'N/A'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{client.sourceName || ''}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleOpenForm(client)} className="text-blue-600 hover:text-blue-900 transition-colors active:scale-95 inline-flex items-center">
                      <Edit2 size={16} className="mr-1" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <ClientForm 
          client={editingClient} 
          onClose={handleCloseForm} 
          onSuccess={() => { fetchClients(); handleCloseForm(); }} 
          optimisticUpdate={optimisticUpdate}
        />
      )}
    </div>
  );
}

function ClientForm({ client, onClose, onSuccess, optimisticUpdate }: { client: Client | null, onClose: () => void, onSuccess: () => void, optimisticUpdate: (c: Client) => void }) {
  const [formData, setFormData] = useState<Partial<Client>>(client || {
    name: '', contactPerson: '', emails: [''], phones: [''], addresses: [], clientType: 'BUSINESS', sourceCategory: '', sourceName: '', taxId: '', paymentTerms: '', creditLimit: 0
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Clean empty arrays
    const payload = {
      ...formData,
      emails: (formData.emails || []).filter(e => e.trim() !== ''),
      phones: (formData.phones || []).filter(p => p.trim() !== ''),
    };

    // Optimistic Update
    const mockId = client?.id || Math.random().toString();
    optimisticUpdate({ ...payload, id: mockId } as Client);
    onClose();

    const url = client ? `/api/clients/${client.id}` : '/api/clients';
    const method = client ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      onSuccess();
    } else {
      alert("Error saving client");
    }
  };

  const updateArray = (field: 'emails' | 'phones', index: number, value: string) => {
    const newArr = [...(formData[field] as string[])];
    newArr[index] = value;
    setFormData({ ...formData, [field]: newArr });
  };
  const addArrayItem = (field: 'emails' | 'phones') => {
    setFormData({ ...formData, [field]: [...(formData[field] as string[]), ''] });
  };
  const removeArrayItem = (field: 'emails' | 'phones', index: number) => {
    const newArr = [...(formData[field] as string[])];
    newArr.splice(index, 1);
    setFormData({ ...formData, [field]: newArr });
  };

  const addAddress = () => {
    setFormData({ ...formData, addresses: [...(formData.addresses || []), { label: 'Office', street: '', city: '', state: '', zip: '' }] });
  };
  const updateAddress = (index: number, field: keyof Address, value: string) => {
    const newAddresses = [...(formData.addresses || [])];
    newAddresses[index] = { ...newAddresses[index], [field]: value };
    setFormData({ ...formData, addresses: newAddresses });
  };
  const removeAddress = (index: number) => {
    const newAddresses = [...(formData.addresses || [])];
    newAddresses.splice(index, 1);
    setFormData({ ...formData, addresses: newAddresses });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-end z-50">
      <div className="bg-white w-full max-w-2xl h-full shadow-xl flex flex-col animate-slide-up">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">{client ? 'Edit Client' : 'New Client'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 font-bold text-xl transition-colors">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-8">
          
          {/* 1. IDENTITY */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4 uppercase tracking-wider">1. Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="clientType" value="BUSINESS" checked={formData.clientType === 'BUSINESS'} onChange={e => setFormData({...formData, clientType: e.target.value})} className="accent-orange-500" />
                    <span className="text-sm font-medium text-gray-700">Business (B2B)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="clientType" value="INDIVIDUAL" checked={formData.clientType === 'INDIVIDUAL'} onChange={e => setFormData({...formData, clientType: e.target.value})} className="accent-orange-500" />
                    <span className="text-sm font-medium text-gray-700">Individual (B2C)</span>
                  </label>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">{formData.clientType === 'BUSINESS' ? 'Company Name *' : 'Full Name *'}</label>
                <input required type="text" className="w-full rounded-md border-gray-300 p-2 border focus:ring-2 focus:ring-orange-500 outline-none text-sm" 
                  value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              {formData.clientType === 'BUSINESS' && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person Name</label>
                  <input type="text" className="w-full rounded-md border-gray-300 p-2 border focus:ring-2 focus:ring-orange-500 outline-none text-sm" 
                    value={formData.contactPerson || ''} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
                </div>
              )}
            </div>
          </section>

          {/* 2. CONTACT INFO */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4 uppercase tracking-wider">2. Contact Info</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Phones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Numbers</label>
                {(formData.phones || []).map((phone, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="tel" className="flex-1 rounded-md border-gray-300 p-2 border focus:ring-2 focus:ring-orange-500 outline-none text-sm" 
                      value={phone} onChange={e => updateArray('phones', i, e.target.value)} placeholder="+91..." />
                    <button type="button" onClick={() => removeArrayItem('phones', i)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => addArrayItem('phones')} className="text-sm text-orange-600 font-medium flex items-center gap-1 mt-1 hover:text-orange-700"><Plus size={14} /> Add Phone</button>
              </div>

              {/* Emails */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Addresses</label>
                {(formData.emails || []).map((email, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="email" className="flex-1 rounded-md border-gray-300 p-2 border focus:ring-2 focus:ring-orange-500 outline-none text-sm" 
                      value={email} onChange={e => updateArray('emails', i, e.target.value)} placeholder="contact@..." />
                    <button type="button" onClick={() => removeArrayItem('emails', i)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => addArrayItem('emails')} className="text-sm text-orange-600 font-medium flex items-center gap-1 mt-1 hover:text-orange-700"><Plus size={14} /> Add Email</button>
              </div>
            </div>

            {/* Addresses */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Addresses</label>
              {(formData.addresses || []).map((addr, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded p-4 mb-3 relative">
                  <button type="button" onClick={() => removeAddress(i)} className="absolute top-2 right-2 text-red-500 hover:bg-red-100 p-1.5 rounded"><Trash2 size={14} /></button>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <input type="text" placeholder="Label (e.g. Head Office, Billing)" value={addr.label} onChange={e => updateAddress(i, 'label', e.target.value)} className="w-full rounded border-gray-300 p-2 border text-sm" />
                    </div>
                    <div className="col-span-2">
                      <input type="text" placeholder="Street Address" value={addr.street} onChange={e => updateAddress(i, 'street', e.target.value)} className="w-full rounded border-gray-300 p-2 border text-sm" />
                    </div>
                    <div>
                      <input type="text" placeholder="City" value={addr.city} onChange={e => updateAddress(i, 'city', e.target.value)} className="w-full rounded border-gray-300 p-2 border text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <input type="text" placeholder="State" value={addr.state} onChange={e => updateAddress(i, 'state', e.target.value)} className="w-1/2 rounded border-gray-300 p-2 border text-sm" />
                      <input type="text" placeholder="PIN/ZIP" value={addr.zip} onChange={e => updateAddress(i, 'zip', e.target.value)} className="w-1/2 rounded border-gray-300 p-2 border text-sm" />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addAddress} className="text-sm text-orange-600 font-medium flex items-center gap-1 hover:text-orange-700"><Plus size={14} /> Add Address</button>
            </div>
          </section>

          {/* 3. SOURCE & TAX */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4 uppercase tracking-wider">3. Origin & Tax Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Category</label>
                <select className="w-full rounded-md border-gray-300 p-2 border focus:ring-2 focus:ring-orange-500 outline-none text-sm"
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
              <div className="col-span-2 mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                <input type="text" placeholder="24XXXXX0000X1ZX" className="w-full rounded-md border-gray-300 p-2 border font-mono uppercase focus:ring-2 focus:ring-orange-500 outline-none text-sm" 
                  value={formData.taxId || ''} onChange={e => setFormData({...formData, taxId: e.target.value.toUpperCase()})} />
              </div>
            </div>
          </section>
          
          <div className="pt-4 flex justify-end gap-3 border-t mt-8 pb-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors active:scale-95 text-sm font-medium">Cancel</button>
            <button disabled={isSaving} type="submit" className="px-4 py-2 bg-[#ff7f11] text-white rounded-md hover:bg-[#e06d0b] transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2 text-sm font-bold">
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
