import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || 'https://optimistic-carson-one.vercel.app';

interface AuditCheck {
  title: string;
  category: 'Referential' | 'Monotonic' | 'Commercial Math' | 'Owner Mandates' | 'API Sync';
  passed: boolean;
  details: string;
}

async function runAudit() {
  console.log('\n============================================================');
  console.log(" 🔍 D'furn Modular Systems ERP - Tri-Module Sync Audit");
  console.log(` Target Environment: ${BASE_URL}`);
  console.log('============================================================\n');

  const checks: AuditCheck[] = [];

  // 1. Fetch Counts & Relations
  const [clients, enquiries, quotations] = await Promise.all([
    prisma.client.findMany({
      include: {
        _count: { select: { enquiries: true, quotations: true } },
        enquiries: true,
        quotations: true
      }
    }),
    prisma.enquiry.findMany({
      include: {
        client: true,
        items: true,
        quotations: { include: { versions: { include: { items: true, additionalCharges: true } } } }
      }
    }),
    prisma.quotation.findMany({
      include: {
        client: true,
        enquiry: true,
        versions: {
          include: {
            items: true,
            additionalCharges: true
          }
        }
      }
    })
  ]);

  console.log(`📊 Current Database Snapshot:`);
  console.log(`   • Clients:    ${clients.length}`);
  console.log(`   • Enquiries:  ${enquiries.length}`);
  console.log(`   • Quotations: ${quotations.length}\n`);

  // ------------------------------------------------------------------
  // CHECK 1: REFERENTIAL INTEGRITY & CLIENT LEAKAGE
  // ------------------------------------------------------------------
  let leakageCount = 0;
  for (const q of quotations) {
    if (q.enquiry && q.clientId !== q.enquiry.clientId) {
      leakageCount++;
    }
  }
  checks.push({
    title: 'Referential Linkage (Zero Cross-Client Leakage)',
    category: 'Referential',
    passed: leakageCount === 0,
    details: leakageCount === 0 
      ? `All ${quotations.length} quotations point strictly to their parent enquiry's client.`
      : `CRITICAL: ${leakageCount} quotations reference a mismatched client!`
  });

  // ------------------------------------------------------------------
  // CHECK 2: MONOTONIC STAGE PROGRESSION
  // ------------------------------------------------------------------
  let stageAnomalies = 0;
  for (const e of enquiries) {
    if (e.stage === 'New' && e.quotations.length > 0) stageAnomalies++;
    if (e.stage === 'Quoted' && e.quotations.length === 0) stageAnomalies++;
    if (e.stage === 'Converted' && !e.quotations.some(q => q.status === 'Converted')) stageAnomalies++;
  }
  checks.push({
    title: 'Monotonic Stage Progression (New -> Qualified -> Quoted -> Converted)',
    category: 'Monotonic',
    passed: stageAnomalies === 0,
    details: stageAnomalies === 0
      ? `All ${enquiries.length} enquiries obey stage monotonic invariants.`
      : `Found ${stageAnomalies} enquiries violating stage invariants.`
  });

  // ------------------------------------------------------------------
  // CHECK 3: COMMERCIAL ARITHMETIC PRECISION (18% GST)
  // ------------------------------------------------------------------
  let mathErrors = 0;
  for (const q of quotations) {
    for (const v of q.versions) {
      const gross = v.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice) - Number(item.discountAmount || 0)), 0);
      const extra = v.additionalCharges.reduce((sum, c) => sum + Number(c.amount), 0);
      const taxable = gross - Number(v.overallDiscountAmt || 0) + extra;
      const expectedGst = Math.round(taxable * (Number(v.gstRatePct || 18.0) / 100));
      const expectedGrand = taxable + expectedGst;

      if (Math.round(v.grossTotal) !== Math.round(gross) || 
          Math.round(v.gstAmount) !== expectedGst || 
          Math.round(v.grandTotal) !== expectedGrand) {
        mathErrors++;
      }
    }
  }
  checks.push({
    title: 'Commercial Arithmetic Precision (Items -> Gross -> 18% GST -> Grand Total)',
    category: 'Commercial Math',
    passed: mathErrors === 0,
    details: mathErrors === 0
      ? `All quotation versions verified mathematically down to the rupee.`
      : `Found ${mathErrors} quotation versions with arithmetic variance!`
  });

  // ------------------------------------------------------------------
  // CHECK 4: OWNER MANDATES (ZERO EM DASHES & L B H DIMENSIONS)
  // ------------------------------------------------------------------
  let emDashViolations = 0;
  let dimensionViolations = 0;

  for (const c of clients) {
    if (c.name.includes('—') || (c.companyName && c.companyName.includes('—'))) emDashViolations++;
  }
  for (const e of enquiries) {
    if (e.brief && e.brief.includes('—')) emDashViolations++;
    if (e.notes && e.notes.includes('—')) emDashViolations++;
    for (const item of e.items) {
      if (item.dimensions && !/L\s+\d+.*B\s+\d+.*H\s+\d+.*mm/i.test(item.dimensions)) {
        dimensionViolations++;
      }
    }
  }
  checks.push({
    title: 'Owner Mandate: Zero "Them" Dashes (—) in Text',
    category: 'Owner Mandates',
    passed: emDashViolations === 0,
    details: emDashViolations === 0
      ? `Zero em dashes found across all client and enquiry text.`
      : `Found ${emDashViolations} em dashes violating owner mandate.`
  });
  checks.push({
    title: 'Owner Mandate: Line Item Dimensions Format (L B H in mm)',
    category: 'Owner Mandates',
    passed: dimensionViolations === 0,
    details: dimensionViolations === 0
      ? `All item dimensions follow 'L ... × B ... × H ... mm'.`
      : `Found ${dimensionViolations} non-compliant dimension entries.`
  });

  // ------------------------------------------------------------------
  // DISPLAY RESULTS
  // ------------------------------------------------------------------
  console.log('📋 Tri-Module Audit Results:');
  let allPassed = true;

  for (const check of checks) {
    const symbol = check.passed ? '✅' : '❌';
    console.log(`  ${symbol} [${check.category}] ${check.title}`);
    console.log(`     ${check.details}\n`);
    if (!check.passed) allPassed = false;
  }

  console.log('============================================================');
  if (allPassed) {
    console.log('🎉 [SYNC COMPLETE] 100% of Tri-Module Invariants Are Healthy!');
  } else {
    console.log('⚠️ [SYNC WARNING] Found data anomalies. Please inspect above.');
    process.exitCode = 1;
  }
  console.log('============================================================\n');
}

runAudit()
  .catch((err) => {
    console.error('Audit failed with error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
