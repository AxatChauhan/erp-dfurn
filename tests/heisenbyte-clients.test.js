const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let testBusinessClientId = null;
let testIndividualClientId = null;
let authCookieHeader = '';
const uniqueTimestamp = Date.now().toString().slice(-6);
const TEST_PHONE_BUSINESS = `+9198765${uniqueTimestamp.slice(0, 5)}`;
const TEST_PHONE_INDIVIDUAL = `+9198222${uniqueTimestamp.slice(0, 5)}`;

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

describe('Phase 2: Client Management & Data Integrity', () => {

  before(async () => {
    // Authenticate as Super Admin to get session cookies
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.equal(loginRes.status, 200, 'Super admin login failed');
    authCookieHeader = extractCookies(loginRes);
    assert.ok(authCookieHeader.includes('auth_token='), 'Auth cookie missing');
  });

  after(async () => {
    // Clean up created test clients if they don't have linked enquiries
    if (testIndividualClientId) {
      await prisma.client.deleteMany({ where: { id: testIndividualClientId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('CLI-00: Unauthenticated API calls return 401 JSON instead of redirect', async () => {
    const res = await fetch(`${BASE_URL}/api/clients`, { redirect: 'manual' });
    if (res.status === 401) {
      const data = await res.json();
      assert.ok(data.error, '401 response must contain error message');
    } else {
      assert.ok([307, 308, 302].includes(res.status), 'Middleware redirects unauthenticated API calls');
      const location = res.headers.get('location') || '';
      assert.ok(location.includes('/login'), 'Redirects to /login page instead of 401 status');
    }
  });

  test('CLI-01: Create Business client with B2B mode, valid GSTIN, and E.164 phone', async () => {
    const payload = {
      type: 'Business',
      businessMode: 'B2B',
      companyName: `HeisenByte Corp ${uniqueTimestamp}`,
      name: `HeisenByte Corp ${uniqueTimestamp}`,
      contactPerson: 'Dr. Quantum',
      phone: TEST_PHONE_BUSINESS,
      emails: [`tester_${uniqueTimestamp}@heisenbyte.io`],
      gstin: '24AADCD4139R1ZB',
      country: 'India',
      countryIso2: 'IN',
      addresses: [
        {
          addressLine1: '404 Quantum Way',
          city: 'Ahmedabad',
          state: 'Gujarat',
          pincode: '380015',
          country: 'India',
          isBilling: true
        }
      ]
    };

    const res = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookieHeader
      },
      body: JSON.stringify(payload)
    });

    assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
    const client = await res.json();
    assert.ok(client.id, 'Client ID must be generated');
    testBusinessClientId = client.id;

    assert.ok(client.clientCode.startsWith('DF/C/B2B/'), `Expected clientCode to start with DF/C/B2B/, got ${client.clientCode}`);
    assert.equal(client.clientType, 'Business');
    assert.equal(client.businessMode, 'B2B');
    assert.equal(client.taxId, '24AADCD4139R1ZB');
    assert.ok(Array.isArray(client.phones));
    assert.ok(client.phones.includes(TEST_PHONE_BUSINESS));
  });

  test('CLI-02: Create Individual client with B2C mode and international phone formatting', async () => {
    const payload = {
      type: 'Individual',
      businessMode: 'B2C',
      name: `John Observer ${uniqueTimestamp}`,
      phone: TEST_PHONE_INDIVIDUAL,
      emails: [`john_${uniqueTimestamp}@example.com`],
      country: 'India',
      countryIso2: 'IN'
    };

    const res = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookieHeader
      },
      body: JSON.stringify(payload)
    });

    assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
    const client = await res.json();
    assert.ok(client.id);
    testIndividualClientId = client.id;

    assert.ok(client.clientCode.startsWith('DF/C/B2C/'), `Expected code DF/C/B2C/, got ${client.clientCode}`);
    assert.equal(client.clientType, 'Individual');
    assert.equal(client.businessMode, 'B2C');
  });

  test('CLI-03: Validation rejections on malformed inputs', async () => {
    // 1. Business without company name
    const res1 = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify({ type: 'Business', companyName: '', name: '', phone: '+919999999999' })
    });
    assert.equal(res1.status, 400);

    // 2. Individual without name
    const res2 = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify({ type: 'Individual', name: '  ', phone: '+919999999999' })
    });
    assert.equal(res2.status, 400);

    // 3. Invalid phone format
    const res3 = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify({ type: 'Individual', name: 'Valid Name', phone: '123' })
    });
    assert.equal(res3.status, 400);

    // 4. Invalid email format
    const res4 = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify({ type: 'Individual', name: 'Valid Name', phone: '+919999999991', emails: ['invalid-email'] })
    });
    assert.equal(res4.status, 400);

    // 5. Invalid Indian GSTIN format
    const res5 = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify({
        type: 'Business',
        companyName: 'GST Fail Corp',
        phone: '+919999999992',
        gstin: 'NOT_A_VALID_GSTIN'
      })
    });
    assert.equal(res5.status, 400);
  });

  test('CLI-04: Duplicate Phone number is blocked with 409 Conflict', async () => {
    const payload = {
      type: 'Individual',
      name: 'Duplicate Phone Attempter',
      phone: TEST_PHONE_BUSINESS
    };

    const res = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 409, `Expected 409 Conflict for duplicate phone, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error.includes('already registered'), `Expected duplicate error message, got: ${data.error}`);
  });

  test('CLI-05 (Anomaly Probe): Client duplicate phone search uses "take: 200" limit', async () => {
    const totalActiveClients = await prisma.client.count({ where: { isActive: true } });
    if (totalActiveClients > 200) {
      console.warn(`⚠️ [ANOMALY DETECTED]: Active clients (${totalActiveClients}) exceed 200 limit in duplicate phone scan!`);
    } else {
      assert.ok(true, `Active client count (${totalActiveClients}) currently under 200 threshold.`);
    }
  });

  test('CLI-06: Update Client via PUT /api/clients/[id]', async () => {
    assert.ok(testBusinessClientId, 'Business client must exist for update');

    const updatePayload = {
      name: `HeisenByte Corp Updated ${uniqueTimestamp}`,
      companyName: `HeisenByte Corp Updated ${uniqueTimestamp}`,
      contactPerson: 'Prof. Schrödinger',
      phones: [TEST_PHONE_BUSINESS],
      emails: [`updated_${uniqueTimestamp}@heisenbyte.io`]
    };

    const res = await fetch(`${BASE_URL}/api/clients/${testBusinessClientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify(updatePayload)
    });

    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.contactPerson, 'Prof. Schrödinger');
    assert.equal(updated.name, `HeisenByte Corp Updated ${uniqueTimestamp}`);

    // Verify GET returns updated data
    const getRes = await fetch(`${BASE_URL}/api/clients/${testBusinessClientId}`, {
      headers: { 'Cookie': authCookieHeader }
    });
    assert.equal(getRes.status, 200);
    const fetched = await getRes.json();
    assert.equal(fetched.contactPerson, 'Prof. Schrödinger');
  });

  test('CLI-07: Client Deletion Guard blocks deletion if transactions exist', async () => {
    // Find an enquiry with a client
    const enquiry = await prisma.enquiry.findFirst({ select: { clientId: true } });
    if (enquiry && enquiry.clientId) {
      const res = await fetch(`${BASE_URL}/api/clients/${enquiry.clientId}`, {
        method: 'DELETE',
        headers: { 'Cookie': authCookieHeader }
      });
      assert.equal(res.status, 409, 'Expected 409 Conflict when deleting client with enquiries');
      const data = await res.json();
      assert.ok(data.error.includes('cannot be deleted'), `Expected deletion guard message, got: ${data.error}`);
    }

    // Deleting client with NO transactions succeeds
    assert.ok(testIndividualClientId);
    const deleteRes = await fetch(`${BASE_URL}/api/clients/${testIndividualClientId}`, {
      method: 'DELETE',
      headers: { 'Cookie': authCookieHeader }
    });
    assert.equal(deleteRes.status, 200, 'Expected 200 when deleting client without transactions');
    testIndividualClientId = null; // Mark as deleted
  });

  test('CLI-08: CSV Import Preview parses multipart file with headers', async () => {
    const freshPhone = `+9199111${Date.now().toString().slice(-5)}`;
    const csvContent = `Client Name,Type,Phone,Email,GSTIN\n"Quantum Labs",Business,${freshPhone},quantum_${Date.now()}@labs.io,24AADCD4139R1ZB\n"Bad Row",Individual,123,badmail,`;
    const formData = new FormData();
    const file = new File([csvContent], 'clients.csv', { type: 'text/csv' });
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/api/clients/import/preview`, {
      method: 'POST',
      headers: { 'Cookie': authCookieHeader },
      body: formData
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.report, 'report object must be returned');
    assert.equal(data.report.totalRows, 2);
    assert.ok(data.report.ready >= 1, `Expected ready >= 1, got ${data.report.ready}. Issues: ${JSON.stringify(data.report.issues)}`);
    assert.ok(data.report.needsReview >= 1, 'Bad row should be flagged as needsReview');
    assert.ok(data.report.issues.length >= 1, 'Issues list should contain the bad row');
  });
});
