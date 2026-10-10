'use client';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Loader2 } from 'lucide-react';
import Link from 'next/link';

type Client = {
  id: string;
  name: string;
};

type EnquiryItem = { id: string; description: string; quantity: number; unitPrice: number; total: number; };

type Enquiry = {
  id: string;
  enquiryNumber: string;
  clientId: string;
  clientName: string;
  rating: string;
  notes: string;
  items: EnquiryItem[];
  createdAt: string;
};

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [viewingEnquiry, setViewingEnquiry] = useState<Enquiry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('ALL');

  useEffect(() => {
    fetchEnquiries();
    fetchClients();
  }, []);

  const fetchEnquiries = async () => {
    setIsLoading(true);
    const res = await fetch('/api/enquiries');
    const data = await res.json();
    setEnquiries(data);
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
  };

  const handleCloseForm = () => {
    setEditingEnquiry(null);
    setIsFormOpen(false);
  };

  const optimisticUpdate = (enquiry: Enquiry) => {
    if (editingEnquiry) {
      setEnquiries(enquiries.map(e => e.id === enquiry.id ? enquiry : e));
    } else {
      setEnquiries([...enquiries, enquiry]);
    }
  };

  const totalEnquiries = enquiries.length;
  const qualifiedEnquiries = enquiries.filter(e => e.rating === 'QUALIFIED').length;
  const qualificationRate = totalEnquiries > 0 ? Math.round((qualifiedEnquiries / totalEnquiries) * 100) : 0;
  
  const totalOpportunityValue = enquiries.reduce((sum, enq) => {
    const enqTotal = enq.items ? enq.items.reduce((itemSum, item) => itemSum + (item.total || 0), 0) : 0;
    return sum + enqTotal;
  }, 0);

  const filteredEnquiries = enquiries.filter(e => {
    const matchesSearch = e.enquiryNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (e.clientName && e.clientName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRating = ratingFilter === 'ALL' || e.rating === ratingFilter;
    return matchesSearch && matchesRating;
  });

  return (
    <div className="max-w-7xl mx-auto">
      
      <div className="mb-6 grid grid-cols-4 gap-4 animate-slide-up stagger-1">
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">QUALIFICATION RATE</div>
          <div className="text-3xl font-bold text-gray-900">{qualificationRate}%</div>
          <div className="text-xs text-gray-400 mt-2">{qualifiedEnquiries} of {totalEnquiries} enquiries qualified</div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">TOTAL OPPORTUNITY VALUE</div>
          <div className="text-3xl font-bold text-gray-900">₹{totalOpportunityValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">TOTAL ENQUIRIES</div>
          <div className="text-3xl font-bold text-gray-900">{totalEnquiries}</div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">HOT LEADS</div>
          <div className="text-3xl font-bold text-gray-900">{enquiries.filter(e => e.rating === 'HOT_LEAD').length}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 animate-slide-up stagger-2">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input 
            type="text" 
            placeholder="Search enquiries..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
          />
          <select 
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white cursor-pointer"
          >
            <option value="ALL">All Ratings</option>
            <option value="HOT_LEAD">Hot Lead</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="POOR_LEAD">Poor Lead</option>
          </select>
        </div>
        <button onClick={() => handleOpenForm(null)} className="text-sm font-bold bg-[#ff7f11] hover:bg-[#e06d0b] text-white px-5 py-2.5 rounded shadow-sm transition-colors flex items-center gap-1 shrink-0">
          + Quick Enquiry
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up stagger-3">
          <table className="min-w-full">
            <tbody className="bg-white">
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0 animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-40"></div></td>
                  <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-24"></div></td>
                  <td className="px-6 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filteredEnquiries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center animate-slide-up stagger-3">
          <div className="text-[#c3b6a2] text-sm">No Enquiries match your filters.</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up stagger-3">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Number</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredEnquiries.map((enq) => (
                <tr key={enq.id} onClick={() => setViewingEnquiry(enq)} className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {enq.enquiryNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {enq.clientName || 'Unknown Client'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ₹{enq.rating === 'HOT_LEAD' ? 'bg-red-100 text-red-800' : 
                        enq.rating === 'QUALIFIED' ? 'bg-green-100 text-green-800' : 
                        enq.rating === 'POOR_LEAD' ? 'bg-gray-100 text-gray-800' : 
                        'bg-blue-100 text-blue-800'}`}>
                      {enq.rating.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <span className="text-gray-400 font-bold hover:text-gray-600 transition-colors">View &rarr;</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <EnquiryForm 
          enquiry={editingEnquiry} 
          clients={clients}
          onClose={handleCloseForm} 
          onSuccess={() => { fetchEnquiries(); handleCloseForm(); }} 
          onClientCreated={() => fetchClients()}
          optimisticUpdate={optimisticUpdate}
        />
      )}

      {viewingEnquiry && (
        <EnquiryViewCard 
          enquiry={viewingEnquiry} 
          onClose={() => setViewingEnquiry(null)}
          onEdit={() => handleOpenForm(viewingEnquiry)}
        />
      )}
    </div>
  );
}

function EnquiryForm({ enquiry, clients, onClose, onSuccess, onClientCreated, optimisticUpdate }: { enquiry: Enquiry | null, clients: Client[], onClose: () => void, onSuccess: () => void, onClientCreated: () => void, optimisticUpdate: (e: Enquiry) => void }) {
  const [formData, setFormData] = useState(enquiry || {
    clientId: clients.length > 0 ? clients[0].id : '', 
    clientName: clients.length > 0 ? clients[0].name : '', 
    rating: 'NEW_LEAD', 
    notes: '',
    items: [{ id: Math.random().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }]
  });

  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      item.total = Number(item.quantity) * Number(item.unitPrice);
    }
    newItems[index] = item as EnquiryItem;
    setFormData({...formData, items: newItems});
  };

  const addItem = () => {
    setFormData({
      ...formData, 
      items: [...formData.items, { id: Math.random().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({...formData, items: newItems});
  };

  const handleQuickClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClientName, phone: newClientPhone, clientType: 'COMPANY' })
    });
    if (res.ok) {
      const createdClient = await res.json();
      setFormData({...formData, clientId: createdClient.id});
      setIsQuickClientOpen(false);
      onClientCreated();
    } else {
      alert("Error creating client");
    }
  };

  const grandTotal = formData.items.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const selectedClient = clients.find(c => c.id === formData.clientId);
    const dataToSubmit = { ...formData, clientName: selectedClient?.name || '' };

    // Optimistic Update
    const mockId = enquiry?.id || Math.random().toString();
    optimisticUpdate({ 
      ...dataToSubmit, 
      id: mockId,
      enquiryNumber: enquiry?.enquiryNumber || 'ENQ-...'
    } as Enquiry);
    onClose();

    const url = enquiry ? `/api/enquiries/${enquiry.id}` : '/api/enquiries';
    const method = enquiry ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSubmit)
    });

    if (res.ok) {
      onSuccess();
    } else {
      alert("Error saving enquiry");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full shadow-xl flex flex-col animate-slide-up">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">{enquiry ? 'Edit Enquiry' : 'New Enquiry'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 font-bold text-xl transition-colors">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          <div>
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">Client</label>
              {!isQuickClientOpen && (
                <button type="button" onClick={() => setIsQuickClientOpen(true)} className="text-xs text-blue-600 hover:text-blue-800">
                  + Create New Client
                </button>
              )}
            </div>
            
            {isQuickClientOpen ? (
              <div className="mt-2 p-4 border border-blue-100 bg-blue-50 rounded-md">
                <h3 className="text-sm font-semibold mb-2 text-blue-900">Quick Add Client</h3>
                <input required type="text" placeholder="Company / Name" className="w-full mb-2 p-2 border rounded text-sm" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                <input required type="tel" pattern="^[0-9+\-\s()]{7,20}$" placeholder="Phone Number" className="w-full mb-2 p-2 border rounded text-sm" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} />
                <div className="flex justify-end gap-2 mt-2">
                  <button type="button" onClick={() => setIsQuickClientOpen(false)} className="text-xs px-3 py-1 text-gray-600 border border-gray-300 rounded hover:bg-white">Cancel</button>
                  <button type="button" onClick={handleQuickClientSubmit} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save & Select</button>
                </div>
              </div>
            ) : (
              <select 
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                value={formData.clientId}
                onChange={e => setFormData({...formData, clientId: e.target.value})}
              >
                <option value="" disabled>Select a client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Lead Rating</label>
            <select 
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              value={formData.rating}
              onChange={e => setFormData({...formData, rating: e.target.value})}
            >
              <option value="NEW_LEAD">New Lead</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="HOT_LEAD">Hot Lead</option>
              <option value="POOR_LEAD">Poor Lead</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes / Requirements</label>
            <textarea 
              required
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border mb-4" 
              placeholder="What kind of furniture are they looking for?"
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Requested Items (Will port to Quotation)</label>
              <button type="button" onClick={addItem} className="text-xs bg-gray-100 px-3 py-1 rounded border hover:bg-gray-200">+ Add Item</button>
            </div>
            
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {formData.items.map((item, index) => (
                <div key={item.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded border">
                  <input required type="text" placeholder="Description" className="flex-1 p-2 text-sm border rounded"
                    value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} />
                  <input required type="number" min="1" placeholder="Qty" className="w-20 p-2 text-sm border rounded"
                    value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} />
                  <input required type="number" min="0" step="0.01" placeholder="Target Price" className="w-28 p-2 text-sm border rounded"
                    value={item.unitPrice} onChange={e => updateItem(index, 'unitPrice', Number(e.target.value))} />
                  <div className="w-24 text-right font-semibold text-sm">₹{item.total.toFixed(2)}</div>
                  <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 px-2 font-bold">&times;</button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-right text-lg font-bold text-gray-900 border-t pt-4">
              Estimated Total: ₹{grandTotal.toFixed(2)}
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t mt-8">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors active:scale-95">Cancel</button>
            <button disabled={isSaving} type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2">
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Enquiry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EnquiryViewCard({ enquiry, onClose, onEdit }: { enquiry: Enquiry, onClose: () => void, onEdit: () => void }) {
  const grandTotal = enquiry.items?.reduce((sum, item) => sum + item.total, 0) || 0;
  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl shadow-xl flex flex-col rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-slate-900">Enquiry Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl font-light">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-gray-100">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Enquiry Number</p>
              <p className="font-bold text-slate-900">{enquiry.enquiryNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Client</p>
              <p className="font-bold text-slate-900">{enquiry.clientName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Rating</p>
              <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full 
                    ₹{enquiry.rating === 'HOT_LEAD' ? 'bg-red-100 text-red-800' : 
                      enquiry.rating === 'QUALIFIED' ? 'bg-green-100 text-green-800' : 
                      enquiry.rating === 'POOR_LEAD' ? 'bg-gray-100 text-gray-800' : 
                      'bg-blue-100 text-blue-800'}`}>
                {enquiry.rating.replace('_', ' ')}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Date</p>
              <p className="font-bold text-slate-900">{new Date(enquiry.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="mb-8">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Notes</p>
            <p className="bg-white p-4 rounded-xl text-sm border border-gray-200 text-slate-700 leading-relaxed shadow-sm">{enquiry.notes}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-3">Requested Items</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-bold text-gray-500">Description</th>
                    <th className="px-4 py-3 font-bold text-gray-500 text-center">Qty</th>
                    <th className="px-4 py-3 font-bold text-gray-500 text-right">Target Price</th>
                    <th className="px-4 py-3 font-bold text-gray-500 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {enquiry.items?.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-800">{item.description}</td>
                      <td className="px-4 py-3 text-slate-800 text-center font-medium">{item.quantity}</td>
                      <td className="px-4 py-3 text-slate-600 text-right">₹{item.unitPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-900 font-bold text-right">₹{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!enquiry.items || enquiry.items.length === 0) && (
                     <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No items specified.</td></tr>
                  )}
                </tbody>
              </table>
              <div className="px-4 py-3 bg-slate-50 text-right font-black text-slate-900 text-lg border-t border-gray-200">
                Total: ₹{grandTotal.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full text-sm font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 shadow-sm hover:shadow">Close</button>
          <button onClick={() => { onClose(); onEdit(); }} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-full hover:bg-slate-800 flex items-center gap-2 shadow-sm hover:shadow"><Edit2 size={16} /> Edit Enquiry</button>
        </div>
      </div>
    </div>
  );
}
