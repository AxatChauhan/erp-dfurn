'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HRMIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/hrm/employees');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Loading HRM Module...</p>
      </div>
    </div>
  );
}
