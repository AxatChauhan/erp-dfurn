import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { brief, lineItems, items: aliasItems, opportunityValue, actor } = body;
    const inputItems = lineItems !== undefined ? lineItems : aliasItems;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    const finalBrief = brief !== undefined ? String(brief).trim() : (enquiry.brief || '').trim();

    // Mandatory Brief Rule: an enquiry cannot be qualified without a client brief
    if (!finalBrief) {
      return NextResponse.json({
        error: 'A brief is required: write what the client needs before qualifying'
      }, { status: 400 });
    }

    let parsedOppValue = enquiry.opportunityValue;
    if (opportunityValue !== undefined && opportunityValue !== null && opportunityValue !== '') {
      const val = parseFloat(opportunityValue);
      if (isNaN(val) || val < 0) {
        return NextResponse.json({ error: 'Opportunity value must be a non-negative number' }, { status: 400 });
      }
      parsedOppValue = val;
    } else if (opportunityValue === null || opportunityValue === '') {
      parsedOppValue = null;
    }

    // Validate and normalize line items
    const rawItems = Array.isArray(inputItems) ? inputItems : enquiry.items;
    for (const item of rawItems) {
      if (item.quantity !== undefined && (parseInt(item.quantity, 10) <= 0 || isNaN(parseInt(item.quantity, 10)))) {
        return NextResponse.json({ error: 'Each product needs a positive quantity' }, { status: 400 });
      }
    }

    const firstTime = enquiry.stage === 'New';
    const currentDates: any = (typeof enquiry.stageDates === 'object' && enquiry.stageDates) ? enquiry.stageDates : {};
    const currentHistory: any[] = Array.isArray(enquiry.history) ? enquiry.history : [];

    const actorId = actor?.id || null;
    const actorName = actor?.name || 'Evaluator';

    const stageDates = { ...currentDates };
    let newStage = enquiry.stage;
    let qualifiedById = enquiry.qualifiedById;
    let qualifiedByName = enquiry.qualifiedByName;
    let history = [...currentHistory];

    if (firstTime) {
      newStage = 'Qualified';
      stageDates.Qualified = new Date().toISOString();
      qualifiedById = actorId;
      qualifiedByName = actorName;
      history.push({
        type: 'qualified',
        at: new Date().toISOString(),
        byId: actorId,
        byName: actorName,
      });
    }

    // Transaction to update items and enquiry atomically
    await prisma.$transaction(async (tx) => {
      if (inputItems !== undefined) {
        await tx.enquiryItem.deleteMany({ where: { enquiryId: id } });
        if (rawItems.length > 0) {
          await tx.enquiryItem.createMany({
            data: rawItems.map((item: any) => ({
              enquiryId: id,
              refType: item.refType || 'MasterProduct',
              refId: item.refId || null,
              description: item.description?.trim() || item.name?.trim() || 'Product Item',
              quantity: parseInt(item.quantity, 10) || 1,
              unitPrice: parseFloat(item.unitPrice || item.baseSellingRate || 0) || 0,
              total: (parseInt(item.quantity, 10) || 1) * (parseFloat(item.unitPrice || item.baseSellingRate || 0) || 0),
              comment: item.comment ? String(item.comment).trim() : null,
              customizations: item.customizations || null,
            }))
          });
        }
      }

      await tx.enquiry.update({
        where: { id },
        data: {
          brief: finalBrief,
          opportunityValue: parsedOppValue,
          stage: newStage,
          status: newStage === 'Qualified' && enquiry.status === 'NEW' ? 'QUALIFIED' : enquiry.status,
          stageDates,
          qualifiedById,
          qualifiedByName,
          history,
        }
      });
    });

    const updated = await prisma.enquiry.findUnique({
      where: { id },
      include: { client: true, category: true, salesperson: true, items: true }
    });

    return NextResponse.json({
      enquiry: {
        ...updated,
        code: updated?.enquiryNumber,
        clientName: updated?.client?.name || '',
      }
    });
  } catch (error: any) {
    console.error('Error in PUT /api/enquiries/[id]/qualification:', error);
    return NextResponse.json({ error: error.message || 'Failed to save qualification' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const actor = body.actor || null;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: { quotations: true }
    });

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    // Hard Guard 1: Cannot reverse if quotation exists
    if (enquiry.quotations.length > 0) {
      return NextResponse.json({
        error: 'A quotation has been made against this enquiry, so its qualification can no longer be reversed.'
      }, { status: 409 });
    }

    // Hard Guard 2: Must be in Qualified stage
    if (enquiry.stage === 'New') {
      return NextResponse.json({ error: 'This enquiry is not qualified' }, { status: 400 });
    }
    if (enquiry.stage !== 'Qualified') {
      return NextResponse.json({
        error: 'This enquiry has moved past qualification, so it can no longer be reversed.'
      }, { status: 409 });
    }

    // Hard Guard 3: Must not be Lost
    if (enquiry.outcome === 'Lost') {
      return NextResponse.json({
        error: 'Reopen this enquiry before reversing its qualification.'
      }, { status: 409 });
    }

    const currentDates: any = (typeof enquiry.stageDates === 'object' && enquiry.stageDates) ? { ...enquiry.stageDates } : {};
    delete currentDates.Qualified;

    const currentHistory: any[] = Array.isArray(enquiry.history) ? [...enquiry.history] : [];
    currentHistory.push({
      type: 'unqualified',
      at: new Date().toISOString(),
      byId: actor?.id || null,
      byName: actor?.name || 'Evaluator',
    });

    const updated = await prisma.enquiry.update({
      where: { id },
      data: {
        stage: 'New',
        status: 'NEW',
        stageDates: currentDates,
        qualifiedById: null,
        qualifiedByName: null,
        history: currentHistory,
      },
      include: { client: true, category: true, salesperson: true, items: true }
    });

    return NextResponse.json({
      enquiry: {
        ...updated,
        code: updated.enquiryNumber,
        clientName: updated.client?.name || '',
      }
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/enquiries/[id]/qualification:', error);
    return NextResponse.json({ error: error.message || 'Failed to reverse qualification' }, { status: 500 });
  }
}
