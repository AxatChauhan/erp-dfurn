import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import { cookies } from 'next/headers';

export const instant = false;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const userName = cookieStore.get('user_name')?.value || 'Unknown';
  const role = cookieStore.get('user_role')?.value || 'USER';

  return (
    <div className="h-full flex w-full bg-[#f4f3ed]">
      <Sidebar userRole={role} />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader userName={userName} />

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
