import ClientsClient from './ClientsClient';
import { fetchClientsData } from '@/app/api/clients/route';

export default async function ClientsPage({
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
