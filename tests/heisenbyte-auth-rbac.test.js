const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function extractCookies(response) {
  const setCookie = response.headers.getSetCookie 
    ? response.headers.getSetCookie() 
    : [response.headers.get('set-cookie')].filter(Boolean);
  
  const cookieMap = {};
  for (const str of setCookie) {
    const parts = str.split(';')[0].split('=');
    if (parts.length >= 2) {
      cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  }
  return cookieMap;
}

function cookieHeader(cookieMap) {
  return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
}

describe('Phase 1: Authentication, Session & RBAC Boundaries', () => {

  test('AUTH-01: Super Admin login successfully returns SUPER_ADMIN role & session cookies', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.role, 'SUPER_ADMIN');

    const cookies = extractCookies(res);
    assert.ok(cookies.auth_token, 'auth_token cookie must be present');
    assert.equal(cookies.user_role, 'SUPER_ADMIN');
    assert.ok(cookies.user_id, 'user_id cookie must be present');

    // Verify session verification via /api/auth/me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: cookieHeader(cookies) }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.authenticated, true);
    assert.equal(meData.user.role, 'SUPER_ADMIN');
  });

  test('AUTH-02: Sales Rep login successfully returns SALES role & session cookies', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sales', password: 'sales123' })
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.role, 'SALES');

    const cookies = extractCookies(res);
    assert.ok(cookies.auth_token, 'auth_token cookie must be present');
    assert.equal(cookies.user_role, 'SALES');

    // Verify session verification via /api/auth/me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: cookieHeader(cookies) }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.authenticated, true);
    assert.equal(meData.user.role, 'SALES');
  });

  test('AUTH-03: Invalid credentials and malformed bodies reject with 400/401', async () => {
    // Bad password
    const res1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'WrongPassword999!' })
    });
    assert.equal(res1.status, 401);
    const data1 = await res1.json();
    assert.equal(data1.error, 'Invalid username or password');

    // Missing password
    const res2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin' })
    });
    assert.equal(res2.status, 400);

    // Empty username
    const res3 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '  ', password: '123' })
    });
    assert.equal(res3.status, 400);
  });

  test('AUTH-04: Route protection middleware rejects unauthenticated access', async () => {
    // Without auth_token, /clients should redirect to /login
    const res = await fetch(`${BASE_URL}/clients`, {
      redirect: 'manual'
    });
    // In Next.js middleware, unauthenticated redirect is 307
    assert.ok([307, 308, 302, 303].includes(res.status), `Expected redirect status, got ${res.status}`);
    const location = res.headers.get('location') || '';
    assert.ok(location.includes('/login'), `Expected redirect to /login, got ${location}`);
  });

  test('AUTH-05: Authenticated users accessing /login are redirected to /clients', async () => {
    const res = await fetch(`${BASE_URL}/login`, {
      headers: { Cookie: 'auth_token=token-sales' },
      redirect: 'manual'
    });
    assert.ok([307, 308, 302, 303].includes(res.status), `Expected redirect status, got ${res.status}`);
    const location = res.headers.get('location') || '';
    assert.ok(location.includes('/clients'), `Expected redirect to /clients, got ${location}`);
  });

  test('AUTH-06 (Vulnerability Probe): Tampering user_role cookie alters /api/auth/me response', async () => {
    // Probing whether server validates auth_token cryptographically or blindly trusts user_role cookie
    const tamperedCookies = {
      auth_token: 'token-fake-user',
      user_role: 'SUPER_ADMIN',
      user_name: 'Impersonated Admin',
      user_id: 'usr-fake'
    };

    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: cookieHeader(tamperedCookies) }
    });

    const data = await res.json();
    // Record finding: does /api/auth/me accept arbitrary user_role without cryptographic verification?
    assert.equal(data.authenticated, true);
    if (data.user && data.user.role === 'SUPER_ADMIN') {
      console.warn('⚠️ [ANOMALY DETECTED]: /api/auth/me trusts unauthenticated, unsigned user_role cookie!');
    }
  });

  test('AUTH-07: Logout clears authentication cookies', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST'
    });
    assert.equal(res.status, 200);
    const cookies = extractCookies(res);
    // auth_token should either be cleared or set with maxAge=0 / expired
    const rawSetCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
    const isCleared = rawSetCookie.some(c => c && (c.includes('auth_token=;') || c.includes('Max-Age=0') || c.includes('expires=')));
    assert.ok(isCleared, 'Logout must expire or clear session cookies');
  });
});
