import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { findCountry, DEFAULT_COUNTRY_ISO2 } from '@/lib/countries';
import { fiscalYearOf, currentFiscalYearKey, todayCodeDate } from '@/lib/dates';
import { generateNextClientCode } from '@/app/api/clients/route';

/**
 * Generate sequential daily enquiry code: DF_ENQ_DDMMYYYY_NN
 * Resets each calendar day.
 */
async function generateNextEnquiryCode(): Promise<string> {
  const dateStr = todayCodeDate();
  const prefix = `DF_ENQ_${dateStr}_`;

  const latestToday = await prisma.enquiry.findFirst({
    where: { enquiryNumber: { startsWith: prefix } },
    orderBy: { enquiryNumber: 'desc' },
    select: { enquiryNumber: true }
  });

  let nextSeq = 1;
  if (latestToday?.enquiryNumber) {
    const parts = latestToday.enquiryNumber.split('_');
    const lastPart = parts[parts.length - 1];
    const parsed = parseInt(lastPart, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase();
    const statusFilter = searchParams.get('status') || searchParams.get('stage');
    const fyFilter = searchParams.get('fy');
    const monthFilter = searchParams.get('month');
    const dateFilter = searchParams.get('date');
    const salespersonFilter = searchParams.get('salespersonId');

    const rawEnquiries = await prisma.enquiry.findMany({
      include: {
        client: {
          select: {
            id: true,
            name: true,
            clientCode: true,
            clientType: true,
            contactPerson: true,
            phones: true,
            phoneDetails: true,
            emails: true,
            addresses: true,
            country: true,
            countryIso2: true,
          }
        },
        category: {
          select: { id: true, name: true, code: true }
        },
        salesperson: {
          select: { id: true, name: true, employeeCode: true, designation: true }
        },
        items: true,
        quotations: {
          select: {
            id: true,
            quotationNumber: true,
            status: true,
            totalAmount: true,
            currentVersionNo: true,
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
              take: 1
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
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
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        communicationLogs: {
          select: { id: true, date: true, mode: true, stage: true, description: true, loggedByName: true }
        },
        files: {
          select: { id: true, originalName: true, sizeBytes: true, stage: true, url: true, createdAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Resolve source categories for topSource metric
    const sourceCategories = await prisma.sourceCategory.findMany();
    const sourceCategoryMap = new Map(sourceCategories.map(s => [s.id, s.name]));

    // Format enquiry records
    const formatted = rawEnquiries.map(e => {
      const bucket = e.outcome === 'Lost' ? 'Lost' : (e.stage || 'New');
      const latestQuote = e.quotations?.[0] || null;
      const latestJob = e.jobOrders?.[0] || null;

      // Extract client phones/emails
      const clientPhones = Array.isArray(e.client?.phones) ? (e.client.phones as string[]) : [];
      const clientEmails = Array.isArray(e.client?.emails) ? (e.client.emails as string[]) : [];

      return {
        id: e.id,
        code: e.enquiryNumber,
        enquiryNumber: e.enquiryNumber,
        clientId: e.clientId,
        client: e.client ? {
          ...e.client,
          displayName: e.client.name,
          phones: clientPhones,
          emails: clientEmails,
        } : null,
        clientName: e.client?.name || 'Unknown Client',
        clientCode: e.client?.clientCode || null,
        clientPhones,
        clientEmails,

        categoryId: e.categoryId,
        category: e.category,
        categoryName: e.category?.name || '',

        sourceCategoryId: e.sourceCategoryId,
        sourceCategory: e.sourceCategory,
        sourceName: e.sourceName,

        salespersonId: e.salespersonId,
        salespersonName: e.salespersonName || e.salesperson?.name || null,
        salesperson: e.salesperson,

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
        lostAt: e.lostAt,

        opportunityValue: e.opportunityValue,
        hasCommunication: e.hasCommunication || (e.communicationLogs?.length > 0),
        stageDates: e.stageDates || {},
        origin: e.origin,
        originKey: e.originKey,
        qualifiedById: e.qualifiedById,
        qualifiedByName: e.qualifiedByName,
        history: e.history || [],

        items: e.items || [],
        lineItems: e.items || [],
        logs: e.communicationLogs || [],
        files: e.files || [],
        quote: latestQuote ? {
          id: latestQuote.id,
          quotationNumber: latestQuote.quotationNumber,
          number: latestQuote.quotationNumber,
          status: latestQuote.status,
          effectiveStatus: latestQuote.status,
          totalAmount: latestQuote.totalAmount,
          createdAt: latestQuote.createdAt,
          currentVersion: latestQuote.versions?.[0] ? {
            versionNo: latestQuote.versions[0].versionNo,
            versionCode: latestQuote.versions[0].versionCode,
            versionLabel: latestQuote.versions[0].versionCode,
            totals: { grandTotal: latestQuote.versions[0].grossTotal }
          } : { versionNo: 1, versionCode: 'v1', versionLabel: 'v1', totals: { grandTotal: latestQuote.totalAmount } }
        } : null,
        jobOrder: latestJob ? {
          id: latestJob.id,
          jobNumber: latestJob.jobNumber,
          status: latestJob.status,
          bomStatus: latestJob.bomStatus,
          procurementStatus: latestJob.procurementStatus,
          productionStatus: latestJob.productionStatus,
          holdReason: latestJob.holdReason,
          cancelledReason: latestJob.cancelledReason,
          productionDueDate: latestJob.productionDueDate,
          createdAt: latestJob.createdAt
        } : null,

        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      };
    });

    // 1. Time Filtering (FY, Month, exact Date)
    let timeFiltered = formatted;
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

    // 2. Salesperson Scoping (applies to KPIs and tallies)
    let scoped = timeFiltered;
    if (salespersonFilter) {
      if (salespersonFilter === '__none') {
        scoped = scoped.filter(e => !e.salespersonId);
      } else {
        scoped = scoped.filter(e => e.salespersonId === salespersonFilter);
      }
    }

    // 3. Compute 4 Time-Scoped KPI Metrics
    const totalScoped = scoped.length;
    const everQualified = scoped.filter(e => e.stage !== 'New').length;
    const qualificationRate = totalScoped > 0 ? Math.round((everQualified / totalScoped) * 100) : 0;
    const totalOpportunityValue = scoped.reduce((sum, e) => sum + (e.opportunityValue || 0), 0);
    const openOpportunityValue = scoped
      .filter(e => e.outcome !== 'Lost' && (e.stage === 'New' || e.stage === 'Qualified' || e.stage === 'Quoted'))
      .reduce((sum, e) => sum + (e.opportunityValue || 0), 0);

    // Top Category
    const categoryCounts: Record<string, number> = {};
    scoped.forEach(e => {
      const name = e.categoryName;
      if (name) categoryCounts[name] = (categoryCounts[name] || 0) + 1;
    });
    let topCategoryName = '–';
    let topCategoryCount = 0;
    Object.entries(categoryCounts).forEach(([name, count]) => {
      if (count > topCategoryCount) {
        topCategoryName = name;
        topCategoryCount = count;
      }
    });

    // Top Source
    const sourceCounts: Record<string, number> = {};
    scoped.forEach(e => {
      const sourceName = e.sourceCategoryId ? (sourceCategoryMap.get(e.sourceCategoryId) || e.sourceCategory) : (e.sourceCategory || e.sourceName);
      if (sourceName) sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
    });
    let topSourceName = '–';
    let topSourceCount = 0;
    Object.entries(sourceCounts).forEach(([name, count]) => {
      if (count > topSourceCount) {
        topSourceName = name;
        topSourceCount = count;
      }
    });

    // 4. Tallies by status bucket
    const tallies = {
      all: totalScoped,
      New: scoped.filter(e => e.bucket === 'New').length,
      Qualified: scoped.filter(e => e.bucket === 'Qualified').length,
      Quoted: scoped.filter(e => e.bucket === 'Quoted').length,
      Converted: scoped.filter(e => e.bucket === 'Converted').length,
      Lost: scoped.filter(e => e.bucket === 'Lost').length,
    };

    // 5. Status Bucket & Search Filtering (applies only to returned list)
    let finalEnquiries = scoped;
    if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
      finalEnquiries = finalEnquiries.filter(e => e.bucket === statusFilter);
    }

    if (search) {
      finalEnquiries = finalEnquiries.filter(e =>
        e.enquiryNumber.toLowerCase().includes(search) ||
        e.clientName.toLowerCase().includes(search) ||
        (e.clientCode && e.clientCode.toLowerCase().includes(search)) ||
        e.clientPhones.some(p => p.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      enquiries: finalEnquiries,
      kpis: {
        qualificationRate,
        qualificationRateFormatted: totalScoped ? `${qualificationRate}%` : '–',
        totalInView: totalScoped,
        totalOpportunityValue,
        openOpportunityValue,
        topCategoryName,
        topCategoryCount,
        topSourceName,
        topSourceCount,
      },
      tallies,
    });
  } catch (error: any) {
    console.error('Error in GET /api/enquiries:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch enquiries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientId,
      clientName,
      clientPhone,
      clientCountry,
      clientEmail,
      categoryId,
      sourceCategoryId,
      sourceName,
      salespersonId,
      brief,
      enteredById,
      enteredByName,
      origin,
      originKey,
    } = body;

    const errors: string[] = [];
    if (!clientId) {
      if (!clientName || !clientName.trim()) errors.push('Client Name is required');
      if (!clientPhone || !clientPhone.trim()) errors.push('Client Phone is required');
    }
    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      errors.push('Email format is invalid');
    }

    let salesperson = null;
    if (salespersonId) {
      salesperson = await prisma.employee.findUnique({
        where: { id: salespersonId }
      });
      if (!salesperson) errors.push('Selected salesperson not found');
    }

    let isoCountry = clientCountry ? clientCountry.toUpperCase() : DEFAULT_COUNTRY_ISO2;
    let normalizedPhone: string | null = null;
    let phoneDetail: any = null;

    if (!clientId && clientPhone && clientPhone.trim()) {
      const phoneRes = normalizePhone(clientPhone, isoCountry);
      if (!phoneRes.ok || !phoneRes.e164) {
        errors.push(phoneRes.error || 'Invalid phone number');
      } else {
        normalizedPhone = phoneRes.e164;
        phoneDetail = {
          e164: phoneRes.e164,
          dial: phoneRes.dial || '+91',
          number: phoneRes.number || '',
          iso2: phoneRes.iso2 || isoCountry,
          valid: true,
          kind: 'Mobile'
        };
      }
    }

    if (categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!cat) errors.push('Selected category not found');
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    // Client Resolution & Deduplication
    let client: any = null;
    let clientWasExisting = false;

    if (clientId) {
      client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) {
        return NextResponse.json({ error: 'Selected client not found' }, { status: 400 });
      }
      clientWasExisting = true;
    } else if (normalizedPhone) {
      // Search existing client by normalized E.164 phone
      const allActiveClients = await prisma.client.findMany({
        where: { isActive: true },
        select: { id: true, name: true, clientCode: true, phones: true, phoneDetails: true, emails: true, clientType: true }
      });

      const matchedClient = allActiveClients.find(c => {
        if (Array.isArray(c.phones)) {
          return (c.phones as string[]).includes(normalizedPhone!);
        }
        return false;
      });

      if (matchedClient) {
        client = matchedClient;
        clientWasExisting = true;
      } else {
        // Create new stub client record untouched
        const isBusiness = body.clientType === 'BUSINESS' || body.clientType === 'Business';
        const targetMode = isBusiness ? 'B2B' : 'B2C';
        const nextCode = await generateNextClientCode(targetMode);
        const countryObj = findCountry(isoCountry) || findCountry(DEFAULT_COUNTRY_ISO2);

        client = await prisma.client.create({
          data: {
            clientCode: nextCode || null,
            clientType: isBusiness ? 'Business' : 'Individual',
            businessMode: targetMode,
            name: clientName.trim(),
            phones: [normalizedPhone],
            phoneDetails: phoneDetail ? [phoneDetail] : [],
            emails: clientEmail && clientEmail.trim() ? [clientEmail.trim()] : [],
            country: countryObj ? countryObj.name : 'India',
            countryIso2: isoCountry,
            sourceCategoryId: sourceCategoryId || null,
            sourceName: sourceName ? sourceName.trim() : null,
          }
        });
        clientWasExisting = false;
      }
    }

    // Generate daily sequential DF_ENQ_DDMMYYYY_NN
    const enquiryNumber = await generateNextEnquiryCode();

    const createdEnquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber,
        clientId: client.id,
        categoryId: categoryId || null,
        sourceCategoryId: sourceCategoryId || null,
        sourceName: sourceName ? sourceName.trim() : null,
        salespersonId: salesperson ? salesperson.id : null,
        salespersonName: salesperson ? salesperson.name : null,
        brief: brief ? brief.trim() : '',
        origin: origin || { channel: 'Manual' },
        originKey: originKey || null,
        enteredById: enteredById || null,
        enteredByName: enteredByName || null,
        stage: 'New',
        outcome: 'Open',
        status: 'NEW',
        hasCommunication: false,
        history: [],
        stageDates: {},
        opportunityValue: null,
      },
      include: {
        client: true,
        category: true,
        salesperson: true,
        items: true,
      }
    });

    return NextResponse.json({
      enquiry: {
        ...createdEnquiry,
        code: createdEnquiry.enquiryNumber,
        clientName: client.name,
        clientCode: client.clientCode,
        clientPhones: Array.isArray(client.phones) ? client.phones : [],
        clientEmails: Array.isArray(client.emails) ? client.emails : [],
      },
      client,
      clientWasExisting,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating enquiry:', error);
    return NextResponse.json({ error: error.message || 'Failed to create enquiry' }, { status: 500 });
  }
}
