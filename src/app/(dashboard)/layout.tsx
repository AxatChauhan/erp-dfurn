import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import NavigationProgressBar from './NavigationProgressBar';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';

export const instant = false;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const session = token ? await verifySessionToken(token) : null;
  const userName = session?.name || cookieStore.get('user_name')?.value || 'Unknown';
  const role = session?.role || 'USER';

  return (
    <div className="h-full flex w-full bg-[#f4f3ed]">
      <NavigationProgressBar />
      <Sidebar userRole={role} />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader userName={userName} />

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
