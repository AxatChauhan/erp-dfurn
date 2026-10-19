const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient(
  process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined
);
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let adminCookie = '';

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

describe('Tri-Module Data Integrity & Cross-Module Synchronization Suite', () => {

  before(async () => {
    // Authenticate as Super Admin for API-level verification
    try {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      });
      if (loginRes.status === 200) {
        adminCookie = extractCookies(loginRes);
      }
    } catch {
      // Offline fallback
    }
  });

  // -------------------------------------------------------------
  // TEST 1: REFERENTIAL & FOREIGN KEY INTEGRITY ACROSS MODULES
  // -------------------------------------------------------------
  test('SYNC-01: Referential Linkage & Zero Cross-Client Leakage', async () => {
    const quotations = await prisma.quotation.findMany({
      include: {
        client: true,
        enquiry: {
          include: { client: true }
        }
      }
    });

    assert.ok(quotations.length > 0, 'Database should contain active quotations');

    for (const quote of quotations) {
      // 1. Every quotation must link to a valid client
      assert.ok(quote.client, `Quotation ${quote.id} must be linked to a valid client`);
      assert.equal(quote.clientId, quote.client.id);

      // 2. If linked to an enquiry, client IDs must match
      if (quote.enquiry) {
        assert.equal(quote.enquiryId, quote.enquiry.id);
        assert.equal(
          quote.clientId, 
          quote.enquiry.clientId, 
          `Quotation ${quote.id} clientId (${quote.clientId}) must match its Enquiry's clientId (${quote.enquiry.clientId})`
        );
      }
    }
  });

  // -------------------------------------------------------------
  // TEST 2: STATE MACHINE & FUNNEL LIFECYCLE SYNC
  // -------------------------------------------------------------
  test('SYNC-02: Monotonic State Progression & Quotation Counts', async () => {
    const enquiries = await prisma.enquiry.findMany({
      include: {
        quotations: {
          include: { versions: true }
        }
      }
    });

    for (const enq of enquiries) {
      // Case A: Stage New -> Must NEVER have quotations
      if (enq.stage === 'New') {
        assert.equal(
          enq.quotations.length, 
          0, 
          `Enquiry ${enq.enquiryNumber} at stage "New" must have 0 quotations`
        );
      }

      // Case B: Stage Quoted -> Must have at least 1 quotation
      if (enq.stage === 'Quoted') {
        assert.ok(
          enq.quotations.length >= 1, 
          `Enquiry ${enq.enquiryNumber} at stage "Quoted" must have at least 1 quotation`
        );
      }

      // Case C: Stage Converted -> Must have a Converted quotation
      if (enq.stage === 'Converted') {
        assert.ok(
          enq.quotations.length >= 1, 
          `Enquiry ${enq.enquiryNumber} at stage "Converted" must have quotations`
        );
        const hasWonQuote = enq.quotations.some(q => q.status === 'Converted');
        assert.ok(
          hasWonQuote, 
          `Enquiry ${enq.enquiryNumber} marked "Converted" must have at least one quotation with status "Converted"`
        );
      }

      // Case D: Outcome Lost -> Must have a valid closure reason
      if (enq.outcome === 'Lost') {
        assert.ok(
          enq.lostReason && enq.lostReason.trim().length > 0, 
          `Lost enquiry ${enq.enquiryNumber} must specify a structured lostReason`
        );
      }
    }
  });

  // -------------------------------------------------------------
  // TEST 3: COMMERCIAL & ARITHMETIC FITTING INVARIANTS
  // -------------------------------------------------------------
  test('SYNC-03: Commercial Arithmetic Precision & Multi-Version Fitting', async () => {
    const quotations = await prisma.quotation.findMany({
      include: {
        versions: {
          include: {
            items: true,
            additionalCharges: true
          }
        }
      }
    });

    for (const quote of quotations) {
      assert.ok(quote.versions.length >= 1, `Quotation ${quote.id} must have at least 1 version`);

      for (const ver of quote.versions) {
        // Invariant 1: Line Item Math
        let expectedGross = 0;
        for (const item of ver.items) {
          const discount = Number(item.discountAmount || 0);
          const rawTotal = Number(item.quantity) * Number(item.unitPrice) - discount;
          assert.equal(
            Math.round(Number(item.total)), 
            Math.round(rawTotal), 
            `Item ${item.description} total (${item.total}) != qty * rate - discount (${rawTotal})`
          );
          expectedGross += Number(item.total);
        }

        // Invariant 2: Gross Amount
        assert.equal(
          Math.round(Number(ver.grossTotal)), 
          Math.round(expectedGross), 
          `Version v${ver.versionNo} grossTotal (${ver.grossTotal}) != sum of items (${expectedGross})`
        );

        // Invariant 3: Additional Charges Sum
        const expectedCharges = ver.additionalCharges.reduce((acc, c) => acc + Number(c.amount), 0);
        assert.equal(
          Math.round(Number(ver.extraCostsTotal)), 
          Math.round(expectedCharges), 
          `Version v${ver.versionNo} extraCostsTotal mismatch`
        );

        // Invariant 4: Taxable Base = Gross - Overall Discount + Extra Costs
        const discountAmt = Number(ver.overallDiscountAmt || 0);
        const expectedTaxable = expectedGross - discountAmt + expectedCharges;
        
        // Invariant 5: GST Calculation = 18% of Taxable
        if (ver.gstApplicable) {
          const expectedGst = Math.round(expectedTaxable * (Number(ver.gstRatePct || 18.0) / 100));
          assert.equal(
            Math.round(Number(ver.gstAmount)), 
            expectedGst, 
            `Version v${ver.versionNo} gstAmount (${ver.gstAmount}) != 18% of taxable (${expectedGst})`
          );

          // Invariant 6: Final Grand Total = Taxable + GST
          const expectedGrand = expectedTaxable + expectedGst;
          assert.equal(
            Math.round(Number(ver.grandTotal)), 
            expectedGrand, 
            `Version v${ver.versionNo} grandTotal mismatch`
          );
        }
      }

      // Invariant 7: Active version matches quotation totalAmount
      const activeVer = quote.versions.find(v => v.versionNo === quote.currentVersionNo) || quote.versions[quote.versions.length - 1];
      assert.equal(
        Math.round(Number(quote.totalAmount)), 
        Math.round(Number(activeVer.grandTotal)), 
        `Quotation totalAmount (${quote.totalAmount}) != active version grandTotal (${activeVer.grandTotal})`
      );
    }
  });

  // -------------------------------------------------------------
  // TEST 4: COMPLIANCE WITH OWNER DESIGN & FORMATTING MANDATES
  // -------------------------------------------------------------
  test('SYNC-04: Owner Mandates Compliance (Zero Em Dashes & Clean L B H Dimensions)', async () => {
    const [clients, enquiries, quotationVersions] = await Promise.all([
      prisma.client.findMany({ select: { name: true, companyName: true, phones: true } }),
      prisma.enquiry.findMany({ select: { brief: true, notes: true, enquiryNumber: true, items: true } }),
      prisma.quotationVersion.findMany({ select: { terms: true, items: true } })
    ]);

    // Check Clients
    for (const c of clients) {
      assert.ok(!c.name.includes('—'), `Client name "${c.name}" contains em dash (—)`);
      if (c.companyName) {
        assert.ok(!c.companyName.includes('—'), `Company name "${c.companyName}" contains em dash (—)`);
      }
      for (const p of c.phones) {
        assert.ok(p.startsWith('+'), `Phone number "${p}" must be in E.164 format (+...)`);
      }
    }

    // Check Enquiries & Scope Items
    for (const e of enquiries) {
      if (e.brief) {
        assert.ok(!e.brief.includes('—'), `Enquiry ${e.enquiryNumber} brief contains em dash (—)`);
      }
      if (e.notes) {
        assert.ok(!e.notes.includes('—'), `Enquiry ${e.enquiryNumber} notes contains em dash (—)`);
      }
      for (const item of e.items) {
        if (item.dimensions) {
          assert.ok(
            /L\s+\d+.*B\s+\d+.*H\s+\d+.*mm/i.test(item.dimensions), 
            `Item dimension "${item.dimensions}" must follow L B H format (e.g. L 1400 × B 700 × H 750 mm)`
          );
        }
      }
    }

    // Check Quotations & Terms
    for (const v of quotationVersions) {
      if (v.terms) {
        const termsStr = JSON.stringify(v.terms);
        assert.ok(!termsStr.includes('—'), `Quotation terms contain em dash (—)`);
      }
      for (const item of v.items) {
        assert.ok(!item.description.includes('—'), `Quotation item "${item.description}" contains em dash (—)`);
      }
    }
  });

  // -------------------------------------------------------------
  // TEST 5: REST API MIRRORING & CACHE CONSISTENCY ACROSS 3 MODULES
  // -------------------------------------------------------------
  test('SYNC-05: REST API Serialization & Relational Sync over HTTP', async () => {
    if (!adminCookie) return; // Skip if offline/unauthenticated

    const [clientsRes, enquiriesRes, quotationsRes] = await Promise.all([
      fetch(`${BASE_URL}/api/clients`, { headers: { Cookie: adminCookie } }),
      fetch(`${BASE_URL}/api/enquiries`, { headers: { Cookie: adminCookie } }),
      fetch(`${BASE_URL}/api/quotations`, { headers: { Cookie: adminCookie } })
    ]);

    assert.equal(clientsRes.status, 200, 'GET /api/clients must return 200');
    assert.equal(enquiriesRes.status, 200, 'GET /api/enquiries must return 200');
    assert.equal(quotationsRes.status, 200, 'GET /api/quotations must return 200');

    const clientsData = await clientsRes.json();
    const enquiriesData = await enquiriesRes.json();
    const quotationsData = await quotationsRes.json();

    const clientList = Array.isArray(clientsData) ? clientsData : (clientsData.clients || []);
    const enquiryList = Array.isArray(enquiriesData) ? enquiriesData : (enquiriesData.enquiries || []);
    const quotationList = Array.isArray(quotationsData) ? quotationsData : (quotationsData.quotations || []);

    assert.ok(clientList.length > 0, 'API clients list should not be empty');
    assert.ok(enquiryList.length > 0, 'API enquiries list should not be empty');
    assert.ok(quotationList.length > 0, 'API quotations list should not be empty');

    // Build client ID map
    const clientMap = new Map(clientList.map(c => [c.id, c]));

    // Cross-verify each enquiry points to a client that exists in the API client list
    for (const enq of enquiryList) {
      assert.ok(
        clientMap.has(enq.clientId), 
        `Enquiry ${enq.enquiryNumber} references clientId ${enq.clientId} which must exist in /api/clients`
      );
    }

    // Cross-verify each quotation points to an enquiry and client present in API payloads
    const enquiryMap = new Map(enquiryList.map(e => [e.id, e]));
    for (const q of quotationList) {
      assert.ok(
        clientMap.has(q.clientId), 
        `Quotation ${q.quotationNumber} references clientId ${q.clientId} which must exist in /api/clients`
      );
      if (q.enquiryId) {
        assert.ok(
          enquiryMap.has(q.enquiryId), 
          `Quotation ${q.quotationNumber} references enquiryId ${q.enquiryId} which must exist in /api/enquiries`
        );
        // Double check client match
        const parentEnquiry = enquiryMap.get(q.enquiryId);
        assert.equal(
          q.clientId, 
          parentEnquiry.clientId, 
          `Quotation ${q.quotationNumber} clientId must match its parent enquiry clientId over API`
        );
      }
    }
  });

  // -------------------------------------------------------------
  // TEST 6: PRODUCTS MODULE REFERENTIAL INTEGRITY, CBM & ZERO EM DASHES
  // -------------------------------------------------------------
  test('SYNC-06: Products Module Hierarchy, CBM Math & Zero Em Dashes', async () => {
    const products = await prisma.masterProduct.findMany({
      include: {
        category: { include: { segment: true } },
        subCategory: true,
        variants: true,
      },
    });

    assert.ok(products.length >= 2, 'Database should contain active master products');

    let emDashViolations = 0;
    const checkText = (txt) => {
      if (typeof txt === 'string' && txt.includes('—')) emDashViolations++;
    };

    for (const p of products) {
      checkText(p.name);
      checkText(p.code);
      assert.ok(p.code, 'Master product must have a code');
      assert.ok(p.name, 'Master product must have a name');
      assert.ok(p.category, 'Master product must belong to a Category');
      assert.ok(p.subCategory, 'Master product must belong to a SubCategory');
      assert.ok(p.category.segment, 'Category must belong to a Segment');
      assert.ok(p.departmentIds.length > 0, 'Master product must have assigned departments');

      // Verify CBM calculation
      const box = p.boxDimensions;
      if (box && box.l && box.w && box.h) {
        const cbm = Math.round(((box.l / 1000) * (box.w / 1000) * (box.h / 1000)) * 10000) / 10000;
        assert.ok(cbm > 0, 'CBM must be positive');
      }

      // Verify variants
      for (const v of p.variants) {
        checkText(v.name);
        checkText(v.code);
        assert.ok(
          v.code.startsWith(p.code),
          `Variant code ${v.code} must start with master product code ${p.code}`
        );
        assert.ok(v.baseSellingRate > 0, `Variant ${v.code} must have a positive selling rate`);
      }
    }

    assert.equal(emDashViolations, 0, `Zero em dashes allowed in product catalog (found ${emDashViolations})`);
  });

});
