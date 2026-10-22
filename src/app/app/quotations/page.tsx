import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { fetchQuotationsData } from '@/app/api/quotations/route';
import { getAuthenticatedSession } from '@/lib/auth';
import MobileQuotationsClient from './MobileQuotationsClient';

export const instant = false;


function MobileQuotationsLoadingSkeleton() {
  return (
    <div className="space-y-3 p-1 animate-pulse">
      <div className="h-10 bg-gray-200/80 rounded-xl" />
      <div className="flex gap-2 overflow-x-hidden pt-1">
        <div className="h-7 w-14 bg-gray-200/80 rounded-full" />
        <div className="h-7 w-16 bg-gray-200/80 rounded-full" />
        <div className="h-7 w-20 bg-gray-200/80 rounded-full" />
        <div className="h-7 w-16 bg-gray-200/80 rounded-full" />
      </div>
      <div className="space-y-3 pt-2">
        <div className="h-28 bg-white rounded-2xl border border-gray-200/80 shadow-2xs" />
        <div className="h-28 bg-white rounded-2xl border border-gray-200/80 shadow-2xs" />
        <div className="h-28 bg-white rounded-2xl border border-gray-200/80 shadow-2xs" />
      </div>
    </div>
  );
}

async function MobileQuotationsDataLoader() {
  await connection();
  const session = await getAuthenticatedSession();

  // Mobile App View-Only Mode: All authenticated users can view the full quotations pipeline
  const data = await fetchQuotationsData({});

  return (
    <MobileQuotationsClient
      initialQuotations={data.quotations}
      salespersons={data.salespersons}
      userRole={session?.role || 'USER'}
    />
  );
}

export default function MobileQuotationsPage() {
  return (
    <Suspense fallback={<MobileQuotationsLoadingSkeleton />}>
      <MobileQuotationsDataLoader />
    </Suspense>
  );
}
