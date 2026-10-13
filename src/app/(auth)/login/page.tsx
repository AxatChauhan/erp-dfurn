'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
      <div className="hidden md:flex w-1/2 bg-slate-900 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Subtle decorative brand glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="bg-white rounded-2xl shadow-xl p-10 flex flex-col items-center justify-center mb-8 w-full max-w-sm border border-slate-100 z-10">
          <img src="/logo.png" alt="d'furn" className="h-14 object-contain" />
          <span className="text-[11px] font-bold text-gray-400 tracking-[0.25em] uppercase mt-2">
            ERP System
          </span>
          <div className="mt-4 px-3.5 py-1 bg-orange-50 border border-orange-200 rounded-full text-xs font-bold text-orange-600">
            DFurn Modular Systems
          </div>
        </div>
        <p className="text-slate-400 text-center max-w-sm text-sm font-medium leading-relaxed z-10">
          The enterprise platform powering modular manufacturing, sales pipeline, and connected operations.
        </p>
      </div>

      {/* RIGHT SIDE - LOGIN FORM */}
      <div className="w-full md:w-1/2 bg-[#f4f3ed] flex flex-col items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="flex flex-col items-center mb-6">
              <img src="/logo.png" alt="d'furn" className="h-10 object-contain" />
              <span className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase mt-1">
                ERP System
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in to your workspace</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">Enter your credentials to continue</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-xl border border-red-200 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Username</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:border-[#ff7700] focus:outline-none text-sm font-semibold text-slate-900 transition-colors"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Password</label>
              <input 
                required 
                type="password" 
                className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:border-[#ff7700] focus:outline-none text-sm font-semibold text-slate-900 transition-colors"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={isSigningIn}
              className="w-full bg-[#ff7700] hover:bg-[#e06900] active:scale-[0.99] text-white font-bold py-3 rounded-xl transition-all mt-3 shadow-xs hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 text-sm"
            >
              {isSigningIn ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/80 border-t-transparent animate-spin"></div>
                  <span>Signing in...</span>
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
