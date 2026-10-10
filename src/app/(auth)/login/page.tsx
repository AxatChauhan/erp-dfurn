'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSigningIn(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      window.location.href = '/clients';
    } else {
      setError('Invalid username or password');
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* LEFT SIDE - BRANDING */}
      <div className="hidden md:flex w-1/2 bg-[#17253b] flex-col items-center justify-center p-12">
        <div className="bg-white rounded-xl shadow-lg p-10 flex items-center justify-center mb-8 h-64 w-[400px]">
          {/* Logo Placeholder */}
          <div className="flex items-center gap-2">
            <div className="flex text-orange-500 font-bold text-3xl">
              ✓ <span className="text-slate-800 ml-1">CONSCIOUS</span>
            </div>
          </div>
        </div>
        <p className="text-[#a0aab8] text-center max-w-sm text-[15px] leading-relaxed">
          The multi-tenant ERP platform powering conscious, connected manufacturing operations.
        </p>
      </div>

      {/* RIGHT SIDE - LOGIN FORM */}
      <div className="w-full md:w-1/2 bg-[#f4f3ed] flex flex-col items-center justify-center p-12">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-10">
            <div className="flex items-center text-orange-500 font-bold text-4xl mb-6">
              d'furn<sup className="text-xl mt-2 ml-0.5">®</sup>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Sign in to your workspace</h1>
            <p className="text-sm text-gray-400 mt-1">Enter your credentials to continue</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Username</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-2.5 bg-[#eef3fe] border border-blue-100/50 rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm text-gray-900"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Password</label>
              <input 
                required 
                type="password" 
                className="w-full px-4 py-2.5 bg-[#eef3fe] border border-blue-100/50 rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm text-gray-900"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={isSigningIn}
              className="w-full bg-[#e3d7c5] hover:bg-[#d6c5ae] text-white/90 font-bold py-3 rounded transition-colors mt-2 shadow-sm flex items-center justify-center gap-2"
            >
              {isSigningIn ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/80 border-t-transparent animate-spin"></div>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
