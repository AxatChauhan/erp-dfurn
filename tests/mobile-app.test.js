const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

describe("D'furn Mobile App (/app) & Desktop Promo Banner Suite", () => {
  let salesCookies = {};
  let salesCookieStr = '';
  let adminCookies = {};
  let adminCookieStr = '';

  before(async () => {
    // 1. Authenticate Sales Rep
    const salesLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sales', password: 'sales123' }),
    });
    assert.equal(salesLogin.status, 200);
    salesCookies = extractCookies(salesLogin);
    salesCookieStr = cookieHeader(salesCookies);

    // 2. Authenticate Super Admin
    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert.equal(adminLogin.status, 200);
    adminCookies = extractCookies(adminLogin);
    adminCookieStr = cookieHeader(adminCookies);
  });

  test('APP-01: PWA Web App Manifest (/manifest.json) is valid and configured for /app/enquiries', async () => {
    const res = await fetch(`${BASE_URL}/manifest.json`);
    assert.equal(res.status, 200);
    const manifest = await res.json();
    assert.equal(manifest.start_url, '/app/enquiries');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.theme_color, '#FF7700');
    assert.equal(manifest.background_color, '#f4f3ed');
    assert.ok(manifest.name.includes("D'furn"));
  });

  test('APP-02: Service Worker (/sw.js) serves with 200 OK and registers cache', async () => {
    const res = await fetch(`${BASE_URL}/sw.js`);
    assert.equal(res.status, 200);
    const content = await res.text();
    assert.ok(content.includes('/app/enquiries'));
    assert.ok(content.includes('/app/quotations'));
  });

  test('APP-03: Route guard protects /app/enquiries against unauthenticated access', async () => {
    const res = await fetch(`${BASE_URL}/app/enquiries`, { redirect: 'manual' });
    assert.ok(res.status === 307 || res.status === 302);
    const location = res.headers.get('location') || '';
    assert.ok(location.includes('/login'));
  });

  test('APP-04: Authenticated Sales Rep can load /app/enquiries', async () => {
    const res = await fetch(`${BASE_URL}/app/enquiries`, {
      headers: { Cookie: salesCookieStr },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("D'FURN") || html.includes('Enquiries'));
  });

  test('APP-05: Authenticated Sales Rep can load /app/quotations', async () => {
    const res = await fetch(`${BASE_URL}/app/quotations`, {
      headers: { Cookie: salesCookieStr },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("D'FURN") || html.includes('Quotations'));
  });

  test('APP-06: Sidebar renders mobile app companion launcher', async () => {
    const res = await fetch(`${BASE_URL}/clients`, {
      headers: { Cookie: adminCookieStr },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Mobile App"));
    assert.ok(html.includes("Scan QR"));
    assert.ok(html.includes("/app/enquiries"));
  });

  test('APP-07: Owner UX Rule 2 · Zero em dashes in mobile app source code', () => {
    const mobileDir = path.join(__dirname, '..', 'src', 'app', 'app');
    function scanFiles(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          scanFiles(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert.equal(
            content.includes('\u2014'),
            false,
            `Banned em dash detected in mobile file: ${fullPath}`
          );
        }
      }
    }
    scanFiles(mobileDir);
  });

  test('APP-08: Owner UX Rule 3 - Black active state verification', () => {
    const navFile = path.join(__dirname, '..', 'src', 'app', 'app', 'components', 'MobileBottomNav.tsx');
    const content = fs.readFileSync(navFile, 'utf8');
    assert.ok(content.includes('text-black font-bold'), 'Selected tab must be black');
    assert.ok(content.includes('bg-[#EAE8DF]'), 'Selected active background must be subtle cream/gray');
  });

  test('APP-09: View-Only Companion Mode enforces 2-tab navigation without creation FAB', () => {
    const navFile = path.join(__dirname, '..', 'src', 'app', 'app', 'components', 'MobileBottomNav.tsx');
    const content = fs.readFileSync(navFile, 'utf8');
    assert.ok(content.includes('/app/enquiries'), 'Must contain Enquiries tab');
    assert.ok(content.includes('/app/quotations'), 'Must contain Quotations tab');
    assert.ok(!content.includes('openActionSheet'), 'Creation action sheet trigger must be absent');
  });

  test('APP-10: Authenticated Tester_User can load /app/enquiries and /app/quotations', async () => {
    const testUserLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Tester_User', password: 'Tester_User' }),
    });
    assert.equal(testUserLogin.status, 200);
    const testUserCookies = extractCookies(testUserLogin);
    const testUserCookieStr = cookieHeader(testUserCookies);

    const enqRes = await fetch(`${BASE_URL}/app/enquiries`, {
      headers: { Cookie: testUserCookieStr },
    });
    assert.equal(enqRes.status, 200);

    const quoteRes = await fetch(`${BASE_URL}/app/quotations`, {
      headers: { Cookie: testUserCookieStr },
    });
    assert.equal(quoteRes.status, 200);
  });

  test('APP-11: Enquiry PDF Generator module exports generateEnquiryPDF', () => {
    const genFile = path.join(__dirname, '..', 'src', 'lib', 'enquiries', 'enquiryPdfGenerator.ts');
    assert.ok(fs.existsSync(genFile), 'enquiryPdfGenerator.ts must exist');
    const content = fs.readFileSync(genFile, 'utf8');
    assert.ok(content.includes('export async function generateEnquiryPDF'), 'Must export generateEnquiryPDF');
    assert.ok(!content.includes('\u2014'), 'Must have zero em dashes');
  });

  test('APP-12: Mobile cards provide 1-click PDF export buttons', () => {
    const enqCardFile = path.join(__dirname, '..', 'src', 'app', 'app', 'enquiries', 'components', 'MobileEnquiryCard.tsx');
    const enqCardContent = fs.readFileSync(enqCardFile, 'utf8');
    assert.ok(enqCardContent.includes('generateEnquiryPDF'), 'Enquiry card must wire generateEnquiryPDF');
    assert.ok(enqCardContent.includes('Download Enquiry PDF') || enqCardContent.includes('PDF'), 'Enquiry card must have PDF CTA');

    const quoteCardFile = path.join(__dirname, '..', 'src', 'app', 'app', 'quotations', 'components', 'MobileQuotationCard.tsx');
    const quoteCardContent = fs.readFileSync(quoteCardFile, 'utf8');
    assert.ok(quoteCardContent.includes('generateQuotationPDF'), 'Quotation card must wire generateQuotationPDF');
  });

  test('APP-13: MobileTopBar strictly isolates mobile app experience (no desktop switch button)', () => {
    const topBarFile = path.join(__dirname, '..', 'src', 'app', 'app', 'components', 'MobileTopBar.tsx');
    const content = fs.readFileSync(topBarFile, 'utf8');
    assert.ok(!content.includes('/clients'), 'Must not link back to desktop /clients');
    assert.ok(!content.includes('Desktop'), 'Must not have desktop switch button');
  });
});
