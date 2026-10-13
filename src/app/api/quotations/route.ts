import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Helper to calculate quotation commercials with factory math
export function calculateQuoteCommercials(
  items: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    discountType?: string | null;
    discountValue?: number | null;
    expectedDimensions?: string | null;
    materialPreference?: string | null;
    clientComment?: string | null;
  }> = [],
  overallDiscountType?: string | null,
  overallDiscountVal?: number | null,
  additionalCharges: Array<{
    title: string;
    amount: number;
    taxable?: boolean;
  }> = [],
  gstApplicable: boolean = true,
  gstRatePct: number = 18.0
) {
  // 1. Line items
  const processedItems = items.map(item => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const discType = item.discountType === 'percent' ? 'percent' : (item.discountType === 'flat' ? 'flat' : null);
    let discVal = Number(item.discountValue) || 0;
    
    let unitDiscount = 0;
    if (discType === 'percent') {
      discVal = Math.min(100, Math.max(0, discVal));
      unitDiscount = (price * discVal) / 100;
    } else if (discType === 'flat') {
      discVal = Math.min(price, Math.max(0, discVal));
      unitDiscount = discVal;
    }
    
    const lineTotal = Math.round((price - unitDiscount) * qty * 100) / 100;
    return {
      description: item.description?.trim() || 'Custom Item',
      quantity: qty,
      unitPrice: price,
      discountType: discType,
      discountValue: discVal,
      discountAmount: Math.round(unitDiscount * qty * 100) / 100,
      total: lineTotal,
      expectedDimensions: item.expectedDimensions?.trim() || null,
      materialPreference: item.materialPreference?.trim() || null,
      clientComment: item.clientComment?.trim() || null
    };
  });

  const grossTotal = Math.round(processedItems.reduce((acc, it) => acc + it.total, 0) * 100) / 100;

  // 2. Overall quote discount
  let overallDiscountAmt = 0;
  const oType = overallDiscountType === 'percent' ? 'percent' : (overallDiscountType === 'flat' ? 'flat' : null);
  let oVal = Number(overallDiscountVal) || 0;
  if (oType === 'percent') {
    oVal = Math.min(100, Math.max(0, oVal));
    overallDiscountAmt = Math.round(((grossTotal * oVal) / 100) * 100) / 100;
  } else if (oType === 'flat') {
    oVal = Math.min(grossTotal, Math.max(0, oVal));
    overallDiscountAmt = oVal;
  }
  const discountedGross = Math.max(0, Math.round((grossTotal - overallDiscountAmt) * 100) / 100);

  // 3. Additional charges
  const processedCharges = additionalCharges.map(c => ({
    title: c.title.trim() || 'Additional Service',
    amount: Math.round((Number(c.amount) || 0) * 100) / 100,
    taxable: c.taxable !== false
  }));
  const extraCostsTotal = Math.round(processedCharges.reduce((acc, c) => acc + c.amount, 0) * 100) / 100;
  const taxableChargesTotal = Math.round(processedCharges.filter(c => c.taxable).reduce((acc, c) => acc + c.amount, 0) * 100) / 100;

  // 4. GST calculation (18% default)
  let gstAmount = 0;
  if (gstApplicable) {
    const gstBase = discountedGross + taxableChargesTotal;
    gstAmount = Math.round((gstBase * (gstRatePct / 100)) * 100) / 100;
  }

  // 5. Grand total
  const grandTotal = Math.round((discountedGross + extraCostsTotal + gstAmount) * 100) / 100;

  return {
    items: processedItems,
    grossTotal,
    overallDiscountType: oType,
    overallDiscountVal: oVal,
    overallDiscountAmt,
    discountedGross,
    additionalCharges: processedCharges,
    extraCostsTotal,
    gstApplicable,
    gstRatePct,
    gstAmount,
    grandTotal
  };
}

// Compute dynamic effective status (2-day / 1-day follow-up trigger)
export function computeEffectiveStatus(status: string, sentAt?: Date | string | null, followupDoneAt?: string[] | null) {
  if (status !== 'SENT' || !sentAt) return status;
  const arr = Array.isArray(followupDoneAt) ? followupDoneAt : [];
  const lastInteraction = arr.length > 0 ? new Date(arr[arr.length - 1]) : new Date(sentAt);
  const now = new Date();
  const diffDays = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
  const triggerDays = arr.length > 0 ? 1 : 2;
  if (diffDays >= triggerDays) {
    return 'FOLLOWUP_NEEDED';
  }
  return 'SENT';
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;

  const quotations = await prisma.quotation.findMany({
    include: {
      client: true,
      enquiry: {
        include: { items: true }
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
  });

  const formatted = quotations.map(q => {
    const latestVersion = q.versions[0] || null;
    const effectiveStatus = latestVersion
      ? computeEffectiveStatus(latestVersion.status, latestVersion.sentAt, latestVersion.followupDoneAt as string[])
      : q.status;

    return {
      id: q.id,
      quotationNumber: q.quotationNumber,
      clientId: q.clientId,
      clientName: q.client.name,
      clientPhone: (q.client.phones as any)?.[0] || null,
      clientAddress: (q.client.addresses as any)?.[0] || null,
      enquiryId: q.enquiryId,
      enquiryNumber: q.enquiry?.enquiryNumber || null,
      enquiryStage: q.enquiry?.stage || null,
      
      currentVersionNo: q.currentVersionNo,
      status: latestVersion?.status || q.status,
      effectiveStatus,
      totalAmount: latestVersion?.grandTotal || q.totalAmount,

      latestVersion,
      versionsCount: q.versions.length,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString()
    };
  });

  return NextResponse.json(formatted);
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;
    const userName = cookieStore.get('user_name')?.value || 'Admin';
    const cookieRole = cookieStore.get('user_role')?.value;

    const body = await req.json();
    const userRole = body.userRole || cookieRole || 'SUPER_ADMIN';
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

    // 1. STRICT DOMAIN RULE: Quotations can ONLY be built for Qualified enquiries!
    if (!body.enquiryId) {
      return NextResponse.json(
        { error: 'Quotation must be linked to a qualified sales enquiry.' },
        { status: 400 }
      );
    }

    const enquiry = await prisma.enquiry.findUnique({
      where: { id: body.enquiryId },
      include: { client: true, items: true }
    });

    if (!enquiry) {
      return NextResponse.json(
        { error: 'The selected enquiry does not exist.' },
        { status: 404 }
      );
    }

    if ((enquiry.stage !== 'Qualified' && enquiry.stage !== 'Quoted') || enquiry.outcome === 'Lost') {
      return NextResponse.json(
        { 
          error: `Quotations can only be built for Qualified or Quoted enquiries. This enquiry is currently "${enquiry.stage}" (${enquiry.outcome}).` 
        },
        { status: 400 }
      );
    }

    // 2. Sequential Quotation Number: DF_QT_000001
    let quotationNumber = body.quotationNumber?.trim();
    if (!quotationNumber) {
      const existingQuotes = await prisma.quotation.findMany({
        select: { quotationNumber: true }
      });

      let maxSeq = 0;
      existingQuotes.forEach(q => {
        if (q.quotationNumber && q.quotationNumber.startsWith('DF_QT_')) {
          const num = parseInt(q.quotationNumber.replace('DF_QT_', ''), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        } else if (q.quotationNumber && q.quotationNumber.startsWith('QT-')) {
          const num = parseInt(q.quotationNumber.replace('QT-', ''), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });

      quotationNumber = `DF_QT_${String(maxSeq + 1).padStart(6, '0')}`;
    }

    // 3. Line items source: from payload, or pre-filled from qualified enquiry
    const rawItems = Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : (enquiry.items.length > 0
          ? enquiry.items.map(it => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice || 0,
              expectedDimensions: it.expectedDimensions,
              materialPreference: it.materialPreference,
              clientComment: it.clientComment
            }))
          : [{ description: 'Custom Modular Unit', quantity: 1, unitPrice: enquiry.estimatedBudget || 0 }]);

    // 4. Calculate Factory Commercials
    const commercials = calculateQuoteCommercials(
      rawItems,
      body.overallDiscountType,
      body.overallDiscountVal,
      body.additionalCharges || [
        { title: 'Packaging & Handling', amount: 0, taxable: true },
        { title: 'Transportation & Freight', amount: 0, taxable: true }
      ],
      body.gstApplicable !== false,
      Number(body.gstRatePct) || 18.0
    );

    // Default D'Furn standard terms snapshot
    const defaultTerms = [
      { id: 'TERM_PAYMENT', title: 'Payment Terms', body: '50% advance along with confirmed order, 40% prior to factory dispatch, 10% upon installation completion.' },
      { id: 'TERM_DELIVERY', title: 'Delivery Timeline', body: '3 to 4 weeks from approval of final production drawings and receipt of advance payment.' },
      { id: 'TERM_VALIDITY', title: 'Validity', body: 'This proposal is valid for 15 days from the date of issue.' },
      { id: 'TERM_WARRANTY', title: 'Warranty', body: '5 years comprehensive warranty against manufacturing defects on structural hardware.' }
    ];

    const termsToSave = Array.isArray(body.terms) && body.terms.length > 0 ? body.terms : defaultTerms;

    // 5. Determine initial status based on user role:
    // - ADMIN: Directly saves as APPROVED (no verification step required)
    // - NON-ADMIN: Starts in GENERATED (Draft) or VERIFICATION_REQUIRED if submitted
    const isSubmitting = Boolean(body.submitForVerification);
    let initialStatus = 'GENERATED';
    let approvalData: { approvedById?: string | null; approvedByName?: string; approvedAt?: Date } = {};

    if (isAdmin) {
      initialStatus = 'APPROVED';
      approvalData = {
        approvedById: userId || null,
        approvedByName: userName,
        approvedAt: new Date()
      };
      // Admin creation automatically advances enquiry stage to Quoted
      await prisma.enquiry.update({
        where: { id: enquiry.id },
        data: { stage: 'Quoted', status: 'IN_PROGRESS' }
      }).catch(console.error);
    } else if (isSubmitting) {
      initialStatus = 'VERIFICATION_REQUIRED';

      // Gracefully persist or update client address if provided
      if (body.clientAddress) {
        try {
          let addresses: any = enquiry.client.addresses;
          if (typeof addresses === 'string') {
            try { addresses = JSON.parse(addresses); } catch { addresses = []; }
          }
          if (!Array.isArray(addresses)) addresses = [];
          const addrObj = typeof body.clientAddress === 'string'
            ? { label: 'Billing Address', street: body.clientAddress.trim(), isBilling: true }
            : {
                label: 'Billing Address',
                street: body.clientAddress.street || body.clientAddress.addressLine || '',
                city: body.clientAddress.city || '',
                state: body.clientAddress.state || '',
                zip: body.clientAddress.zip || body.clientAddress.pincode || '',
                isBilling: true
              };
          if (addrObj.street || addrObj.city || addrObj.state) {
            addresses.push(addrObj);
            await prisma.client.update({
              where: { id: enquiry.clientId },
              data: { addresses }
            });
          }
        } catch (e) {
          console.error('Failed to save client address', e);
        }
      }

      await prisma.enquiry.update({
        where: { id: enquiry.id },
        data: { stage: 'Quoted', status: 'IN_PROGRESS' }
      }).catch(console.error);
    }

    // 6. Create Quotation and Version 1 atomically
    const newQuotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        clientId: enquiry.clientId,
        enquiryId: enquiry.id,
        status: initialStatus,
        currentVersionNo: 1,
        totalAmount: commercials.grandTotal,
        versions: {
          create: {
            versionNo: 1,
            versionCode: `${quotationNumber}-v1`,
            status: initialStatus,
            grossTotal: commercials.grossTotal,
            overallDiscountType: commercials.overallDiscountType,
            overallDiscountVal: commercials.overallDiscountVal,
            overallDiscountAmt: commercials.overallDiscountAmt,
            discountedGross: commercials.discountedGross,
            extraCostsTotal: commercials.extraCostsTotal,
            gstApplicable: commercials.gstApplicable,
            gstRatePct: commercials.gstRatePct,
            gstAmount: commercials.gstAmount,
            grandTotal: commercials.grandTotal,
            createdById: userId || null,
            createdByName: userName,
            terms: termsToSave,
            ...approvalData,
            items: {
              create: commercials.items.map(it => ({
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                discountType: it.discountType,
                discountValue: it.discountValue,
                discountAmount: it.discountAmount,
                total: it.total,
                expectedDimensions: it.expectedDimensions,
                materialPreference: it.materialPreference,
                clientComment: it.clientComment
              }))
            },
            additionalCharges: {
              create: commercials.additionalCharges.map(c => ({
                title: c.title,
                amount: c.amount,
                taxable: c.taxable
              }))
            }
          }
        }
      },
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
    });

    const latestVer = newQuotation.versions[0];

    return NextResponse.json({
      id: newQuotation.id,
      quotationNumber: newQuotation.quotationNumber,
      clientId: newQuotation.clientId,
      clientName: newQuotation.client.name,
      clientPhone: (newQuotation.client.phones as any)?.[0] || null,
      enquiryId: newQuotation.enquiryId,
      enquiryNumber: newQuotation.enquiry?.enquiryNumber || null,
      enquiryStage: newQuotation.enquiry?.stage || null,
      currentVersionNo: 1,
      status: initialStatus,
      effectiveStatus: initialStatus,
      totalAmount: commercials.grandTotal,
      latestVersion: latestVer,
      versionsCount: 1,
      createdAt: newQuotation.createdAt.toISOString(),
      updatedAt: newQuotation.updatedAt.toISOString()
    });
  } catch (error: any) {
    console.error('Error creating quotation:', error);
    return NextResponse.json({ error: error.message || 'Failed to create quotation' }, { status: 500 });
  }
}
