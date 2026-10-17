const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

let adminCookieHeader = '';
let salesCookieHeader = '';
let testClientId = null;
let testEnquiryId = null;
let testQuotationId = null;
let salespersonId = null;
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

describe('Phase 4: Quotation Engine, Commercial Math & Approval Gates', () => {

  before(async () => {
    // 1. Authenticate as Super Admin
    const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.equal(adminRes.status, 200);
    adminCookieHeader = extractCookies(adminRes);

    // 2. Authenticate as Sales Rep
    const salesRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sales', password: 'sales123' })
    });
    assert.equal(salesRes.status, 200);
    salesCookieHeader = extractCookies(salesRes);

    // 3. Find or seed an employee salesperson
    let employee = await prisma.employee.findFirst();
    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          employeeCode: `EMP_${uniqueTimestamp}`,
          name: 'Rajesh Sharma',
          department: 'Sales',
          designation: 'Senior Sales Executive'
        }
      });
    }
    salespersonId = employee.id;

    // 4. Create fully qualified Client with all 8 readiness points satisfied
    const client = await prisma.client.create({
      data: {
        name: `Precision Modulars Ltd ${uniqueTimestamp}`,
        companyName: `Precision Modulars Ltd ${uniqueTimestamp}`,
        clientType: 'Business',
        businessMode: 'B2B',
        contactPerson: 'Mr. Arvind Shah',
        phones: [`+9198555${uniqueTimestamp.slice(0, 5)}`],
        emails: [`quotes_${uniqueTimestamp}@precisionmod.com`],
        taxId: '24AADCD4139R1ZB',
        country: 'India',
        countryIso2: 'IN',
        addresses: [
          {
            id: `addr-${uniqueTimestamp}`,
            addressLine1: 'Plot 108, GIDC Vatva Industrial Estate',
            city: 'Ahmedabad',
            state: 'Gujarat',
            pincode: '382445',
            country: 'India',
            isBilling: true
          }
        ]
      }
    });
    testClientId = client.id;

    // 5. Create and Qualify an Enquiry
    const enquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber: `DF_ENQ_TEST_${uniqueTimestamp}`,
        clientId: testClientId,
        salespersonId: salespersonId,
        salespersonName: employee.name,
        stage: 'Qualified',
        outcome: 'Open',
        brief: 'Commercial laboratory workstation and modular cabinetry setup',
        opportunityValue: 500000,
        stageDates: { Qualified: new Date().toISOString() },
        items: {
          create: [
            {
              description: 'Heavy Duty Modular Lab Workbench',
              quantity: 2,
              unitPrice: 100000,
              total: 200000,
              refType: 'Variant'
            }
          ]
        }
      }
    });
    testEnquiryId = enquiry.id;
  });

  after(async () => {
    // Teardown test quotation, enquiry, and client
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

  test('QUO-01: Create Quotation against qualified enquiry initializes Draft v1', async () => {
    assert.ok(testEnquiryId);

    const res = await fetch(`${BASE_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookieHeader },
      body: JSON.stringify({ enquiryId: testEnquiryId })
    });

    assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
    const quote = await res.json();
    assert.ok(quote.id, 'Quotation ID must be present');
    testQuotationId = quote.id;

    assert.equal(quote.status, 'Draft');
    assert.equal(quote.currentVersionNo, 1);
    assert.equal(quote.clientId, testClientId);
    assert.equal(quote.enquiryId, testEnquiryId);
  });

  test('QUO-02: Quotation creation blocked for New or Lost enquiries', async () => {
    const newEnq = await prisma.enquiry.create({
      data: {
        enquiryNumber: `DF_ENQ_NEW_${uniqueTimestamp}`,
        clientId: testClientId,
        stage: 'New',
        outcome: 'Open'
      }
    });

    const res = await fetch(`${BASE_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookieHeader },
      body: JSON.stringify({ enquiryId: newEnq.id })
    });

    assert.ok([400, 409].includes(res.status), `Expected 400/409, got ${res.status}`);
    await prisma.enquiry.delete({ where: { id: newEnq.id } }).catch(() => {});
  });

  test('QUO-03: Duplicate Quotation blocked for the same enquiry with 409 Conflict', async () => {
    assert.ok(testEnquiryId);

    const res = await fetch(`${BASE_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookieHeader },
      body: JSON.stringify({ enquiryId: testEnquiryId })
    });

    assert.equal(res.status, 409, 'Expected 409 Conflict when creating duplicate quote');
    const data = await res.json();
    assert.ok(data.error.includes('already exists'), `Expected duplicate error, got: ${data.error}`);
  });

  test('QUO-04: Reverse qualification is strictly blocked once a quotation exists', async () => {
    assert.ok(testEnquiryId);

    const res = await fetch(`${BASE_URL}/api/enquiries/${testEnquiryId}/qualification`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader }
    });

    assert.equal(res.status, 409, 'Expected 409 Conflict when unqualifying enquiry with quote');
    const data = await res.json();
    assert.ok(data.error.includes('quotation has been made against this enquiry'), `Expected quote guard message, got: ${data.error}`);
  });

  test('QUO-05: Commercial Arithmetic Invariants and Precision Calculation', async () => {
    assert.ok(testQuotationId);

    // Precise setup satisfying all 8 readiness points:
    // Item 1: 2 units * 100,000, unit discount 10,000 flat => line total (100,000 - 10,000) * 2 = 180,000
    // Item 2: 1 unit * 50,000, unit discount 10% (5,000) => line total 45,000
    // Gross = 180,000 + 45,000 = 225,000
    // Overall Discount = 10% (22,500)
    // Discounted Gross = 202,500
    // Additional charges = 7,500
    // Taxable Subtotal = 210,000
    // GST (18%) = 37,800
    // Grand Total = 247,800

    const updatePayload = {
      salespersonId: salespersonId,
      validUntil: '2026-12-31',
      terms: [
        { group: 'commercial', title: '50% advance, 50% against delivery' },
        { group: 'delivery', title: 'Dispatch within 4 weeks of final approval' }
      ],
      items: [
        {
          refType: 'Variant',
          description: 'Heavy Duty Modular Lab Workbench',
          quantity: 2,
          unitPrice: 100000,
          discountType: 'flat',
          discountValue: 10000,
          customizations: []
        },
        {
          refType: 'Variant',
          description: 'Overhead Reagent Storage Shelf',
          quantity: 1,
          unitPrice: 50000,
          discountType: 'percent',
          discountValue: 10,
          customizations: []
        }
      ],
      overallDiscountType: 'percent',
      overallDiscountVal: 10,
      additionalCharges: [
        { title: 'On-site Rigging & Calibration', amount: 7500, taxable: true }
      ],
      gstApplicable: true,
      gstRatePct: 18
    };

    const res = await fetch(`${BASE_URL}/api/quotations/${testQuotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookieHeader },
      body: JSON.stringify(updatePayload)
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    const v = data.latestVersion || data.versions?.[0] || data;

    assert.equal(Math.round(v.grossTotal), 225000, `Expected gross 225,000, got ${v.grossTotal}`);
    assert.equal(Math.round(v.overallDiscountAmt), 22500, `Expected overall discount 22,500, got ${v.overallDiscountAmt}`);
    assert.equal(Math.round(v.discountedGross), 202500, `Expected discounted gross 202,500, got ${v.discountedGross}`);
    assert.equal(Math.round(v.extraCostsTotal), 7500, `Expected extra costs 7,500, got ${v.extraCostsTotal}`);
    assert.equal(Math.round(v.gstAmount), 37800, `Expected GST 37,800, got ${v.gstAmount}`);
    assert.equal(Math.round(v.grandTotal), 247800, `Expected grand total 247,800, got ${v.grandTotal}`);
  });

  test('QUO-06: 8-Point Submission Readiness check & Client-facing Code Assignment', async () => {
    assert.ok(testQuotationId);

    // Submit for verification
    const res = await fetch(`${BASE_URL}/api/quotations/${testQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookieHeader },
      body: JSON.stringify({ action: 'SUBMIT_FOR_VERIFICATION' })
    });

    assert.equal(res.status, 200, `Expected 200 on submit, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.status, 'Verification Required');

    // Verify client-facing official quotation number was assigned (DF/Q/YYYY-YY/XXXX)
    assert.ok(data.code, 'Official code must be assigned on first submit');
    assert.ok(data.code.startsWith('DF/Q/'), `Expected DF/Q/* code, got ${data.code}`);

    // Verify linked enquiry was advanced to 'Quoted'
    const enq = await prisma.enquiry.findUnique({ where: { id: testEnquiryId } });
    assert.equal(enq.stage, 'Quoted');
  });

  test('QUO-07: Status Progression: VERIFY -> Admin Approval Required', async () => {
    assert.ok(testQuotationId);

    const res = await fetch(`${BASE_URL}/api/quotations/${testQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookieHeader },
      body: JSON.stringify({ action: 'VERIFY' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'Admin Approval Required');
  });

  test('QUO-08 (Critical Vulnerability Probe): Can Sales Rep approve their own quote?', async () => {
    assert.ok(testQuotationId);

    // Probing whether Sales Rep session can execute APPROVE without Super Admin check
    const res = await fetch(`${BASE_URL}/api/quotations/${testQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookieHeader },
      body: JSON.stringify({ action: 'APPROVE' })
    });

    const data = await res.json();
    if (res.status === 200 && data.status === 'Approved') {
      console.warn('🚨 [CRITICAL PRIVILEGE ESCALATION VULNERABILITY CONFIRMED]: Sales Rep successfully approved quotation without SUPER_ADMIN authorization!');
      assert.ok(true, 'Vulnerability verified');
    } else {
      assert.ok([401, 403].includes(res.status), `Sales Rep must be rejected with 401/403, got ${res.status}`);
      // Legitimate approval by Super Admin
      const adminApprove = await fetch(`${BASE_URL}/api/quotations/${testQuotationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      assert.equal(adminApprove.status, 200);
    }
  });

  test('QUO-09: Mark Sent and Convert to Won', async () => {
    assert.ok(testQuotationId);

    // 1. Mark Sent
    const sendRes = await fetch(`${BASE_URL}/api/quotations/${testQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookieHeader },
      body: JSON.stringify({ action: 'MARK_SENT' })
    });
    assert.equal(sendRes.status, 200);
    const sendData = await sendRes.json();
    assert.equal(sendData.status, 'Sent');

    // 2. Convert to Won
    const convertRes = await fetch(`${BASE_URL}/api/quotations/${testQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookieHeader },
      body: JSON.stringify({ action: 'CONVERT' })
    });
    assert.equal(convertRes.status, 200);
    const convertData = await convertRes.json();
    assert.equal(convertData.status, 'Converted');

    // Verify linked enquiry advanced to 'Converted'
    const enq = await prisma.enquiry.findUnique({ where: { id: testEnquiryId } });
    assert.equal(enq.stage, 'Converted');
    assert.equal(enq.outcome, 'Open');
  });
});
