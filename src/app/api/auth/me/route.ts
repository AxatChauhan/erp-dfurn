import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const role = cookieStore.get('user_role')?.value;
  const name = cookieStore.get('user_name')?.value;
  const id = cookieStore.get('user_id')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: id || null,
      name: name || null,
      role: role || 'USER',
    },
  });
}
