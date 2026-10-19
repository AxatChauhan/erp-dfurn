import { Suspense } from 'react';
import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import EnquiriesClient from './EnquiriesClient';
import { fiscalYearOf, currentFiscalYearKey } from '@/lib/dates';
import { getAuthenticatedSession } from '@/lib/auth';

async function EnquiriesDataLoader({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await connection();
  const params = await searchParams;
  const session = await getAuthenticatedSession();

  const defaultFY = currentFiscalYearKey();
  const fyFilter = params.fy || defaultFY;
  const monthFilter = params.month;
  const dateFilter = params.date;
  const salespersonFilter = params.salespersonId;
  const statusFilter = params.status;

  const where: any = {};
  if (session?.role === 'SALES') {
    where.OR = [
      ...(session.employeeId ? [{ salespersonId: session.employeeId }] : []),
      ...(session.userId ? [{ enteredById: session.userId }] : [])
    ];
  }

  const [rawEnquiries, categories, sourceCategories, employees, clients, lostReasons] =
    await Promise.all([
      prisma.enquiry.findMany({
        where,
        include: {
          client: true,
          category: true,
          salesperson: true,
          items: true,
          quotations: {
            select: {
              id: true,
              quotationNumber: true,
              status: true,
              totalAmount: true,
              createdAt: true,
              versions: {
                select: {
                  id: true,
                  versionNo: true,
                  versionCode: true,
                  status: true,
                  grossTotal: true,
                  createdAt: true,
                },
                orderBy: { versionNo: 'desc' },
                take: 1,
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          jobOrders: {
            select: {
              id: true,
              jobNumber: true,
              status: true,
              bomStatus: true,
              procurementStatus: true,
              productionStatus: true,
              holdReason: true,
              cancelledReason: true,
              productionDueDate: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          communicationLogs: {
            select: { id: true, date: true, mode: true, stage: true, description: true, loggedByName: true },
          },
          files: {
            select: { id: true, originalName: true, sizeBytes: true, stage: true, url: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.sourceCategory.findMany({ orderBy: { name: 'asc' } }),
      prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, name: true, employeeCode: true, designation: true },
        orderBy: { name: 'asc' },
      }),
      prisma.client.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          clientCode: true,
          clientType: true,
          phones: true,
          phoneDetails: true,
          emails: true,
          countryIso2: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.lostReason.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
    ]);

  const sourceCategoryMap = new Map(sourceCategories.map(s => [s.id, s.name]));

  const formattedEnquiries = rawEnquiries.map(e => {
    const bucket = e.outcome === 'Lost' ? 'Lost' : (e.stage || 'New');
    const clientPhones = Array.isArray(e.client?.phones) ? (e.client.phones as string[]) : [];
    const clientEmails = Array.isArray(e.client?.emails) ? (e.client.emails as string[]) : [];
    const latestQuote = e.quotations?.[0] || null;
    const latestJob = e.jobOrders?.[0] || null;

    return {
      id: e.id,
      code: e.enquiryNumber,
      enquiryNumber: e.enquiryNumber,
      clientId: e.clientId,
      clientName: e.client?.name || 'Unknown Client',
      clientCode: e.client?.clientCode || null,
      clientPhones,
      clientEmails,
      client: e.client ? {
        ...e.client,
        displayName: e.client.name,
        phones: clientPhones,
        emails: clientEmails,
      } : null,

      categoryId: e.categoryId,
      category: e.category,
      categoryName: e.category?.name || '',

      sourceCategoryId: e.sourceCategoryId,
      sourceCategory: e.sourceCategory,
      sourceName: e.sourceName,

      salespersonId: e.salespersonId,
      salespersonName: e.salespersonName || e.salesperson?.name || null,

      enteredById: e.enteredById,
      enteredByName: e.enteredByName,

      brief: e.brief || '',
      stage: e.stage || 'New',
      outcome: e.outcome || 'Open',
      bucket,
      status: e.status || 'NEW',
      lostAtStage: e.lostAtStage,
      lostReasonId: e.lostReasonId,
      lostReason: e.lostReason,
      lostNote: e.lostNote,
      lostAt: e.lostAt ? e.lostAt.toISOString() : null,

      opportunityValue: e.opportunityValue,
      hasCommunication: e.hasCommunication || (e.communicationLogs?.length > 0),
      stageDates: e.stageDates || {},
      origin: e.origin,
      originKey: e.originKey,
      qualifiedById: e.qualifiedById,
      qualifiedByName: e.qualifiedByName,

      items: e.items || [],
      lineItems: e.items || [],
      logs: e.communicationLogs.map(l => ({
        ...l,
        date: l.date,
      })),
      files: e.files.map(f => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
      quote: latestQuote ? {
        id: latestQuote.id,
        number: latestQuote.quotationNumber,
        status: latestQuote.status,
        effectiveStatus: latestQuote.status,
        totalAmount: latestQuote.totalAmount,
        createdAt: latestQuote.createdAt.toISOString(),
      } : null,
      jobOrder: latestJob ? {
        id: latestJob.id,
        jobNumber: latestJob.jobNumber,
        status: latestJob.status,
        bomStatus: latestJob.bomStatus,
        procurementStatus: latestJob.procurementStatus,
        productionStatus: latestJob.productionStatus,
      } : null,

      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  });

  // 1. Time Filtering
  let timeFiltered = formattedEnquiries;
  if (dateFilter) {
    timeFiltered = timeFiltered.filter(e => e.createdAt.slice(0, 10) === dateFilter);
  } else {
    if (fyFilter && fyFilter !== 'all') {
      timeFiltered = timeFiltered.filter(e => fiscalYearOf(e.createdAt).key === fyFilter);
    }
    if (monthFilter !== null && monthFilter !== undefined && monthFilter !== '') {
      const monthNum = parseInt(monthFilter, 10);
      if (!isNaN(monthNum)) {
        timeFiltered = timeFiltered.filter(e => new Date(e.createdAt).getMonth() === monthNum);
      }
    }
  }

  // 2. Salesperson Scoping
  let scoped = timeFiltered;
  if (salespersonFilter) {
    if (salespersonFilter === '__none') {
      scoped = scoped.filter(e => !e.salespersonId);
    } else {
      scoped = scoped.filter(e => e.salespersonId === salespersonFilter);
    }
  }

  // 3. KPI metrics computation
  const totalScoped = scoped.length;
  const everQualified = scoped.filter(e => e.stage !== 'New').length;
  const qualificationRate = totalScoped > 0 ? Math.round((everQualified / totalScoped) * 100) : 0;
  const totalOpportunityValue = scoped.reduce((sum, e) => sum + (e.opportunityValue || 0), 0);

  const categoryCounts: Record<string, number> = {};
  scoped.forEach(e => {
    if (e.categoryName) categoryCounts[e.categoryName] = (categoryCounts[e.categoryName] || 0) + 1;
  });
  let topCategoryName = '–';
  let topCategoryCount = 0;
  Object.entries(categoryCounts).forEach(([name, count]) => {
    if (count > topCategoryCount) {
      topCategoryName = name;
      topCategoryCount = count;
    }
  });

  const sourceCounts: Record<string, number> = {};
  scoped.forEach(e => {
    const sName = e.sourceCategoryId ? (sourceCategoryMap.get(e.sourceCategoryId) || e.sourceCategory) : (e.sourceCategory || e.sourceName);
    if (sName) sourceCounts[sName] = (sourceCounts[sName] || 0) + 1;
  });
  let topSourceName = '–';
  let topSourceCount = 0;
  Object.entries(sourceCounts).forEach(([name, count]) => {
    if (count > topSourceCount) {
      topSourceName = name;
      topSourceCount = count;
    }
  });

  // Tallies
  const tallies = {
    all: totalScoped,
    New: scoped.filter(e => e.bucket === 'New').length,
    Qualified: scoped.filter(e => e.bucket === 'Qualified').length,
    Quoted: scoped.filter(e => e.bucket === 'Quoted').length,
    Converted: scoped.filter(e => e.bucket === 'Converted').length,
    Lost: scoped.filter(e => e.bucket === 'Lost').length,
  };

  // Status Filter
  let finalEnquiries = scoped;
  if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
    finalEnquiries = finalEnquiries.filter(e => e.bucket === statusFilter);
  }

  const kpis = {
    qualificationRate,
    qualificationRateFormatted: totalScoped ? `${qualificationRate}%` : '–',
    totalInView: totalScoped,
    totalOpportunityValue,
    topCategoryName,
    topCategoryCount,
    topSourceName,
    topSourceCount,
  };

  const salespersonsFormatted = employees.map(emp => ({
    id: emp.id,
    name: emp.name,
    employeeCode: emp.employeeCode,
    role: emp.designation,
  }));

  const clientsFormatted = clients.map(c => ({
    id: c.id,
    name: c.name,
    displayName: c.name,
    phones: Array.isArray(c.phones) ? (c.phones as string[]) : [],
    phoneDetails: Array.isArray(c.phoneDetails) ? c.phoneDetails : [],
    emails: Array.isArray(c.emails) ? (c.emails as string[]) : [],
    countryIso2: c.countryIso2 || 'IN',
  }));

  return (
    <EnquiriesClient
      initialEnquiries={finalEnquiries}
      initialKpis={kpis}
      initialTallies={tallies}
      categories={categories}
      sourceCategories={sourceCategories}
      salespersons={salespersonsFormatted}
      clients={clientsFormatted}
      lostReasons={lostReasons}
    />
  );
}

export default function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '32px', textAlign: 'center', color: '#8B8778', fontSize: 14 }}>
          Loading enquiries...
        </div>
      }
    >
      <EnquiriesDataLoader searchParams={searchParams} />
    </Suspense>
  );
}
