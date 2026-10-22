import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export const instant = false;

export default async function Home() {
  const reqHeaders = await headers();
  const ua = reqHeaders.get('user-agent') || '';
  const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);

  if (isMobile) {
    redirect('/app/enquiries');
  }

  redirect('/clients');
}
