'use client';
import { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import Link from 'next/link';

type ERPUser = { id: string; name: string; username: string; role: string; };

export default function UsersPage() {
  const [users, setUsers] = useState<ERPUser[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data);
    setIsLoading(false);
  };

  const optimisticUpdate = (u: ERPUser) => {
    setUsers([...users, u]);
  };

  return (
    <div className="max-w-7xl mx-auto">
      
      <div className="mb-6 grid grid-cols-4 gap-4 animate-slide-up stagger-1">
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">TOTAL USERS</div>
          <div className="text-3xl font-bold text-gray-900">{users.length}</div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">ACTIVE ROLES</div>
          <div className="text-3xl font-bold text-gray-900">{new Set(users.map(u => u.role)).size}</div>
        </div>
      </div>

      <div className="flex justify-end mb-4 animate-slide-up stagger-2">
        <button onClick={() => setIsFormOpen(true)} className="text-sm font-bold bg-[#ff7f11] hover:bg-[#e06d0b] text-white px-5 py-2.5 rounded shadow-sm transition-colors flex items-center gap-1">
          + New User
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-2 animate-slide-up stagger-2">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Username</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0 animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                  <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-24"></div></td>
                </tr>
              ))
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{u.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.username}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ₹{u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <UserForm onClose={() => setIsFormOpen(false)} onSuccess={() => { fetchUsers(); setIsFormOpen(false); }} optimisticUpdate={optimisticUpdate} />
      )}
    </div>
  );
}

function UserForm({ onClose, onSuccess, optimisticUpdate }: { onClose: () => void, onSuccess: () => void, optimisticUpdate: (u: ERPUser) => void }) {
  const [formData, setFormData] = useState({ name: '', username: '', password: '', role: 'SALES' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Optimistic Update
    const mockId = Math.random().toString(36).substring(7);
    optimisticUpdate({ ...formData, id: mockId } as ERPUser);
    onClose();

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full shadow-xl flex flex-col animate-slide-up">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">New User Account</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 font-bold text-xl transition-colors">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow focus:ring-2 outline-none"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow focus:ring-2 outline-none"
              value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input required type="password" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow focus:ring-2 outline-none"
              value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">System Role</label>
            <select required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border transition-shadow"
              value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
              <option value="SALES">Sales Rep</option>
              <option value="MANAGER">Manager</option>
              <option value="INVENTORY">Inventory Admin</option>
              <option value="FINANCE">Finance Dept</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t mt-8">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors active:scale-95">Cancel</button>
            <button disabled={isSaving} type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2">
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {isSaving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
