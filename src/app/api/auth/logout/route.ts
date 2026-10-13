import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete('auth_token');
  res.cookies.delete('user_role');
  res.cookies.delete('user_name');
  res.cookies.delete('user_id');
  return res;
}
