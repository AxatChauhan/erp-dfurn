const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
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

describe('Audit Verification: Sales Rep RBAC & Data Isolation Guards', () => {
  let salesCookies = {};
  let adminCookies = {};
  let salesCookieStr = '';
  let adminCookieStr = '';
  const timestamp = Date.now().toString().slice(-6);

  let otherRepEmployeeId = '';
  let otherRepEnquiryId = '';
  let otherRepQuotationId = '';
  let salesRepEnquiryId = '';
  let testClientA = '';
  let testClientB = '';

  before(async () => {
    // 1. Authenticate Sales Rep
    const salesLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sales', password: 'sales123' })
    });
    assert.equal(salesLogin.status, 200);
    salesCookies = extractCookies(salesLogin);
    salesCookieStr = cookieHeader(salesCookies);

    // 2. Authenticate Super Admin
    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.equal(adminLogin.status, 200);
    adminCookies = extractCookies(adminLogin);
    adminCookieStr = cookieHeader(adminCookies);

    // 3. Create test clients
    const clientA = await prisma.client.create({
      data: {
        name: `Test Client Alpha ${timestamp}`,
        clientType: 'Individual',
        businessMode: 'B2C',
        phones: [`+919777${timestamp}`],
        country: 'India',
        countryIso2: 'IN'
      }
    });
    testClientA = clientA.id;

    const clientB = await prisma.client.create({
      data: {
        name: `Test Client Beta ${timestamp}`,
        clientType: 'Individual',
        businessMode: 'B2C',
        phones: [`+919666${timestamp}`],
        country: 'India',
        countryIso2: 'IN'
      }
    });
    testClientB = clientB.id;

    // 4. Find another salesperson employee (e.g. Rajesh Sharma)
    const otherEmployee = await prisma.employee.findFirst({
      where: {
        id: { not: salesCookies.employee_id || '85f1a53f-c3d7-4da1-b6e9-2067151e688b' }
      }
    });
    otherRepEmployeeId = otherEmployee?.id || 'other-emp-id';

    // 5. Create an enquiry owned by the other rep
    const otherEnquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber: `DF_ENQ_OTHER_${timestamp}`,
        clientId: testClientA,
        salespersonId: otherRepEmployeeId,
        salespersonName: otherEmployee?.name || 'Other Rep',
        stage: 'Qualified',
        outcome: 'Open',
        brief: 'Commercial kitchen for other rep client',
        opportunityValue: 750000
      }
    });
    otherRepEnquiryId = otherEnquiry.id;

    // Create quotation for the other rep's enquiry
    const otherQuote = await prisma.quotation.create({
      data: {
        quotationNumber: `DF_Q_OTHER_${timestamp}`,
        enquiryCode: otherEnquiry.enquiryNumber,
        clientId: testClientA,
        enquiryId: otherEnquiry.id,
        salespersonId: otherRepEmployeeId,
        salespersonName: otherEmployee?.name || 'Other Rep',
        status: 'Admin Approval Required',
        totalAmount: 750000,
        versions: {
          create: {
            versionNo: 1,
            versionCode: `Draft · ${otherEnquiry.enquiryNumber}`,
            status: 'Admin Approval Required',
            grossTotal: 750000,
            grandTotal: 750000,
            createdById: 'usr-other-rep',
            createdByName: 'Other Rep'
          }
        }
      }
    });
    otherRepQuotationId = otherQuote.id;

    // 6. Create an enquiry owned by our sales rep
    const salesRepEnq = await prisma.enquiry.create({
      data: {
        enquiryNumber: `DF_ENQ_MINE_${timestamp}`,
        clientId: testClientB,
        salespersonId: salesCookies.employee_id || '85f1a53f-c3d7-4da1-b6e9-2067151e688b',
        salespersonName: 'Sales Rep',
        stage: 'Qualified',
        outcome: 'Open',
        brief: 'Modular cabinetry for sales rep client',
        opportunityValue: 300000
      }
    });
    salesRepEnquiryId = salesRepEnq.id;
  });

  after(async () => {
    if (otherRepQuotationId) {
      await prisma.quotationVersion.deleteMany({ where: { quotationId: otherRepQuotationId } }).catch(() => {});
      await prisma.quotation.deleteMany({ where: { id: otherRepQuotationId } }).catch(() => {});
    }
    if (otherRepEnquiryId) {
      await prisma.enquiry.deleteMany({ where: { id: otherRepEnquiryId } }).catch(() => {});
    }
    if (salesRepEnquiryId) {
      await prisma.enquiry.deleteMany({ where: { id: salesRepEnquiryId } }).catch(() => {});
    }
    if (testClientA) {
      await prisma.client.deleteMany({ where: { id: testClientA } }).catch(() => {});
    }
    if (testClientB) {
      await prisma.client.deleteMany({ where: { id: testClientB } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------
  // ISSUE 1: Quotations Module RBAC & Cross-Rep Modification
  // -------------------------------------------------------------
  test('Issue 1.1: Sales Rep cannot APPROVE a quotation directly (strictly returns 403 Forbidden)', async () => {
    const res = await fetch(`${BASE_URL}/api/quotations/${otherRepQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: salesCookieStr },
      body: JSON.stringify({ action: 'APPROVE' })
    });

    assert.equal(res.status, 403, `Expected 403 Forbidden for Sales Rep APPROVE, got ${res.status}`);
  });

  test('Issue 1.2: Sales Rep cannot view another representative\'s quotation (returns 403)', async () => {
    const res = await fetch(`${BASE_URL}/api/quotations/${otherRepQuotationId}`, {
      headers: { Cookie: salesCookieStr }
    });

    assert.equal(res.status, 403, `Expected 403 Forbidden for cross-rep quotation view, got ${res.status}`);
  });

  test('Issue 1.3: Sales Rep cannot edit or revise another representative\'s quotation (returns 403)', async () => {
    const res = await fetch(`${BASE_URL}/api/quotations/${otherRepQuotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: salesCookieStr },
      body: JSON.stringify({ items: [] })
    });

    assert.equal(res.status, 403, `Expected 403 Forbidden for cross-rep quotation edit, got ${res.status}`);
  });

  // -------------------------------------------------------------
  // ISSUE 2: User & Identity Bridge
  // -------------------------------------------------------------
  test('Issue 2: Sales user session bridges to linked employee record', async () => {
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: salesCookieStr }
    });

    assert.equal(meRes.status, 200);
    const data = await meRes.json();
    assert.equal(data.authenticated, true);
    assert.equal(data.user.role, 'SALES');
    assert.ok(data.user.employeeId, 'employeeId must be present on authenticated user');
    assert.equal(data.user.employeeId, '85f1a53f-c3d7-4da1-b6e9-2067151e688b');
  });

  // -------------------------------------------------------------
  // ISSUE 3: Enquiries Module Scoping & Restricted Actions
  // -------------------------------------------------------------
  test('Issue 3.1: Sales Rep GET /api/enquiries only returns enquiries they own or entered', async () => {
    const res = await fetch(`${BASE_URL}/api/enquiries`, {
      headers: { Cookie: salesCookieStr }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.enquiries));

    // Must include sales rep's enquiry
    const hasMyEnquiry = data.enquiries.some(e => e.id === salesRepEnquiryId);
    assert.ok(hasMyEnquiry, 'Own enquiry must be visible in scoped enquiries');

    // Must NOT leak other rep's enquiry
    const hasOtherEnquiry = data.enquiries.some(e => e.id === otherRepEnquiryId);
    assert.equal(hasOtherEnquiry, false, 'Other salesperson enquiry must NOT leak to Sales Rep');
  });

  test('Issue 3.2: Sales Rep cannot change outcome of another representative\'s enquiry (returns 403)', async () => {
    const lostReason = await prisma.lostReason.findFirst();
    assert.ok(lostReason, 'At least one lost reason must exist');

    const res = await fetch(`${BASE_URL}/api/enquiries/${otherRepEnquiryId}/outcome`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: salesCookieStr },
      body: JSON.stringify({
        outcome: 'Lost',
        lostReasonId: lostReason.id,
        lostNote: 'Attempted unauthorized change'
      })
    });

    assert.equal(res.status, 403, `Expected 403 Forbidden for cross-rep enquiry outcome change, got ${res.status}`);
  });

  // -------------------------------------------------------------
  // ISSUE 4: Clients Module Unrestricted Deletion
  // -------------------------------------------------------------
  test('Issue 4.1: Sales Rep calling DELETE /api/clients/:id is blocked with 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/clients/${testClientB}`, {
      method: 'DELETE',
      headers: { Cookie: salesCookieStr }
    });

    assert.equal(res.status, 403, `Expected 403 Forbidden for client deletion by Sales Rep, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error.includes('Only Super Admin can delete clients'));
  });

  // -------------------------------------------------------------
  // ISSUE 5: Admin & User Management Exposure
  // -------------------------------------------------------------
  test('Issue 5.1: Sales Rep cannot view system users via GET /api/users (returns 403)', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: salesCookieStr }
    });

    assert.equal(res.status, 403, `Expected 403 Forbidden for GET /api/users by Sales Rep, got ${res.status}`);
  });

  test('Issue 5.2: Sales Rep cannot create new system users via POST /api/users (returns 403)', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: salesCookieStr },
      body: JSON.stringify({
        username: `attacker_${timestamp}`,
        password: 'password123',
        name: 'Attacker',
        role: 'SUPER_ADMIN'
      })
    });

    assert.equal(res.status, 403, `Expected 403 Forbidden for POST /api/users by Sales Rep, got ${res.status}`);
  });

  test('Issue 5.3: Sales Rep navigating to /users is redirected away to /clients by middleware', async () => {
    const res = await fetch(`${BASE_URL}/users`, {
      headers: { Cookie: salesCookieStr },
      redirect: 'manual'
    });

    assert.ok([307, 308, 302].includes(res.status), `Expected redirect status, got ${res.status}`);
    const location = res.headers.get('location') || '';
    assert.ok(location.includes('/clients'), `Expected redirect to /clients, got ${location}`);
  });

  // -------------------------------------------------------------
  // ISSUE 6: Confidential Salary & Factory Data Leak (HRM)
  // -------------------------------------------------------------
  test('Issue 6.1: Sales Rep cannot access employee roster via GET /api/hrm/employees (returns 403)', async () => {
    const res = await fetch(`${BASE_URL}/api/hrm/employees`, {
      headers: { Cookie: salesCookieStr }
    });

    assert.equal(res.status, 403, `Expected 403 Forbidden for GET /api/hrm/employees by Sales Rep, got ${res.status}`);
  });

  test('Issue 6.2: Sales Rep cannot record attendance punches via POST /api/hrm/attendance (returns 403)', async () => {
    const res = await fetch(`${BASE_URL}/api/hrm/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: salesCookieStr },
      body: JSON.stringify({
        employeeId: otherRepEmployeeId,
        type: 'In'
      })
    });

    assert.equal(res.status, 403, `Expected 403 Forbidden for POST /api/hrm/attendance by Sales Rep, got ${res.status}`);
  });

  test('Issue 6.3: Sales Rep navigating to /hrm/employees or /hrm/attendance is redirected to /clients by middleware', async () => {
    const empPageRes = await fetch(`${BASE_URL}/hrm/employees`, {
      headers: { Cookie: salesCookieStr },
      redirect: 'manual'
    });
    assert.ok([307, 308, 302].includes(empPageRes.status), `Expected redirect status for /hrm/employees, got ${empPageRes.status}`);
    assert.ok((empPageRes.headers.get('location') || '').includes('/clients'));

    const attPageRes = await fetch(`${BASE_URL}/hrm/attendance`, {
      headers: { Cookie: salesCookieStr },
      redirect: 'manual'
    });
    assert.ok([307, 308, 302].includes(attPageRes.status), `Expected redirect status for /hrm/attendance, got ${attPageRes.status}`);
    assert.ok((attPageRes.headers.get('location') || '').includes('/clients'));
  });
});
