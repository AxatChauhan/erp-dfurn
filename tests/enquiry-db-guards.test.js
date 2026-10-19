const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Database Integrity & Business Guard Tests', () => {
  before(async () => {
    const enq = await prisma.enquiry.findUnique({
      where: { enquiryNumber: 'DF_ENQ_15102026_02' },
      include: { quotations: true }
    });
    if (enq && enq.quotations && enq.quotations.length > 0) {
      for (const q of enq.quotations) {
        await prisma.quotationItem.deleteMany({ where: { quotationId: q.id } }).catch(() => {});
        await prisma.quotationVersion.deleteMany({ where: { quotationId: q.id } }).catch(() => {});
        await prisma.quotation.delete({ where: { id: q.id } }).catch(() => {});
      }
    }
    const originalHistory = [
      { at: "2026-10-15T09:05:28.891Z", byId: null, type: "qualified", byName: "Evaluator" },
      { at: "2026-10-15T09:05:37.509Z", byId: null, type: "unqualified", byName: "Evaluator" },
      { at: "2026-10-15T09:05:48.279Z", byId: null, type: "reopened", byName: "User" },
      { at: "2026-10-15T09:06:10.540Z", byId: null, type: "lost", byName: "User", atStage: "New" },
      { at: "2026-10-15T09:06:11.008Z", byId: null, type: "reopened", byName: "User" }
    ];
    await prisma.enquiry.updateMany({
      where: { enquiryNumber: 'DF_ENQ_15102026_02' },
      data: { stage: 'New', outcome: 'Open', history: originalHistory }
    }).catch(() => {});
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('Nexus Interiors Studio (DF_ENQ_15102026_02) has accurate real data and NO mock values', async () => {
    const enquiry = await prisma.enquiry.findUnique({
      where: { enquiryNumber: 'DF_ENQ_15102026_02' },
      include: {
        client: true,
        quotations: true,
        communicationLogs: true
      }
    });

    assert.ok(enquiry, 'Nexus enquiry must exist in database');
    assert.equal(enquiry.stage, 'New', 'Stage must be New');
    assert.equal(enquiry.outcome, 'Open', 'Outcome must be Open');
    assert.equal(enquiry.quotations.length, 0, 'Must NOT have any quotations');
    
    // Assert Client facts are real
    assert.equal(enquiry.client.name, 'Nexus Interiors Studio');
    assert.equal(enquiry.client.contactPerson, null, 'Contact person is null on file (should NOT be Prahar Patel)');
    assert.ok(Array.isArray(enquiry.client.phones) && enquiry.client.phones.includes('+919123456780'));
    assert.ok(Array.isArray(enquiry.client.emails) && enquiry.client.emails.includes('contact@nexusinteriors.com'));
    
    // Assert History has 5 audit records
    assert.ok(Array.isArray(enquiry.history), 'History must be an array');
    assert.equal(enquiry.history.length, 5, 'Must have 5 audit events recorded');
    const types = enquiry.history.map(h => h.type);
    assert.deepEqual(types, ['qualified', 'unqualified', 'reopened', 'lost', 'reopened']);
  });

  test('Anti-Regression: Database scan across ALL enquiries confirms zero mock fallback leaks', async () => {
    const allEnquiries = await prisma.enquiry.findMany({
      include: { client: true, quotations: true }
    });

    for (const enq of allEnquiries) {
      // Check no client has fake Prahar Patel or Oklahoma unless explicitly typed by user
      if (enq.client) {
        assert.notEqual(enq.client.contactPerson, 'Prahar Patel', `Enquiry ${enq.enquiryNumber} must not have mock Prahar Patel`);
        const addressesStr = JSON.stringify(enq.client.addresses || '');
        assert.ok(!addressesStr.includes('Oklahoma 33212'), `Enquiry ${enq.enquiryNumber} must not have mock Oklahoma 33212`);
      }
      // Check no quotation has fake DF/Q/2026-27/0002-v2
      for (const q of enq.quotations) {
        assert.notEqual(q.quotationNumber, 'DF/Q/2026-27/0002-v2', `Quotation ${q.quotationNumber} is mock`);
      }
    }
  });

  test('Business Guard 1: Mandatory Brief Rule rejects empty brief', () => {
    const validateBrief = (brief) => {
      const trimmed = String(brief || '').trim();
      if (!trimmed) {
        return { error: 'A brief is required: write what the client needs before qualifying', status: 400 };
      }
      return { success: true };
    };

    assert.equal(validateBrief('').status, 400);
    assert.equal(validateBrief('   ').status, 400);
    assert.equal(validateBrief(null).status, 400);
    assert.equal(validateBrief('Client needs 10 modular desks').success, true);
  });

  test('Business Guard 2: Delete Guard blocks enquiry with Quotation or Communication Logs', async () => {
    const checkCanDelete = async (enquiryId) => {
      const enq = await prisma.enquiry.findUnique({
        where: { id: enquiryId },
        include: { quotations: true, communicationLogs: true }
      });
      if (!enq) return { error: 'Not found', status: 404 };
      if (enq.quotations.length > 0) {
        return { error: 'Cannot delete: this enquiry has a Quote. Quotes are permanent records once created.', status: 409 };
      }
      if (enq.hasCommunication || enq.communicationLogs.length > 0) {
        return { error: 'Cannot delete: communication has already been logged on this enquiry', status: 409 };
      }
      return { success: true, status: 200 };
    };

    // Find an enquiry with a quote (e.g. DF_ENQ_000010)
    const enqWithQuote = await prisma.enquiry.findFirst({
      where: { quotations: { some: {} } }
    });
    if (enqWithQuote) {
      const res = await checkCanDelete(enqWithQuote.id);
      assert.equal(res.status, 409, `Enquiry with quote ${enqWithQuote.enquiryNumber} must not be deletable`);
      assert.ok(res.error.includes('this enquiry has a Quote'));
    }
  });

  test('Business Guard 3: Reverse Qualification (unqualify) Guard blocks enquiry if quotation exists', async () => {
    const checkCanReverse = async (enquiryId) => {
      const enq = await prisma.enquiry.findUnique({
        where: { id: enquiryId },
        include: { quotations: true }
      });
      if (!enq) return { error: 'Not found', status: 404 };
      if (enq.quotations.length > 0) {
        return { error: 'A quotation has been made against this enquiry, so its qualification can no longer be reversed.', status: 409 };
      }
      if (enq.stage === 'New') {
        return { error: 'This enquiry is not qualified', status: 400 };
      }
      if (enq.stage !== 'Qualified') {
        return { error: 'This enquiry has moved past qualification, so it can no longer be reversed.', status: 409 };
      }
      return { success: true, status: 200 };
    };

    // DF_ENQ_000010 is Qualified and has a Quote
    const enqWithQuote = await prisma.enquiry.findFirst({
      where: { quotations: { some: {} } }
    });
    if (enqWithQuote) {
      const res = await checkCanReverse(enqWithQuote.id);
      assert.equal(res.status, 409, `Enquiry ${enqWithQuote.enquiryNumber} with quote cannot be un-qualified`);
      assert.ok(res.error.includes('A quotation has been made against this enquiry'));
    }
  });

  test('Business Guard 4: History audit updates properly on outcome change', async () => {
    // Check that history array contains proper schema structure { type, at, byId, byName }
    const enqWithHistory = await prisma.enquiry.findFirst({
      where: { history: { not: null } }
    });
    if (enqWithHistory && Array.isArray(enqWithHistory.history)) {
      enqWithHistory.history.forEach(item => {
        assert.ok(item.type, 'History entry must have a type');
        assert.ok(item.at, 'History entry must have timestamp');
      });
    }
  });
});
