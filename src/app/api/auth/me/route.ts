import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedSession } from '@/lib/auth';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get('auth_token')?.value;

  if (!rawToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // 1. Verify cryptographic session token
  const session = await getAuthenticatedSession(req);

  if (session) {
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        name: session.name,
        role: session.role,
      },
    });
  }

  // 2. If token is invalid or unverified, NEVER trust unsigned client cookies for elevated roles
  const name = cookieStore.get('user_name')?.value || null;
  const id = cookieStore.get('user_id')?.value || null;

  return NextResponse.json({
    authenticated: true,
    user: {
      id: id,
      name: name,
      role: 'USER', // Defend against privilege escalation: never reflect untrusted SUPER_ADMIN cookie
    },
  });
}
