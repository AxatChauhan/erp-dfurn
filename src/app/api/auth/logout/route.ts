import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  const clearOptions = {
    path: '/',
    maxAge: 0,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
  res.cookies.set('auth_token', '', clearOptions);
  res.cookies.set('user_role', '', clearOptions);
  res.cookies.set('user_name', '', clearOptions);
  res.cookies.set('user_id', '', clearOptions);
  res.cookies.set('employee_id', '', clearOptions);
  res.cookies.delete('auth_token');
  res.cookies.delete('user_role');
  res.cookies.delete('user_name');
  res.cookies.delete('user_id');
  res.cookies.delete('employee_id');
  return res;
}
