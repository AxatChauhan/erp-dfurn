import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession, hashPassword } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });
  // Strip passwords
  const safeUsers = users.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role }));
  return NextResponse.json(safeUsers);
}

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  if (!body.username || !body.password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  const newUser = await prisma.user.create({
    data: {
      name: body.name || body.username,
      username: body.username.trim(),
      password: hashPassword(body.password),
      role: body.role || 'USER',
    },
  });
  return NextResponse.json({ id: newUser.id, name: newUser.name, username: newUser.username, role: newUser.role });
}
