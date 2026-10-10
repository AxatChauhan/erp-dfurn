'use client';
import { LogOut } from 'lucide-react';

export default function LogoutButton() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <button onClick={handleLogout} title="Log out" className="text-gray-400 hover:text-red-500 ml-2 transition-colors">
      <LogOut size={16} />
    </button>
  );
}
