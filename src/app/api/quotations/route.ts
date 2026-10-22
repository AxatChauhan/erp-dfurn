import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getAuthenticatedSession } from '@/lib/auth';
import crypto from 'crypto';
import { fiscalYearOf } from '@/lib/dates';
import {
  versionLabelOf,
  followupInfo,
  buildVersionComputedFields,
  readinessOf,
  standardTerms,
  isIndianBusiness,
  normalizeQuoteStatus
} from '@/lib/quotations/quoteService';

export async function fetchQuotationsData(params: {
  search?: string | null;
  status?: string | null;
  fy?: string | null;
  month?: string | null;
  date?: string | null;
  salespersonId?: string | null;
  role?: string | null;
  employeeId?: string | null;
  userId?: string | null;
}) {
  const where: any = {};

  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { quotationNumber: { contains: q, mode: 'insensitive' } },
      { enquiryCode: { contains: q, mode: 'insensitive' } },
      { client: { name: { contains: q, mode: 'insensitive' } } },
      { enquiry: { enquiryNumber: { contains: q, mode: 'insensitive' } } }
    ];
  }

  // Scoping for Sales Rep
  if (params.role === 'SALES') {
    const ownerConditions = [
      ...(params.employeeId ? [{ salespersonId: params.employeeId }, { enquiry: { salespersonId: params.employeeId } }] : []),
      ...(params.userId ? [{ enquiry: { enteredById: params.userId } }, { versions: { some: { createdById: params.userId } } }] : [])
    ];
    if (where.OR) {
      where.AND = [
        { OR: where.OR },
        { OR: ownerConditions }
      ];
      delete where.OR;
    } else {
      where.OR = ownerConditions;
    }
  }

  // Fetch quotations, salespersons, and waiting enquiries concurrently
  const [quotations, employees, waitingEnquiries] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phones: true,
            emails: true,
            addresses: true,
            clientType: true,
            taxId: true,
            countryIso2: true,
            contactPerson: true
          }
        },
        enquiry: {
          select: {
            id: true,
            enquiryNumber: true,
            stage: true,
            salespersonId: true,
            salesperson: { select: { id: true, name: true } },
            notes: true,
            brief: true
          }
        },
        versions: {
          orderBy: { versionNo: 'desc' },
          include: {
            items: true,
            additionalCharges: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, employeeCode: true },
      orderBy: { name: 'asc' }
    }),
    prisma.enquiry.findMany({
      where: {
        stage: 'Qualified',
        outcome: 'Open',
        ...(params.role === 'SALES' ? {
          OR: [
            ...(params.employeeId ? [{ salespersonId: params.employeeId }] : []),
            ...(params.userId ? [{ enteredById: params.userId }] : [])
          ]
        } : {})
      },
      select: { id: true }
    })
  ]);

  const quotedEnquiryIds = new Set(quotations.map(q => q.enquiryId).filter(Boolean));
  const waitingEnquiriesCount = waitingEnquiries.filter(e => !quotedEnquiryIds.has(e.id)).length;

  // Format quotations with computed fields
  const formattedQuotations = quotations.map(q => {
    const latestVersion = q.versions[0] || null;
    const fu = followupInfo(latestVersion);
    const versionLabel = versionLabelOf(latestVersion?.versionNo || q.currentVersionNo);
    const displayStatus = normalizeQuoteStatus(latestVersion?.status || q.status);
    const effectiveStatus = fu.followupNeeded ? 'Followup Needed' : displayStatus;

    const displayCode = q.code || (q.enquiryCode ? `Draft for ${q.enquiryCode}` : `Draft · ${q.quotationNumber}`);
    const clientPhone = (q.client.phones as any)?.[0] || null;
    const clientEmail = (q.client.emails as any)?.[0] || null;

    return {
      id: q.id,
      code: q.code,
      number: q.code,
      quotationNumber: q.quotationNumber,
      displayCode,
      enquiryCode: q.enquiryCode || q.enquiry?.enquiryNumber || null,
      enquiryId: q.enquiryId,
      enquiryStage: q.enquiry?.stage || null,
      brief: (q.enquiry as any)?.brief || q.enquiry?.notes || '',

      clientId: q.clientId,
      clientName: q.client.name,
      clientPhone,
      clientEmail,
      client: q.client,

      salespersonId: q.salespersonId || q.enquiry?.salespersonId || null,
      salespersonName: q.salespersonName || q.enquiry?.salesperson?.name || null,

      currentVersionNo: q.currentVersionNo,
      versionLabel,
      status: displayStatus,
      effectiveStatus,
      totalAmount: latestVersion?.grandTotal || q.totalAmount,

      latestVersion: latestVersion
        ? {
            ...latestVersion,
            status: normalizeQuoteStatus(latestVersion.status),
            versionLabel,
            followupNeeded: fu.followupNeeded,
            followupCount: fu.followupCount,
            createdAt: latestVersion.createdAt.toISOString()
          }
        : null,
      versionsCount: q.versions.length,
      versions: q.versions.map(v => ({
        ...v,
        status: normalizeQuoteStatus(v.status),
        versionLabel: versionLabelOf(v.versionNo),
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        submittedAt: v.submittedAt?.toISOString() || null,
        decidedAt: v.decidedAt?.toISOString() || null,
        supersededAt: v.supersededAt?.toISOString() || null
      })),

      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString()
    };
  });

  // Time & Salesperson Filtering for KPIs
  const timeFiltered = formattedQuotations.filter(q => {
    if (params.date) return q.createdAt.slice(0, 10) === params.date;
    if (params.fy && params.fy !== 'all' && fiscalYearOf(q.createdAt).key !== params.fy) return false;
    if (params.month !== undefined && params.month !== null && params.month !== '') {
      if (new Date(q.createdAt).getMonth() !== Number(params.month)) return false;
    }
    return true;
  });

  const scoped = timeFiltered.filter(q => {
    if (!params.salespersonId) return true;
    if (params.salespersonId === 'unassigned') return !q.salespersonId;
    return q.salespersonId === params.salespersonId;
  });

  // Calculate 5 Insight Cards metrics
  const total = scoped.length;
  const submitted = scoped.filter(q => q.status !== 'Draft');
  const draftsCount = total - submitted.length;
  const overdueCount = scoped.filter(q => q.effectiveStatus === 'Followup Needed').length;
  const wonCount = scoped.filter(q => q.status === 'Converted').length;
  const decidedCount = scoped.filter(q => q.status === 'Converted' || q.status === 'Not Converted').length;
  const conversionRate = decidedCount > 0 ? Math.round((wonCount / decidedCount) * 100) : null;
  const pipelineValue = submitted.reduce((sum, q) => sum + (q.totalAmount || 0), 0);
  const avgDealSize = submitted.length > 0 ? Math.round(pipelineValue / submitted.length) : 0;

  const kpis = {
    total,
    draftsCount,
    overdueCount,
    wonCount,
    decidedCount,
    conversionRate,
    pipelineValue,
    avgDealSize
  };

  // Status segment tally counts
  const BUCKETS = [
    'Draft',
    'Verification Required',
    'Admin Approval Required',
    'Approved',
    'Sent',
    'Followup Needed',
    'Converted',
    'Not Approved',
    'Not Converted'
  ];
  const counts: Record<string, number> = {};
  BUCKETS.forEach(b => {
    counts[b] = scoped.filter(q => q.effectiveStatus === b).length;
  });

  return {
    quotations: formattedQuotations,
    kpis,
    counts,
    salespersons: employees,
    waitingEnquiriesCount
  };
}

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const fy = searchParams.get('fy');
    const month = searchParams.get('month');
    const date = searchParams.get('date');
    const salespersonId = searchParams.get('salespersonId');

    const data = await fetchQuotationsData({
      search,
      status,
      fy,
      month,
      date,
      salespersonId,
      role: session?.role,
      employeeId: session?.employeeId,
      userId: session?.userId
    });

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error fetching quotations:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch quotations' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    const userId = session.userId;
    const userName = session.name;

    const body = await req.json();
    if (!body.enquiryId) {
      return NextResponse.json({ error: 'Quotation must be linked to a qualified enquiry' }, { status: 400 });
    }

    // Check if quotation already exists for this enquiry
    const existing = await prisma.quotation.findFirst({
      where: { enquiryId: body.enquiryId }
    });
    if (existing) {
      return NextResponse.json({ error: 'A quotation already exists for this enquiry' }, { status: 409 });
    }

    // Fetch qualified enquiry
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: body.enquiryId },
      include: {
        client: true,
        salesperson: true,
        items: true
      }
    });

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }
    if (enquiry.outcome === 'Lost') {
      return NextResponse.json({ error: 'This enquiry is lost. Reopen it before quoting.' }, { status: 409 });
    }
    if (enquiry.stage === 'New') {
      return NextResponse.json({ error: 'Qualify the enquiry first: it needs a brief.' }, { status: 409 });
    }

    // Look up any referenced MasterProducts from enquiry items
    const refProductIds = (enquiry.items || [])
      .map(it => it.refId)
      .filter((id): id is string => Boolean(id));

    let productsMap = new Map<string, any>();
    if (refProductIds.length > 0) {
      const prods = await prisma.masterProduct.findMany({
        where: { id: { in: refProductIds } },
        select: {
          id: true,
          code: true,
          name: true,
          thumbnail: true,
          unitOfMeasurement: true,
          baseSellingRate: true,
          nakedDimensions: true,
        }
      });
      prods.forEach(p => productsMap.set(p.id, p));
    }

    // Default line items inherited from enquiry
    const rawItems = (enquiry.items || []).map((it) => {
      const prod = it.refId ? productsMap.get(it.refId) : null;
      const unitRate = it.unitPrice > 0 ? it.unitPrice : (prod?.baseSellingRate || 0);
      const prodDim = prod?.nakedDimensions
        ? `L ${prod.nakedDimensions.l || 0} × B ${prod.nakedDimensions.w || 0} × H ${prod.nakedDimensions.h || 0} mm`
        : null;

      return {
        lineId: crypto.randomUUID(),
        refType: it.refType || (prod ? 'MasterProduct' : 'Variant'),
        refId: it.refId || null,
        snapshot: {
          name: prod?.name || it.description || 'Custom Unit',
          code: prod?.code || null,
          unit: prod?.unitOfMeasurement || 'Nos',
          imageUrl: prod?.thumbnail || null
        },
        description: it.clientComment || it.description || prod?.name || '',
        quantity: Math.max(1, it.quantity || 1),
        unitPrice: Math.max(0, unitRate),
        discountType: null,
        discountValue: 0,
        customizations: it.customizations || [],
        expectedDimensions: it.expectedDimensions || prodDim || null,
        materialPreference: it.materialPreference || null,
        clientComment: it.clientComment || null
      };
    });

    if (rawItems.length === 0) {
      rawItems.push({
        lineId: crypto.randomUUID(),
        refType: 'Variant',
        refId: null,
        snapshot: { name: 'Custom Modular Unit', code: null, unit: 'pcs', imageUrl: null },
        description: '',
        quantity: 1,
        unitPrice: enquiry.estimatedBudget || 0,
        discountType: null,
        discountValue: 0,
        customizations: [],
        expectedDimensions: null,
        materialPreference: null,
        clientComment: null
      });
    }

    // GST applicability default based on billing country
    const gstApplicable = isIndianBusiness(enquiry.client);

    const computed = buildVersionComputedFields({
      items: rawItems,
      additionalCharges: [],
      gstApplicable,
      gstRatePct: 18.0,
      overallDiscountType: null,
      overallDiscountVal: 0
    });

    // Generate unique draft placeholder for quotationNumber (not displayed as official number)
    const draftId = `DF-DRAFT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const newQuotation = await prisma.quotation.create({
      data: {
        quotationNumber: draftId,
        code: null, // Draft has NO official number yet!
        enquiryCode: enquiry.enquiryNumber,
        clientId: enquiry.clientId,
        enquiryId: enquiry.id,
        salespersonId: enquiry.salespersonId || null,
        salespersonName: enquiry.salesperson?.name || null,
        status: 'Draft',
        currentVersionNo: 1,
        totalAmount: computed.grandTotal,
        versions: {
          create: {
            versionNo: 1,
            versionCode: `Draft · ${enquiry.enquiryNumber}`,
            status: 'Draft',
            grossTotal: computed.grossTotal,
            overallDiscountType: computed.overallDiscountType,
            overallDiscountVal: computed.overallDiscountVal,
            overallDiscountAmt: computed.overallDiscountAmt,
            discountedGross: computed.discountedGross,
            extraCostsTotal: computed.extraCostsTotal,
            gstApplicable: computed.gstApplicable,
            gstRatePct: computed.gstRatePct,
            gstAmount: computed.gstAmount,
            grandTotal: computed.grandTotal,
            createdById: userId,
            createdByName: userName,
            terms: standardTerms,
            changes: [],
            items: {
              create: computed.items.map(it => ({
                lineId: it.lineId,
                refType: it.refType,
                refId: it.refId,
                snapshot: it.snapshot,
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                discountType: it.discountType,
                discountValue: it.discountValue,
                discountAmount: it.discountAmount,
                total: it.total,
                customizations: it.customizations,
                expectedDimensions: it.expectedDimensions,
                materialPreference: it.materialPreference,
                clientComment: it.clientComment
              }))
            }
          }
        }
      },
      include: {
        client: true,
        enquiry: {
          include: { salesperson: true }
        },
        versions: {
          include: {
            items: true,
            additionalCharges: true
          }
        }
      }
    });

    const readiness = readinessOf(newQuotation, enquiry.client);

    return NextResponse.json({
      id: newQuotation.id,
      code: newQuotation.code,
      number: newQuotation.code,
      quotationNumber: newQuotation.quotationNumber,
      displayCode: `Draft for ${enquiry.enquiryNumber}`,
      enquiryCode: enquiry.enquiryNumber,
      enquiryId: newQuotation.enquiryId,
      clientId: newQuotation.clientId,
      clientName: newQuotation.client.name,
      salespersonId: newQuotation.salespersonId,
      salespersonName: newQuotation.salespersonName,
      status: 'Draft',
      effectiveStatus: 'Draft',
      totalAmount: computed.grandTotal,
      currentVersionNo: 1,
      versionLabel: 'v0',
      readiness,
      latestVersion: {
        ...newQuotation.versions[0],
        versionLabel: 'v0',
        createdAt: newQuotation.versions[0].createdAt.toISOString()
      }
    });
  } catch (err: any) {
    console.error('Error creating quotation draft:', err);
    return NextResponse.json({ error: err.message || 'Failed to create quotation draft' }, { status: 500 });
  }
}
