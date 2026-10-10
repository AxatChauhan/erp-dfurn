'use client';

import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';

export default function TopHeader({ userName }: { userName: string }) {
  const pathname = usePathname();
  
  let pageTitle = 'Dashboard';
  if (pathname.includes('/enquiries')) pageTitle = 'Enquiries';
  if (pathname.includes('/quotations')) pageTitle = 'Quotations';
  if (pathname.includes('/clients')) pageTitle = 'Clients';
  if (pathname.includes('/users')) pageTitle = 'Admin';

  const userInitials = userName.substring(0, 2).toUpperCase();

  return (
    <header className="h-[72px] flex items-center justify-between px-8 bg-[#f4f3ed] flex-shrink-0 border-b border-gray-200/50">
      <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">{pageTitle}</h1>
      
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-900 rounded-full text-white flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-white cursor-pointer hover:bg-gray-800 transition-colors">
          {userInitials === 'AD' ? 'SA' : userInitials}
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
