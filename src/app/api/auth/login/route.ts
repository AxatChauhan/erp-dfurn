import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const { username, password } = await req.json();

  // 1. Check database for user credentials
  let user = await prisma.user.findUnique({
    where: { username }
  });

  // Fallback bootstrap for default admin if not yet seeded
  if (!user && username === 'admin' && password === 'admin') {
    user = await prisma.user.create({
      data: {
        username: 'admin',
        name: 'Super Admin',
        password: 'admin',
        role: 'SUPER_ADMIN',
      }
    });
  }

  if (user && user.password === password) {
    const cookieStore = await cookies();
    cookieStore.set('auth_token', `token-${user.id}`, { httpOnly: true, path: '/' });
    cookieStore.set('user_role', user.role, { path: '/' });
    cookieStore.set('user_name', user.name, { path: '/' });
    cookieStore.set('user_id', user.id, { path: '/' });
    return NextResponse.json({ success: true, role: user.role, name: user.name, id: user.id });
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
