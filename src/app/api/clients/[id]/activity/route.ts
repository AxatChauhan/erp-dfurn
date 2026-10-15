import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DAY_MS = 86400000;
const dayDiff = (a: string | Date, b: string | Date) => {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.round((d2 - d1) / DAY_MS);
};

interface CachedCompanyTotals {
  totals: Record<string, number>;
  totalValue: number;
  expiresAt: number;
}
let companyTotalsCache: CachedCompanyTotals | null = null;

async function getCompanyTotals(): Promise<{ totals: Record<string, number>; totalValue: number }> {
  const now = Date.now();
  if (companyTotalsCache && companyTotalsCache.expiresAt > now) {
    return { totals: companyTotalsCache.totals, totalValue: companyTotalsCache.totalValue };
  }

  const allJobOrders = await prisma.jobOrder.findMany({
    where: { status: { not: 'Cancelled' } },
    select: { clientId: true, grandTotal: true, exchangeRate: true }
  });

  const totals: Record<string, number> = {};
  for (const j of allJobOrders) {
    const inr = (j.grandTotal || 0) * (j.exchangeRate || 1);
    totals[j.clientId] = (totals[j.clientId] || 0) + inr;
  }
  const totalValue = Object.values(totals).reduce((s, v) => s + v, 0);

  companyTotalsCache = {
    totals,
    totalValue,
    expiresAt: now + 60000,
  };

  return { totals, totalValue };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id }
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // 1. Fetch client's enquiries, quotations, job orders, and cached company-wide rollups in parallel
    const [clientEnquiries, clientQuotations, clientJobOrders, { totals: companyTotals, totalValue: companyTotalValue }] = await Promise.all([
      prisma.enquiry.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
        include: { items: true }
      }),
      prisma.quotation.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          versions: {
            orderBy: { versionNo: 'desc' },
            take: 1
          }
        }
      }),
      prisma.jobOrder.findMany({
        where: { clientId: id },
        orderBy: { orderDate: 'desc' }
      }),
      getCompanyTotals()
    ]);

    // Format Job Orders with 7-step journey
    const jobOrders = clientJobOrders.map(j => {
      const boqLines = Array.isArray(j.boqLines) ? (j.boqLines as any[]) : [];
      const inrValue = Math.round((j.grandTotal || 0) * (j.exchangeRate || 1));

      return {
        id: j.id,
        jobNumber: j.jobNumber,
        orderTypeName: j.orderTypeName || 'Direct order',
        orderDate: j.orderDate.toISOString(),
        productionDueDate: j.productionDueDate ? j.productionDueDate.toISOString() : null,
        status: j.status || 'In Progress',
        poNumber: j.poNumber || null,
        quotationCode: j.quotationCode || null,
        currency: j.billingCurrency || 'INR',
        quotationId: j.quotationId || null,
        enquiryId: j.enquiryId || null,
        enquiryNumber: j.enquiryNumber || null,
        createdAt: j.createdAt.toISOString(),
        bomStatus: j.bomStatus || 'Pending',
        procurementStatus: j.procurementStatus || 'Pending',
        productionStatus: j.productionStatus || 'Pending',
        holdReason: j.holdReason || null,
        cancelledReason: j.cancelledReason || null,
        projectManagerName: j.projectManagerName || null,
        lines: boqLines.map(l => ({
          name: l.name || l.description || 'Product',
          quantity: Number(l.quantity) || 1,
          unit: l.unit || 'units'
        })),
        grandTotal: j.grandTotal || 0,
        rupees: inrValue,
        lineCount: boqLines.length
      };
    });

    // Format Quotations
    const quotes = clientQuotations.map(q => {
      const latestVer = q.versions[0];
      const grandTotal = latestVer?.grandTotal || q.totalAmount || 0;
      return {
        id: q.id,
        code: latestVer?.versionCode || q.quotationNumber,
        enquiryId: q.enquiryId,
        createdAt: q.createdAt.toISOString(),
        status: latestVer?.status || q.status,
        grandTotal,
        versionNo: latestVer?.versionNo || q.currentVersionNo || 1,
        approvedAt: latestVer?.approvedAt ? latestVer.approvedAt.toISOString() : null,
        sentAt: latestVer?.sentAt ? latestVer.sentAt.toISOString() : null,
        decidedAt: latestVer?.updatedAt ? latestVer.updatedAt.toISOString() : null
      };
    });

    // Format Enquiries
    const enquiries = clientEnquiries.map(e => ({
      id: e.id,
      code: e.enquiryNumber,
      createdAt: e.createdAt.toISOString(),
      stage: e.stage,
      outcome: e.outcome,
      status: e.outcome === 'Lost' ? 'Lost' : e.stage,
      salespersonName: e.salespersonName || null,
      enteredByName: e.enteredByName || null,
      lostAtStage: e.lostAtStage || null,
      lostNote: e.lostNote || e.lostReason || '',
      opportunityValue: e.estimatedBudget ?? null,
      productCount: (e.items || []).length
    }));

    // 2. Compute Insights
    const liveJobs = clientJobOrders.filter(j => j.status !== 'Cancelled');
    const lifetimeValue = Math.round(
      liveJobs.reduce((sum, j) => sum + (j.grandTotal || 0) * (j.exchangeRate || 1), 0)
    );

    const isJobOpen = (j: any) => !['Completed', 'Cancelled'].includes(j.status);
    const openOrders = clientJobOrders.filter(isJobOpen);
    const openOrderValue = Math.round(
      openOrders.reduce((sum, j) => sum + (j.grandTotal || 0) * (j.exchangeRate || 1), 0)
    );

    const dates = liveJobs.map(j => j.orderDate.toISOString().slice(0, 10)).sort();
    const firstOrderDate = dates[0] || null;
    const lastOrderDate = dates[dates.length - 1] || null;
    const today = new Date().toISOString().slice(0, 10);

    const daysSinceLastOrder = lastOrderDate ? dayDiff(lastOrderDate, today) : null;
    const averageDaysBetweenOrders =
      dates.length >= 2 ? Math.round(dayDiff(firstOrderDate!, lastOrderDate!) / (dates.length - 1)) : null;

    // Company-wide rollups for share & rank (from 60s micro-cache)
    const rankedClientsCount = Object.keys(companyTotals).length;

    const sharePct =
      companyTotalValue > 0 && lifetimeValue > 0
        ? Math.round((lifetimeValue / companyTotalValue) * 1000) / 10
        : null;

    const rank =
      lifetimeValue > 0
        ? 1 + Object.values(companyTotals).filter(v => v > lifetimeValue).length
        : null;

    // "What they buy": Product breakdown
    const productStats: Record<string, { name: string; unit: string; quantity: number; rupees: number; orderIds: Set<string> }> = {};
    liveJobs.forEach(j => {
      const lines = Array.isArray(j.boqLines) ? (j.boqLines as any[]) : [];
      lines.forEach((l: any) => {
        const name = l.name || l.description || 'Product';
        const key = name.toLowerCase();
        if (!productStats[key]) {
          productStats[key] = {
            name,
            unit: l.unit || 'units',
            quantity: 0,
            rupees: 0,
            orderIds: new Set()
          };
        }
        productStats[key].quantity += Number(l.quantity) || 1;
        productStats[key].rupees += Math.round((Number(l.lineTotal) || Number(l.quantity || 1) * 1000) * (j.exchangeRate || 1));
        productStats[key].orderIds.add(j.id);
      });
    });

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.rupees - a.rupees)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        unit: p.unit,
        quantity: p.quantity,
        rupees: p.rupees,
        orders: p.orderIds.size
      }));

    // Pipeline: Enquiry stats
    const convertedEnquiries = enquiries.filter(e => e.stage === 'Converted').length;
    const lostEnquiries = enquiries.filter(e => e.outcome === 'Lost').length;
    const decidedEnquiries = convertedEnquiries + lostEnquiries;
    const enquiryStats = {
      total: enquiries.length,
      open: enquiries.length - convertedEnquiries - lostEnquiries,
      converted: convertedEnquiries,
      lost: lostEnquiries,
      conversionPct: decidedEnquiries > 0 ? Math.round((convertedEnquiries / decidedEnquiries) * 100) : null
    };

    // Pipeline: Quotation stats
    const wonQuotes = quotes.filter(q => q.status === 'Converted' || q.status === 'CONVERTED').length;
    const lostQuotes = quotes.filter(q => q.status === 'Not Converted' || q.status === 'NOT_CONVERTED').length;
    const openQuotes = quotes.filter(q => !['Converted', 'CONVERTED', 'Not Converted', 'NOT_CONVERTED'].includes(q.status));
    const decidedQuotes = wonQuotes + lostQuotes;
    const quoteStats = {
      total: quotes.length,
      won: wonQuotes,
      lost: lostQuotes,
      open: openQuotes.length,
      winPct: decidedQuotes > 0 ? Math.round((wonQuotes / decidedQuotes) * 100) : null,
      openValue: Math.round(openQuotes.reduce((sum, q) => sum + (q.grandTotal || 0), 0))
    };

    const currencies = Array.from(new Set(liveJobs.map(j => j.billingCurrency || 'INR')));
    const salespersons = Array.from(
      new Set(
        liveJobs
          .map(j => j.salespersonName)
          .concat(enquiries.map(e => e.salespersonName))
          .filter(Boolean) as string[]
      )
    );

    const insights = {
      orders: {
        total: clientJobOrders.length,
        open: openOrders.length,
        completed: clientJobOrders.filter(j => j.status === 'Completed').length,
        cancelled: clientJobOrders.length - liveJobs.length,
        direct: liveJobs.filter(j => !j.quotationId).length
      },
      lifetimeValue,
      averageOrderValue: liveJobs.length ? Math.round(lifetimeValue / liveJobs.length) : null,
      openOrderValue,
      firstOrderDate,
      lastOrderDate,
      daysSinceLastOrder,
      averageDaysBetweenOrders,
      sharePct,
      rank,
      clientsWithOrders: rankedClientsCount,
      currencies,
      salespersons,
      clientSince: client.createdAt.toISOString().slice(0, 10),
      topProducts,
      enquiries: enquiryStats,
      quotes: quoteStats
    };

    return NextResponse.json({
      jobOrders,
      quotations: quotes,
      enquiries,
      insights
    });
  } catch (error: any) {
    console.error('Error fetching client activity:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch client activity' }, { status: 500 });
  }
}
