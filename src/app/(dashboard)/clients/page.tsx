'use client';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Loader2 } from 'lucide-react';
import Link from 'next/link';

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  clientType: string;
  taxId: string | null;
  paymentTerms: string | null;
  creditLimit: number;
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
    setClients(data);
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
      setClients([...clients, client]);
    }
  };

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (c.phone && c.phone.includes(searchQuery));
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
          <div className="text-3xl font-bold text-gray-900">{clients.filter(c => c.clientType === 'COMPANY').length}</div>
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
          <div className="text-3xl font-bold text-gray-900">—</div>
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
            <option value="COMPANY">Company</option>
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
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{client.name}</div>
                    <div className="text-sm text-gray-500">Tax ID: {client.taxId || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${client.clientType === 'COMPANY' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {client.clientType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{client.email || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{client.phone || 'N/A'}</div>
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
  const [formData, setFormData] = useState(client || {
    name: '', email: '', phone: '', clientType: 'COMPANY', taxId: '', paymentTerms: '', creditLimit: 0
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Optimistic Update
    const mockId = client?.id || Math.random().toString();
    optimisticUpdate({ ...formData, id: mockId } as Client);
    onClose();

    const url = client ? `/api/clients/${client.id}` : '/api/clients';
    const method = client ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      onSuccess();
    } else {
      alert("Error saving client");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full shadow-xl flex flex-col animate-slide-up">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">{client ? 'Edit Client' : 'New Client'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 font-bold text-xl transition-colors">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Client Type</label>
            <select 
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border transition-shadow"
              value={formData.clientType}
              onChange={e => setFormData({...formData, clientType: e.target.value})}
            >
              <option value="COMPANY">Company</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow focus:ring-2 outline-none" 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow focus:ring-2 outline-none" 
              value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input required type="tel" pattern="^[0-9+\-\s()]{7,20}$" title="Valid phone number (digits, +, -, spaces)" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow focus:ring-2 outline-none" 
              value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tax ID</label>
            <input type="text" pattern="^[A-Za-z0-9\-\s]{5,20}$" title="Valid Tax ID (alphanumeric, 5-20 characters)" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow focus:ring-2 outline-none" 
              value={formData.taxId || ''} onChange={e => setFormData({...formData, taxId: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Terms</label>
            <input type="text" placeholder="e.g., Net 30" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow focus:ring-2 outline-none" 
              value={formData.paymentTerms || ''} onChange={e => setFormData({...formData, paymentTerms: e.target.value})} />
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t mt-8">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors active:scale-95">Cancel</button>
            <button disabled={isSaving} type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2">
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
