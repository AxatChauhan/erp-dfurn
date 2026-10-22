import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';
import { MobileAppProvider } from './MobileAppContext';
import MobileTopBar from './components/MobileTopBar';
import MobileBottomNav from './components/MobileBottomNav';

export const instant = false;


export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const session = token ? await verifySessionToken(token) : null;
  const userName = session?.name || cookieStore.get('user_name')?.value || 'User';
  const role = session?.role || 'USER';

  return (
    <MobileAppProvider userRole={role} userName={userName}>
      <div className="h-full flex flex-col bg-[#F4F3ED] text-slate-800 antialiased">
        <MobileTopBar />
        <main className="flex-1 overflow-y-auto overscroll-contain pb-20 max-w-md mx-auto w-full px-3 pt-3">
          <Suspense
            fallback={
              <div className="p-8 text-center text-xs font-medium text-gray-400 animate-pulse">
                Loading D'furn Mobile App...
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
        <MobileBottomNav />
      </div>
    </MobileAppProvider>
  );
}
