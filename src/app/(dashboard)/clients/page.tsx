import { Suspense } from 'react';
import ClientsClient from './ClientsClient';
import ClientsLoading from './loading';
import { fetchClientsData } from '@/app/api/clients/route';

async function ClientsDataLoader({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;

  const data = await fetchClientsData({
    type: params.type || null,
    country: params.country || null,
    needsReview: params.needsReview === 'true',
    search: params.search || null,
    page: params.page || '1',
    limit: params.limit || '50',
  });

  return (
    <ClientsClient
      initialClients={data.clients}
      initialKpis={data.kpis}
      initialSourceCategories={data.sourceCategories}
      initialTotal={data.total}
      initialTotalPages={data.totalPages}
    />
  );
}

export default function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  return (
    <Suspense fallback={<ClientsLoading />}>
      <ClientsDataLoader searchParams={searchParams} />
    </Suspense>
  );
}
