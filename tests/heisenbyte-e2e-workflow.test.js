const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

let adminCookie = '';
let salesCookie = '';
let salespersonEmployeeId = '';
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

describe('Phase 5: Full End-to-End Core Workflow Simulation', () => {

  let createdClientId = null;
  let createdEnquiryId = null;
  let createdQuotationId = null;

  before(async () => {
    // 1. Authenticate Super Admin
    const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.equal(adminRes.status, 200);
    adminCookie = extractCookies(adminRes);

    // 2. Authenticate Sales Rep
    const salesRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sales', password: 'sales123' })
    });
    assert.equal(salesRes.status, 200);
    salesCookie = extractCookies(salesRes);

    // 3. Find or seed Employee
    let emp = await prisma.employee.findFirst();
    if (!emp) {
      emp = await prisma.employee.create({
        data: {
          employeeCode: `EMP_${timestamp}`,
          name: 'Priya Mehta',
          department: 'Sales',
          designation: 'Commercial Interior Specialist'
        }
      });
    }
    salespersonEmployeeId = emp.id;
  });

  after(async () => {
    // Clean up created records in reverse order
    if (createdQuotationId) {
      await prisma.quotationItem.deleteMany({ where: { quotationId: createdQuotationId } }).catch(() => {});
      await prisma.quotationVersion.deleteMany({ where: { quotationId: createdQuotationId } }).catch(() => {});
      await prisma.quotation.deleteMany({ where: { id: createdQuotationId } }).catch(() => {});
    }
    if (createdEnquiryId) {
      await prisma.communicationLog.deleteMany({ where: { enquiryId: createdEnquiryId } }).catch(() => {});
      await prisma.enquiryItem.deleteMany({ where: { enquiryId: createdEnquiryId } }).catch(() => {});
      await prisma.enquiry.deleteMany({ where: { id: createdEnquiryId } }).catch(() => {});
    }
    if (createdClientId) {
      await prisma.client.deleteMany({ where: { id: createdClientId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('E2E Step 1: Sales Rep creates new Business Client with valid tax ID & Address', async () => {
    const payload = {
      type: 'Business',
      businessMode: 'B2B',
      companyName: `Apex Corporate Towers ${timestamp}`,
      name: `Apex Corporate Towers ${timestamp}`,
      contactPerson: 'Karan Mehra (Procurement Head)',
      phone: `+9197777${timestamp.slice(0, 5)}`,
      emails: [`procurement_${timestamp}@apextowers.in`],
      gstin: '24AADCD4139R1ZB',
      country: 'India',
      countryIso2: 'IN',
      addresses: [
        {
          id: `addr-apex-${timestamp}`,
          addressLine1: 'Tower 4, Corporate Park, SG Highway',
          city: 'Ahmedabad',
          state: 'Gujarat',
          pincode: '380054',
          country: 'India',
          isBilling: true
        }
      ]
    };

    const res = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify(payload)
    });

    assert.ok([200, 201].includes(res.status));
    const client = await res.json();
    assert.ok(client.id);
    createdClientId = client.id;
    assert.ok(client.clientCode.startsWith('DF/C/B2B/'));
  });

  test('E2E Step 2: Sales Rep creates Enquiry linked to the new Client', async () => {
    assert.ok(createdClientId);

    const payload = {
      clientId: createdClientId,
      salespersonId: salespersonEmployeeId,
      propertyType: 'Commercial Office',
      expectedTimeline: '1 Month',
      estimatedBudget: 2400000,
      notes: 'Outfitting 60 modular workstations + executive conference suite'
    };

    const res = await fetch(`${BASE_URL}/api/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify(payload)
    });

    assert.ok([200, 201].includes(res.status));
    const data = await res.json();
    assert.ok(data.enquiry);
    createdEnquiryId = data.enquiry.id;
    assert.equal(data.enquiry.stage, 'New');
    assert.equal(data.enquiry.outcome, 'Open');
  });

  test('E2E Step 3: Sales Rep logs Site Visit communication on the Enquiry', async () => {
    assert.ok(createdEnquiryId);

    const payload = {
      date: new Date().toISOString().slice(0, 10),
      mode: 'Site Visit',
      description: 'Conducted laser distance measurement of floor plate with architectural liaison',
      comment: 'Floor plan confirmed, ready for modular partition quotation',
      stage: 'Enquiry',
      loggedByName: 'Sales Rep'
    };

    const res = await fetch(`${BASE_URL}/api/enquiries/${createdEnquiryId}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify(payload)
    });

    assert.ok([200, 201].includes(res.status));
    const data = await res.json();
    assert.ok(data.record);
    assert.equal(data.record.mode, 'Site Visit');
  });

  test('E2E Step 4: Sales Rep Qualifies the Enquiry with detailed brief & items', async () => {
    assert.ok(createdEnquiryId);

    const payload = {
      brief: 'Turnkey modular workstations for 60 employees with acoustic screens and cable management racing.',
      opportunityValue: 2400000,
      lineItems: [
        {
          refType: 'Variant',
          description: 'Linear 4-Person Modular Workstation Cluster',
          quantity: 15,
          unitPrice: 120000,
          customizations: []
        },
        {
          refType: 'Variant',
          description: '14-Seater Executive Conference Table in Smoked Oak',
          quantity: 1,
          unitPrice: 350000,
          customizations: []
        }
      ],
      actor: { id: 'usr-sales', name: 'Sales Rep' }
    };

    const res = await fetch(`${BASE_URL}/api/enquiries/${createdEnquiryId}/qualification`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.enquiry.stage, 'Qualified');
    assert.ok(data.enquiry.stageDates?.Qualified);
  });

  test('E2E Step 5: Sales Rep initializes Quotation & configures commercials and terms', async () => {
    assert.ok(createdEnquiryId);

    // 1. Create Quote
    const initRes = await fetch(`${BASE_URL}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify({ enquiryId: createdEnquiryId })
    });
    assert.ok([200, 201].includes(initRes.status));
    const quote = await initRes.json();
    assert.ok(quote.id);
    createdQuotationId = quote.id;

    // 2. Configure Commercials: 15 clusters * 120,000 = 1,800,000; 1 table * 350,000 = 350,000 => Gross: 2,150,000
    // Overall 5% discount => 107,500. Discounted Gross = 2,042,500
    // Extra costs: 57,500. Taxable Subtotal = 2,100,000. GST 18% = 378,000. Grand Total = 2,478,000
    const updatePayload = {
      salespersonId: salespersonEmployeeId,
      validUntil: '2026-12-31',
      terms: [
        { group: 'commercial', title: 'Payment: 40% advance, 50% against PI, 10% on handover' },
        { group: 'delivery', title: 'Delivery: 21 working days from site readiness' }
      ],
      items: [
        {
          refType: 'Variant',
          description: 'Linear 4-Person Modular Workstation Cluster',
          quantity: 15,
          unitPrice: 120000,
          customizations: []
        },
        {
          refType: 'Variant',
          description: '14-Seater Executive Conference Table in Smoked Oak',
          quantity: 1,
          unitPrice: 350000,
          customizations: []
        }
      ],
      overallDiscountType: 'percent',
      overallDiscountVal: 5,
      additionalCharges: [
        { title: 'Turnkey Installation & Acoustic Shielding', amount: 57500, taxable: true }
      ],
      gstApplicable: true,
      gstRatePct: 18
    };

    const updateRes = await fetch(`${BASE_URL}/api/quotations/${createdQuotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify(updatePayload)
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    const v = updated.latestVersion || updated.versions?.[0] || updated;
    assert.equal(Math.round(v.grandTotal), 2478000);
  });

  test('E2E Step 6: Sales Rep submits quotation for Verification (assigns DF/Q code)', async () => {
    assert.ok(createdQuotationId);

    const res = await fetch(`${BASE_URL}/api/quotations/${createdQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify({ action: 'SUBMIT_FOR_VERIFICATION' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'Verification Required');
    assert.ok(data.code.startsWith('DF/Q/'));

    // Check Enquiry advanced to Quoted
    const enq = await prisma.enquiry.findUnique({ where: { id: createdEnquiryId } });
    assert.equal(enq.stage, 'Quoted');
  });

  test('E2E Step 7: Technical Verifier verifies -> Admin Approval Required', async () => {
    assert.ok(createdQuotationId);

    const res = await fetch(`${BASE_URL}/api/quotations/${createdQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify({ action: 'VERIFY' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'Admin Approval Required');
  });

  test('E2E Step 8: Super Admin logs in and Approves the Quotation', async () => {
    assert.ok(createdQuotationId);

    const res = await fetch(`${BASE_URL}/api/quotations/${createdQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ action: 'APPROVE' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'Approved');
  });

  test('E2E Step 9: Sales Rep Marks Sent and logs Client Follow-Up', async () => {
    assert.ok(createdQuotationId);

    // 1. Mark Sent
    const sendRes = await fetch(`${BASE_URL}/api/quotations/${createdQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify({ action: 'MARK_SENT' })
    });
    assert.equal(sendRes.status, 200);
    const sendData = await sendRes.json();
    assert.equal(sendData.status, 'Sent');

    // 2. Log Follow-up
    const fuRes = await fetch(`${BASE_URL}/api/quotations/${createdQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify({
        action: 'LOG_FOLLOWUP',
        mode: 'Phone',
        description: 'Client confirmed procurement committee has approved the commercial proposal.'
      })
    });
    assert.equal(fuRes.status, 200);
  });

  test('E2E Step 10: Client converts quotation -> Enquiry & Quotation become Converted (Won)', async () => {
    assert.ok(createdQuotationId);

    const convertRes = await fetch(`${BASE_URL}/api/quotations/${createdQuotationId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': salesCookie },
      body: JSON.stringify({ action: 'CONVERT' })
    });
    assert.equal(convertRes.status, 200);
    const data = await convertRes.json();
    assert.equal(data.status, 'Converted');

    // Verify Invariants in Database:
    const [finalEnq, finalQuote, finalClient] = await Promise.all([
      prisma.enquiry.findUnique({
        where: { id: createdEnquiryId },
        include: { quotations: true, communicationLogs: true }
      }),
      prisma.quotation.findUnique({
        where: { id: createdQuotationId },
        include: { versions: true }
      }),
      prisma.client.findUnique({
        where: { id: createdClientId },
        include: { _count: { select: { enquiries: true, quotations: true } } }
      })
    ]);

    assert.equal(finalEnq.stage, 'Converted', 'Enquiry stage must be Converted');
    assert.equal(finalEnq.outcome, 'Open', 'Enquiry outcome must remain Open');
    assert.ok(finalEnq.communicationLogs.length >= 2, 'Must have at least 2 communication logs');
    assert.equal(finalQuote.status, 'Converted', 'Quote status must be Converted');
    assert.equal(finalClient._count.enquiries, 1);
    assert.equal(finalClient._count.quotations, 1);
  });
});
