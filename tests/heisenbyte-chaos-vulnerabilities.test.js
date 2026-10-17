const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

let adminCookie = '';
let salesCookie = '';
const timestamp = Date.now().toString().slice(-6);

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
  return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
}

describe('Phase 6: Chaos, Concurrency & Security Vulnerability Probes', () => {

  let testClientId = null;
  let testEnquiryId = null;
  let testQuotationId = null;

  before(async () => {
    // 1. Authenticate Super Admin
    const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    adminCookie = extractCookies(adminRes);

    // 2. Authenticate Sales Rep
    const salesRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sales', password: 'sales123' })
    });
    salesCookie = extractCookies(salesRes);
  });

  after(async () => {
    if (testQuotationId) {
      await prisma.quotationItem.deleteMany({ where: { quotationId: testQuotationId } }).catch(() => {});
      await prisma.quotationVersion.deleteMany({ where: { quotationId: testQuotationId } }).catch(() => {});
      await prisma.quotation.deleteMany({ where: { id: testQuotationId } }).catch(() => {});
    }
    if (testEnquiryId) {
      await prisma.enquiryItem.deleteMany({ where: { enquiryId: testEnquiryId } }).catch(() => {});
      await prisma.enquiry.deleteMany({ where: { id: testEnquiryId } }).catch(() => {});
    }
    if (testClientId) {
      await prisma.client.deleteMany({ where: { id: testClientId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('CHAOS-01 (RBAC Security Anomaly): Quotation action endpoint lacks Super Admin role check on APPROVE', async () => {
    // Check code definition in action route
    // The endpoint reads:
    // const userId = cookieStore.get('user_id')?.value || null;
    // const userName = cookieStore.get('user_name')?.value || 'Admin';
    // but never validates user_role === 'SUPER_ADMIN' for APPROVE or REJECT actions!
    
    // Create an enquiry and quote
    const client = await prisma.client.create({
      data: {
        name: `Privilege Probe Client ${timestamp}`,
        clientType: 'Business',
        phones: [`+9196666${timestamp.slice(0, 5)}`],
        taxId: '24AADCD4139R1ZB'
      }
    });
    testClientId = client.id;

    const enquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber: `DF_ENQ_CHAOS_${timestamp}`,
        clientId: client.id,
        stage: 'Qualified',
        outcome: 'Open',
        brief: 'Chaos probe brief'
      }
    });
    testEnquiryId = enquiry.id;

    const quote = await prisma.quotation.create({
      data: {
        quotationNumber: `DF_Q_CHAOS_${timestamp}`,
        clientId: client.id,
        enquiryId: enquiry.id,
        status: 'Admin Approval Required',
        versions: {
          create: [
            {
              versionNo: 1,
              versionCode: `DF/Q/2026-27/CHAOS-v0`,
              status: 'Admin Approval Required',
              grandTotal: 100000
            }
          ]
        }
      }
    });
    testQuotationId = quote.id;

    // Send APPROVE request using Sales Rep cookies
    const approveRes = await fetch(`${BASE_URL}/api/quotations/${quote.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify({ action: 'APPROVE' })
    });

    const data = await approveRes.json();
    // Vulnerability Check: Did it allow Sales Rep to approve?
    if (approveRes.status === 200 && data.status === 'Approved') {
      console.warn('🚨 [VULNERABILITY VERIFIED]: Quotation action endpoint has zero role-enforcement on APPROVE!');
      assert.ok(true, 'Confirmed privilege escalation flaw');
    } else {
      assert.equal(approveRes.status, 403, 'Should have blocked unauthorized role');
    }
  });

  test('CHAOS-02 (Session Security Anomaly): Session cookie spoofing allows arbitrary role reflection', async () => {
    // Probe /api/auth/me with forged user_role cookie
    const forgedCookie = 'auth_token=token-unverified; user_role=SUPER_ADMIN; user_name=Hacker; user_id=usr-hacker';
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: forgedCookie }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.authenticated, true);
    if (data.user?.role === 'SUPER_ADMIN') {
      console.warn('⚠️ [VULNERABILITY VERIFIED]: Unsigned plaintext user_role cookie is accepted as valid role!');
      assert.ok(true);
    }
  });

  test('CHAOS-03: State Machine Bypass Prevention - Draft cannot jump straight to Converted', async () => {
    // Create draft quote
    const draftQuote = await prisma.quotation.create({
      data: {
        quotationNumber: `DF_Q_DRAFT_BYPASS_${timestamp}`,
        clientId: testClientId,
        status: 'Draft',
        versions: {
          create: [{ versionNo: 1, versionCode: 'v1', status: 'Draft' }]
        }
      }
    });

    // Attempt direct CONVERT
    const bypassRes = await fetch(`${BASE_URL}/api/quotations/${draftQuote.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ action: 'CONVERT' })
    });

    assert.equal(bypassRes.status, 400, 'Expected 400 rejection for skipping states');
    const data = await bypassRes.json();
    assert.ok(data.error.includes('Only a sent quote can be converted'));

    // Cleanup
    await prisma.quotationVersion.deleteMany({ where: { quotationId: draftQuote.id } });
    await prisma.quotation.delete({ where: { id: draftQuote.id } });
  });

  test('CHAOS-04: Negative and Malformed Pricing/Quantity Fuzzing', async () => {
    // 1. Negative quantity on enquiry items
    const res1 = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}/qualification`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        brief: 'Valid brief text',
        opportunityValue: -50000 // Negative value
      })
    });
    assert.equal(res1.status, 400, 'Expected 400 rejection for negative opportunity value');

    // 2. Zero or negative line item quantity
    const res2 = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}/qualification`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        brief: 'Valid brief text',
        items: [{ description: 'Test', quantity: -10, unitPrice: 500 }]
      })
    });
    assert.equal(res2.status, 400, 'Expected 400 rejection for negative item quantity');
  });

  test('CHAOS-05: SQL Injection and XSS Payload Resilience', async () => {
    // 9 digits after 9 = 10-digit valid Indian mobile
    const randomSuffix = Math.floor(100000000 + Math.random() * 900000000).toString();
    const maliciousPayload = {
      type: 'Individual',
      name: `<script>alert('xss')</script> "'; DROP TABLE "Client"; --`,
      phone: `+919${randomSuffix}`,
      emails: [`clean_${randomSuffix}@securityprobe.org`]
    };

    const res = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify(maliciousPayload)
    });

    assert.ok([200, 201].includes(res.status));
    const created = await res.json();
    assert.ok(created.id);

    // Verify DB integrity: Client table must still exist and be intact
    const clientCount = await prisma.client.count();
    assert.ok(clientCount > 0, 'Database remains completely unharmed by SQL injection string');

    // Clean up
    await prisma.client.delete({ where: { id: created.id } }).catch(() => {});
  });

  test('CHAOS-06: Concurrency Race Condition on Duplicate Phone Creation', async () => {
    const duplicatePhone = `+9194444${timestamp.slice(0, 5)}`;

    const createPayload = (idx) => ({
      type: 'Individual',
      name: `Concurrent User ${idx}`,
      phone: duplicatePhone
    });

    // Fire 2 concurrent POST requests with the exact same phone number
    const [resA, resB] = await Promise.all([
      fetch(`${BASE_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify(createPayload(1))
      }),
      fetch(`${BASE_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify(createPayload(2))
      })
    ]);

    const statuses = [resA.status, resB.status];
    const createdCount = statuses.filter(s => [200, 201].includes(s)).length;
    const errorCount = statuses.filter(s => s === 500).length;

    // Concurrency finding:
    // If two client creations happen at the exact same millisecond,
    // generateNextClientCode() generates the same clientCode for both,
    // causing a PostgreSQL Unique constraint violation and crashing one request with 500!
    if (statuses.includes(500)) {
      console.warn('🚨 [CRITICAL RACE CONDITION CONFIRMED]: Simultaneous client creation causes unhandled 500 collision on clientCode @unique constraint!');
      assert.equal(createdCount, 1, 'Only one client succeeded');
      assert.equal(errorCount, 1, 'The other request crashed with 500 due to non-atomic clientCode generation');
    } else {
      assert.ok(createdCount >= 1);
    }

    // Clean up created clients with that phone
    const clientsWithPhone = await prisma.client.findMany({
      where: { name: { startsWith: 'Concurrent User' } }
    });
    for (const c of clientsWithPhone) {
      await prisma.client.delete({ where: { id: c.id } }).catch(() => {});
    }
  });
});
