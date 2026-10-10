import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (username === 'admin' && password === 'admin') {
    const cookieStore = await cookies();
    cookieStore.set('auth_token', 'admin-super-token', { httpOnly: true, path: '/' });
    cookieStore.set('user_role', 'SUPER_ADMIN', { path: '/' });
    cookieStore.set('user_name', 'Super Admin', { path: '/' });
    return NextResponse.json({ success: true, role: 'SUPER_ADMIN' });
  }

  // Check database
  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (user && user.password === password) {
    const cookieStore = await cookies();
    cookieStore.set('auth_token', `token-${user.id}`, { httpOnly: true, path: '/' });
    cookieStore.set('user_role', user.role, { path: '/' });
    cookieStore.set('user_name', user.name, { path: '/' });
    return NextResponse.json({ success: true, role: user.role });
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
