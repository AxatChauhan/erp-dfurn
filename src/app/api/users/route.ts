import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const _url = new URL(req.url);
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });
  // Strip passwords
  const safeUsers = users.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role }));
  return NextResponse.json(safeUsers);
}

export async function POST(req: Request) {
  const body = await req.json();
  const newUser = await prisma.user.create({
    data: {
      name: body.name,
      username: body.username,
      password: body.password, // Keep simple for now as requested
      role: body.role
    }
  });
  return NextResponse.json({ id: newUser.id, name: newUser.name, username: newUser.username, role: newUser.role });
}
