import { Suspense } from 'react';
import { connection } from 'next/server';
import QuotationsClient from './QuotationsClient';
import { fetchQuotationsData } from '@/app/api/quotations/route';

async function QuotationsDataLoader({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await connection();
  const params = await searchParams;

  const data = await fetchQuotationsData({
    search: params.search || null,
    status: params.status || null,
    fy: params.fy || null,
    month: params.month || null,
    date: params.date || null,
    salespersonId: params.salespersonId || null
  });

  return (
    <QuotationsClient
      initialQuotations={data.quotations}
      initialKpis={data.kpis}
      initialCounts={data.counts}
      salespersons={data.salespersons}
      waitingEnquiriesCount={data.waitingEnquiriesCount}
    />
  );
}

export default function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '40px', textAlign: 'center', color: '#8B8778', fontSize: 14 }}>
          Loading quotations...
        </div>
      }
    >
      <QuotationsDataLoader searchParams={searchParams} />
    </Suspense>
  );
}
