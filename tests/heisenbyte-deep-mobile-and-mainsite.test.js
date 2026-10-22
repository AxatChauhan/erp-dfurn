const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');

const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined);
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

describe('HeisenByte Deep Audit: Mobile App (/app) & Main Site', () => {
  let adminCookies = {};
  let adminCookieStr = '';
  let salesCookies = {};
  let salesCookieStr = '';

  before(async () => {
    // 1. Authenticate Super Admin
    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert.equal(adminLogin.status, 200);
    adminCookies = extractCookies(adminLogin);
    adminCookieStr = cookieHeader(adminCookies);

    // 2. Authenticate Sales Rep
    const salesLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sales', password: 'sales123' }),
    });
    assert.equal(salesLogin.status, 200);
    salesCookies = extractCookies(salesLogin);
    salesCookieStr = cookieHeader(salesCookies);
  });

  after(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // SECTION 1: PWA, MANIFEST, SERVICE WORKER & ASSETS
  // =========================================================================
  test('MOB-01: Manifest JSON serves valid JSON with start_url and icons', async () => {
    const res = await fetch(`${BASE_URL}/manifest.json`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.start_url, '/app/enquiries');
    assert.equal(data.display, 'standalone');
    assert.equal(data.theme_color, '#FF7700');
    assert.ok(Array.isArray(data.icons) && data.icons.length >= 2, 'Must provide 192px and 512px icons');
  });

  test('MOB-02: PWA Icons exist in /public directory', async () => {
    const icon192 = path.join(__dirname, '..', 'public', 'icon-192.png');
    const icon512 = path.join(__dirname, '..', 'public', 'icon-512.png');
    assert.ok(fs.existsSync(icon192), 'public/icon-192.png must exist');
    assert.ok(fs.existsSync(icon512), 'public/icon-512.png must exist');
  });

  test('MOB-03: Service Worker sw.js exists and responds with 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/sw.js`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const text = await res.text();
    assert.ok(text.includes('CACHE_NAME'), 'sw.js must declare cache name');
  });

  // =========================================================================
  // SECTION 2: ROUTE GUARDS & ACCESS CONTROL
  // =========================================================================
  test('MOB-04: Route protection middleware guards /app against unauthenticated access', async () => {
    const res1 = await fetch(`${BASE_URL}/app`, { redirect: 'manual' });
    assert.ok([307, 308, 302, 303].includes(res1.status), `Expected redirect, got ${res1.status}`);

    const res2 = await fetch(`${BASE_URL}/app/enquiries`, { redirect: 'manual' });
    assert.ok([307, 308, 302, 303].includes(res2.status), `Expected redirect, got ${res2.status}`);

    const res3 = await fetch(`${BASE_URL}/app/quotations`, { redirect: 'manual' });
    assert.ok([307, 308, 302, 303].includes(res3.status), `Expected redirect, got ${res3.status}`);
  });

  test('MOB-05: Authenticated users can load /app/enquiries and /app/quotations', async () => {
    const res1 = await fetch(`${BASE_URL}/app/enquiries`, {
      headers: { Cookie: salesCookieStr },
    });
    assert.equal(res1.status, 200);

    const res2 = await fetch(`${BASE_URL}/app/quotations`, {
      headers: { Cookie: salesCookieStr },
    });
    assert.equal(res2.status, 200);
  });

  // =========================================================================
  // SECTION 3: CODE AUDIT - PRISMA SCHEMA VS MOBILE COMPONENT MAPPING
  // =========================================================================
  test('MOB-06 (LOGICAL BUG VERIFIED & RESOLVED): MobileEnquiryCard schema field naming', () => {
    const cardFile = path.join(__dirname, '..', 'src', 'app', 'app', 'enquiries', 'components', 'MobileEnquiryCard.tsx');
    const content = fs.readFileSync(cardFile, 'utf8');

    // Verification 1: Supports DB opportunityValue / estimatedBudget
    assert.ok(
      content.includes('enquiry.opportunityValue') || content.includes('enquiry.estimatedBudget'),
      'MobileEnquiryCard must map Prisma opportunityValue / estimatedBudget'
    );

    // Verification 2: Supports DB enquiryNumber
    assert.ok(
      content.includes('enquiry.enquiryNumber'),
      'MobileEnquiryCard must map Prisma enquiryNumber'
    );
  });

  test('MOB-07 (LOGICAL BUG VERIFIED & RESOLVED): MobileEnquiryDetailSheet schema field naming', () => {
    const sheetFile = path.join(__dirname, '..', 'src', 'app', 'app', 'enquiries', 'components', 'MobileEnquiryDetailSheet.tsx');
    const content = fs.readFileSync(sheetFile, 'utf8');

    // Verification 1: Supports DB brief
    assert.ok(
      content.includes('enquiry.brief'),
      'MobileEnquiryDetailSheet must map Prisma brief'
    );

    // Verification 2: Supports DB enquiryNumber
    assert.ok(
      content.includes('enquiry.enquiryNumber'),
      'MobileEnquiryDetailSheet must map Prisma enquiryNumber'
    );

    // Verification 3: Supports DB opportunityValue / estimatedBudget
    assert.ok(
      content.includes('enquiry.opportunityValue') || content.includes('enquiry.estimatedBudget'),
      'MobileEnquiryDetailSheet must map Prisma opportunityValue / estimatedBudget'
    );
  });

  test('MOB-08 (LOGICAL BUG VERIFIED & RESOLVED): MobileEnquiriesClient search filter code property', () => {
    const clientFile = path.join(__dirname, '..', 'src', 'app', 'app', 'enquiries', 'MobileEnquiriesClient.tsx');
    const content = fs.readFileSync(clientFile, 'utf8');

    // Verification: code search checks e.enquiryNumber
    assert.ok(
      content.includes('e.enquiryNumber'),
      'MobileEnquiriesClient search filter must inspect e.enquiryNumber'
    );
  });

  test('MOB-09 (LOGICAL BUG VERIFIED & RESOLVED): Mobile Quotations status normalization in filter buckets', () => {
    const clientFile = path.join(__dirname, '..', 'src', 'app', 'app', 'quotations', 'MobileQuotationsClient.tsx');
    const content = fs.readFileSync(clientFile, 'utf8');

    // Verification: Calls normalizeQuoteStatus
    assert.ok(
      content.includes('normalizeQuoteStatus'),
      'MobileQuotationsClient must call normalizeQuoteStatus for resilient bucket matching'
    );
  });

  test('MOB-10 (LOGICAL BUG VERIFIED & RESOLVED): QR code URL in Sidebar points to active deployment', () => {
    const sidebarFile = path.join(__dirname, '..', 'src', 'app', '(dashboard)', 'Sidebar.tsx');
    const content = fs.readFileSync(sidebarFile, 'utf8');

    assert.ok(
      !content.includes('optimistic-carson-one.vercel.app'),
      'Sidebar QR code must not point to obsolete optimistic-carson-one domain'
    );
    assert.ok(
      content.includes('optimistic-carson-blush.vercel.app'),
      'Sidebar QR code must point to active optimistic-carson-blush domain'
    );
  });

  test('MOB-11 (RBAC LEAK VERIFIED & RESOLVED): /app/quotations data loader role scoping', () => {
    const pageFile = path.join(__dirname, '..', 'src', 'app', 'app', 'quotations', 'page.tsx');
    const content = fs.readFileSync(pageFile, 'utf8');

    assert.ok(
      !content.includes('fetchQuotationsData({})'),
      'Mobile quotations loader must not call fetchQuotationsData with un-scoped empty object'
    );
    assert.ok(
      content.includes('role: session?.role'),
      'Mobile quotations loader must scope queries by session role'
    );
  });

  // =========================================================================
  // SECTION 4: MAIN SITE INTEGRITY CHECKS
  // =========================================================================
  test('MAIN-01: Main site core routes return 200 OK for Super Admin', async () => {
    const routes = ['/clients', '/enquiries', '/quotations', '/products', '/dashboard'];
    for (const r of routes) {
      const res = await fetch(`${BASE_URL}${r}`, {
        headers: { Cookie: adminCookieStr },
      });
      assert.equal(res.status, 200, `Expected 200 for ${r}, got ${res.status}`);
    }
  });

  test('MAIN-02: Sales Rep cannot access Admin-only /users route (middleware redirect)', async () => {
    const res = await fetch(`${BASE_URL}/users`, {
      headers: { Cookie: salesCookieStr },
      redirect: 'manual',
    });
    assert.ok([307, 308, 302, 303].includes(res.status));
    const location = res.headers.get('location') || '';
    assert.ok(location.includes('/clients'));
  });

  test('MAIN-03: Owner Rule 2 - Zero em dashes (—) in main dashboard pages', async () => {
    const routes = ['/clients', '/enquiries', '/quotations'];
    for (const r of routes) {
      const res = await fetch(`${BASE_URL}${r}`, {
        headers: { Cookie: adminCookieStr },
      });
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.equal(html.includes('—'), false, `Banned em dash (—) detected in rendered HTML of ${r}`);
    }
  });
});
