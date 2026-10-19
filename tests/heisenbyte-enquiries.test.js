const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined);
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let authCookieHeader = '';
let testClientId = null;
let testEnquiryId = null;
let cleanEnquiryId = null;
const uniqueTimestamp = Date.now().toString().slice(-6);

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

describe('Phase 3: Enquiry Monotonic State Machine & Business Guards', () => {

  before(async () => {
    // Authenticate as Super Admin
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.equal(loginRes.status, 200);
    authCookieHeader = extractCookies(loginRes);

    // Create a base client for enquiry tests
    const client = await prisma.client.create({
      data: {
        name: `Enquiry Test Client ${uniqueTimestamp}`,
        clientType: 'Business',
        businessMode: 'B2B',
        phones: [`+9198333${uniqueTimestamp.slice(0, 5)}`],
        emails: [`enq_test_${uniqueTimestamp}@example.com`],
        taxId: '24AADCD4139R1ZB'
      }
    });
    testClientId = client.id;
  });

  after(async () => {
    // Clean up created test enquiries and client
    if (cleanEnquiryId) {
      await prisma.enquiry.deleteMany({ where: { id: cleanEnquiryId } }).catch(() => {});
    }
    if (testEnquiryId) {
      await prisma.enquiryItem.deleteMany({ where: { enquiryId: testEnquiryId } }).catch(() => {});
      await prisma.communicationLog.deleteMany({ where: { enquiryId: testEnquiryId } }).catch(() => {});
      await prisma.enquiry.deleteMany({ where: { id: testEnquiryId } }).catch(() => {});
    }
    if (testClientId) {
      await prisma.client.deleteMany({ where: { id: testClientId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('ENQ-01: Quick Enquiry Intake creates enquiry with daily sequential number and stub client', async () => {
    const phone = `+9198444${uniqueTimestamp.slice(0, 5)}`;
    const payload = {
      clientName: `Auto Stub Client ${uniqueTimestamp}`,
      clientPhone: phone,
      clientEmail: `stub_${uniqueTimestamp}@example.com`,
      clientType: 'Business',
      propertyType: 'Commercial Office',
      expectedTimeline: '1 Month',
      estimatedBudget: 750000,
      notes: 'Initial walk-in discovery'
    };

    const res = await fetch(`${BASE_URL}/api/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify(payload)
    });

    assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.enquiry, 'Enquiry object must be returned');
    assert.ok(data.enquiry.id);
    cleanEnquiryId = data.enquiry.id;

    assert.ok(data.enquiry.enquiryNumber.startsWith('DF_ENQ_'), `Expected code DF_ENQ_*, got ${data.enquiry.enquiryNumber}`);
    assert.equal(data.enquiry.stage, 'New');
    assert.equal(data.enquiry.outcome, 'Open');
  });

  test('ENQ-02: Quick Enquiry Intake linked to existing client', async () => {
    assert.ok(testClientId);
    const payload = {
      clientId: testClientId,
      propertyType: 'Villa',
      expectedTimeline: '2-3 Months',
      estimatedBudget: 1500000,
      notes: 'Luxury modular kitchen & master wardrobes'
    };

    const res = await fetch(`${BASE_URL}/api/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify(payload)
    });

    assert.ok([200, 201].includes(res.status));
    const data = await res.json();
    assert.ok(data.enquiry);
    testEnquiryId = data.enquiry.id;
    assert.equal(data.enquiry.clientId, testClientId);
    assert.equal(data.enquiry.stage, 'New');
  });

  test('ENQ-03: Mandatory Brief Rule rejects qualification without brief', async () => {
    assert.ok(testEnquiryId);

    const payload = {
      brief: '   ', // whitespace only
      opportunityValue: 1500000,
      items: [
        { description: 'Modular Kitchen Island', quantity: 1, unitPrice: 450000 }
      ]
    };

    const res = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}/qualification`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 400, 'Expected 400 rejection for empty brief');
    const data = await res.json();
    assert.ok(data.error.includes('brief is required'), `Expected brief required error, got: ${data.error}`);
  });

  test('ENQ-04: Legitimate Qualification advances stage to Qualified and records audit history', async () => {
    assert.ok(testEnquiryId);

    const payload = {
      brief: 'Client requires premium acrylic finish modular kitchen and 2 master wardrobes in matte lacquer.',
      opportunityValue: 1250000,
      lineItems: [
        { description: 'Modular Kitchen Island (Acrylic)', quantity: 1, unitPrice: 450000 },
        { description: 'Master Bedroom Wardrobe 8x9ft', quantity: 2, unitPrice: 400000 }
      ],
      actor: { id: 'usr-admin', name: 'Super Admin' }
    };

    const res = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}/qualification`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.enquiry);
    assert.equal(data.enquiry.stage, 'Qualified');
    assert.equal(data.enquiry.opportunityValue, 1250000);
    assert.ok(data.enquiry.stageDates?.Qualified, 'stageDates.Qualified must be set');

    // Verify audit trail
    assert.ok(Array.isArray(data.enquiry.history));
    const qualifyEvent = data.enquiry.history.find(h => h.type === 'qualified');
    assert.ok(qualifyEvent, 'qualified audit event must exist');
  });

  test('ENQ-05: Reverse Qualification reverts stage to New when no quote exists', async () => {
    assert.ok(testEnquiryId);

    // Call DELETE /api/enquiries/[id]/qualification
    const res = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}/qualification`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify({ actor: { id: 'usr-admin', name: 'Super Admin' } })
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.enquiry.stage, 'New');
    assert.equal(data.enquiry.stageDates?.Qualified, undefined, 'stageDates.Qualified must be cleared');

    // Re-qualify so it is ready for subsequent pipeline steps
    const requalifyRes = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}/qualification`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify({
        brief: 'Re-qualified client brief for production execution',
        opportunityValue: 1250000,
        actor: { id: 'usr-admin', name: 'Super Admin' }
      })
    });
    assert.equal(requalifyRes.status, 200);
  });

  test('ENQ-06: Outcome transitions - Mark Lost and Reopen', async () => {
    assert.ok(testEnquiryId);

    // Find or seed a lost reason
    let lostReason = await prisma.lostReason.findFirst();
    if (!lostReason) {
      lostReason = await prisma.lostReason.create({
        data: { name: 'Price Too High' }
      });
    }

    // 1. Mark Lost
    const lostRes = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}/outcome`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify({
        outcome: 'Lost',
        lostReasonId: lostReason.id,
        lostNote: 'Client opted for a local carpenter due to 20% price delta',
        actor: { id: 'usr-admin', name: 'Super Admin' }
      })
    });
    assert.equal(lostRes.status, 200);
    const lostData = await lostRes.json();
    assert.equal(lostData.enquiry.outcome, 'Lost');
    assert.equal(lostData.enquiry.lostAtStage, 'Qualified');
    assert.equal(lostData.enquiry.status, 'DROPPED');

    // 2. Reopen
    const reopenRes = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}/outcome`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify({
        outcome: 'Open',
        actor: { id: 'usr-admin', name: 'Super Admin' }
      })
    });
    assert.equal(reopenRes.status, 200);
    const reopenData = await reopenRes.json();
    assert.equal(reopenData.enquiry.outcome, 'Open');
    assert.equal(reopenData.enquiry.lostAt, null);
    assert.equal(reopenData.enquiry.stage, 'Qualified');
  });

  test('ENQ-07: Communication Log CRUD records interaction and locks deletion', async () => {
    assert.ok(testEnquiryId);

    const payload = {
      date: new Date().toISOString().slice(0, 10),
      mode: 'Call',
      description: 'Discussed layout drawings with architect Mr. Verma',
      comment: 'Requested revised quotation with Hafele fittings',
      stage: 'Enquiry',
      loggedByName: 'Sales Rep'
    };

    const res = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookieHeader },
      body: JSON.stringify(payload)
    });

    assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.record, 'Expected data.record');
    assert.equal(data.record.mode, 'Call');

    // Check hasCommunication flag on enquiry
    const enq = await prisma.enquiry.findUnique({ where: { id: testEnquiryId } });
    assert.equal(enq.hasCommunication, true);
  });

  test('ENQ-08: Enquiry Deletion Guard blocks enquiry with logs, allows clean deletion', async () => {
    // 1. Attempt to delete enquiry with logs -> must fail with 409
    const blockedRes = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}`, {
      method: 'DELETE',
      headers: { 'Cookie': authCookieHeader }
    });
    assert.equal(blockedRes.status, 409);
    const blockedData = await blockedRes.json();
    assert.ok(blockedData.error.includes('communication has already been logged'));

    // 2. Delete clean enquiry without logs or quotes -> must succeed with 200
    assert.ok(cleanEnquiryId);
    const cleanRes = await fetch(`${BASE_URL}/api/enquiries/${cleanEnquiryId}`, {
      method: 'DELETE',
      headers: { 'Cookie': authCookieHeader }
    });
    assert.equal(cleanRes.status, 200);
    cleanEnquiryId = null; // Mark as deleted
  });
});
