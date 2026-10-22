'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut, WifiOff } from 'lucide-react';
import { useMobileApp } from '../MobileAppContext';

export default function MobileTopBar() {
  const pathname = usePathname();
  const { userName, userRole } = useMobileApp();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    window.location.href = '/login';
  };

  const title = pathname.includes('/quotations') ? 'Quotations' : 'Enquiries';
  const initials = userName && userName.length >= 2 ? userName.substring(0, 2).toUpperCase() : 'DF';

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F5] border-b border-gray-200/80 px-4 py-3 flex items-center justify-between shadow-2xs backdrop-blur-md">
      {/* Brand & Module Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-xs">
          DF
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-gray-900 tracking-tight">D'FURN</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#FF7700] bg-orange-50 px-1.5 py-0.5 rounded">
              APP
            </span>
          </div>
          <span className="text-[11px] font-semibold text-gray-500 block leading-none">
            {title}
          </span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* User Badge */}
        <div 
          className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px] font-bold shadow-2xs"
          title={`${userName} (${userRole})`}
        >
          {initials}
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Offline Status Indicator Banner */}
      {!isOnline && (
        <div className="absolute top-full inset-x-0 bg-amber-500 text-white text-[11px] font-semibold py-1 px-3 text-center flex items-center justify-center gap-1.5 shadow-xs animate-in slide-in-from-top duration-150">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode · Cached pipeline view</span>
        </div>
      )}
    </header>
  );
}
