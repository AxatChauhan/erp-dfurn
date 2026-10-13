import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAdvanceStage } from '@/lib/enquiryUtils';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: {
        items: true,
        client: true,
        salesperson: true,
        quotations: {
          select: { id: true, quotationNumber: true, status: true, totalAmount: true, createdAt: true }
        }
      }
    });

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...enquiry,
      clientName: enquiry.client?.name || 'Unknown Client',
      clientCode: enquiry.client?.clientCode || null,
      clientPhones: Array.isArray(enquiry.client?.phones) ? (enquiry.client.phones as string[]) : [],
      clientEmails: Array.isArray(enquiry.client?.emails) ? (enquiry.client.emails as string[]) : []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch enquiry' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.enquiry.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    // 1. Stage calculation: apply user-selected stage directly
    let newStage = existing.stage || 'New';
    if (body.stage) {
      newStage = body.stage;
    }

    // 2. Outcome handling (Open vs Lost)
    let outcome = body.outcome !== undefined ? body.outcome : (existing.outcome || 'Open');
    if (body.stage && body.outcome === undefined && outcome === 'Lost') {
      outcome = 'Open';
    }
    let lostAtStage = existing.lostAtStage;
    let lostReason = existing.lostReason;
    let lostNote = existing.lostNote;

    if (outcome === 'Lost') {
      lostAtStage = existing.stage;
      lostReason = body.lostReason || existing.lostReason || 'Other';
      lostNote = body.lostNote !== undefined ? body.lostNote : existing.lostNote;
    } else if (outcome === 'Open') {
      lostAtStage = null;
      lostReason = null;
      lostNote = null;
    }

    // Synchronize legacy status with stage / outcome
    let synchronizedStatus = body.status;
    if (synchronizedStatus === undefined) {
      if (outcome === 'Lost') synchronizedStatus = 'DROPPED';
      else if (newStage === 'Converted') synchronizedStatus = 'CONVERTED';
      else if (newStage === 'Quoted') synchronizedStatus = 'IN_PROGRESS';
      else if (newStage === 'Qualified') synchronizedStatus = 'QUALIFIED';
      else if (newStage === 'New') synchronizedStatus = 'NEW';
    }

    // 3. Overwrite items if provided
    if (body.items !== undefined) {
      await prisma.enquiryItem.deleteMany({ where: { enquiryId: id } });
    }

    const updated = await prisma.enquiry.update({
      where: { id },
      data: {
        clientId: body.clientId !== undefined ? body.clientId : undefined,
        status: synchronizedStatus,
        stage: newStage,
        outcome,
        lostAtStage,
        lostReason,
        lostNote,

        enteredById: body.enteredById !== undefined ? body.enteredById : undefined,
        enteredByName: body.enteredByName !== undefined ? body.enteredByName : undefined,
        salespersonId: body.salespersonId !== undefined ? body.salespersonId : undefined,
        salespersonName: body.salespersonName !== undefined ? body.salespersonName : undefined,

        notes: body.notes !== undefined ? body.notes : undefined,
        expectedTimeline: body.expectedTimeline !== undefined ? body.expectedTimeline : undefined,
        estimatedBudget: body.estimatedBudget !== undefined ? (body.estimatedBudget ? parseFloat(body.estimatedBudget) : null) : undefined,
        propertyType: body.propertyType !== undefined ? body.propertyType : undefined,
        nextFollowUp: body.nextFollowUp !== undefined ? (body.nextFollowUp ? new Date(body.nextFollowUp) : null) : undefined,
        sourceCategory: body.sourceCategory !== undefined ? body.sourceCategory : undefined,
        sourceName: body.sourceName !== undefined ? body.sourceName : undefined,
        attachments: body.attachments !== undefined ? body.attachments : undefined,

        items: body.items !== undefined ? {
          create: body.items.map((item: any) => ({
            description: item.description?.trim() || 'Custom Unit',
            quantity: item.quantity ? parseInt(item.quantity, 10) : 1,
            unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : 0,
            total: item.total ? parseFloat(item.total) : 0,
            expectedDimensions: item.expectedDimensions?.trim() || null,
            materialPreference: item.materialPreference?.trim() || null,
            clientComment: item.clientComment?.trim() || null
          }))
        } : undefined
      },
      include: { items: true, client: true, salesperson: true, quotations: true }
    });

    return NextResponse.json({
      ...updated,
      clientName: updated.client?.name || 'Unknown Client',
      clientCode: updated.client?.clientCode || null,
      clientPhones: Array.isArray(updated.client?.phones) ? (updated.client.phones as string[]) : [],
      clientEmails: Array.isArray(updated.client?.emails) ? (updated.client.emails as string[]) : []
    });
  } catch (error: any) {
    console.error('Error updating enquiry:', error);
    return NextResponse.json({ error: error.message || 'Failed to update enquiry' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Guard: Check if linked quotations exist
    const quoteCount = await prisma.quotation.count({
      where: { enquiryId: id }
    });

    if (quoteCount > 0) {
      return NextResponse.json({
        error: `Cannot delete enquiry: ${quoteCount} quotation(s) are permanently attached. Mark as Lost or archive instead to preserve audit records.`
      }, { status: 409 });
    }

    await prisma.enquiryItem.deleteMany({ where: { enquiryId: id } });
    await prisma.enquiry.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Enquiry deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting enquiry:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete enquiry' }, { status: 500 });
  }
}
