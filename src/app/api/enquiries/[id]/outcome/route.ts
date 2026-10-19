import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { outcome, lostReasonId, lostNote, actor } = body;

    const enquiry = await prisma.enquiry.findUnique({ where: { id } });
    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    // Ownership check for Sales Rep
    if (session.role === 'SALES') {
      const isOwner =
        (session.employeeId && enquiry.salespersonId === session.employeeId) ||
        enquiry.enteredById === session.userId;
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Forbidden: You can only change the outcome of your own enquiries' },
          { status: 403 }
        );
      }
    }

    if (!['Open', 'Lost'].includes(outcome)) {
      return NextResponse.json({ error: 'Outcome must be Open or Lost' }, { status: 400 });
    }

    const currentHistory: any[] = Array.isArray(enquiry.history) ? [...enquiry.history] : [];
    const actorId = session.userId || actor?.id || null;
    const actorName = session.name || actor?.name || 'User';

    if (outcome === 'Open') {
      currentHistory.push({
        type: 'reopened',
        at: new Date().toISOString(),
        byId: actorId,
        byName: actorName,
      });

      const updated = await prisma.enquiry.update({
        where: { id },
        data: {
          outcome: 'Open',
          status: enquiry.status === 'DROPPED' ? (enquiry.stage === 'New' ? 'NEW' : 'QUALIFIED') : enquiry.status,
          lostAt: null,
          lostAtStage: null,
          lostReasonId: null,
          lostReason: null,
          lostNote: '',
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
    }

    // outcome === 'Lost'
    if (!lostReasonId) {
      return NextResponse.json({ error: 'A lost reason is required' }, { status: 400 });
    }

    let reason = await prisma.lostReason.findUnique({ where: { id: lostReasonId } });
    if (!reason) {
      reason = await prisma.lostReason.findFirst({ where: { name: lostReasonId } });
    }
    if (!reason) {
      return NextResponse.json({ error: 'Lost reason not found' }, { status: 400 });
    }

    currentHistory.push({
      type: 'lost',
      at: new Date().toISOString(),
      byId: actorId,
      byName: actorName,
      atStage: enquiry.stage,
    });

    const updated = await prisma.enquiry.update({
      where: { id },
      data: {
        outcome: 'Lost',
        status: 'DROPPED',
        lostAt: new Date(),
        lostAtStage: enquiry.stage,
        lostReasonId: reason.id,
        lostReason: reason.name,
        lostNote: (lostNote || '').trim(),
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
    console.error('Error in PATCH /api/enquiries/[id]/outcome:', error);
    return NextResponse.json({ error: error.message || 'Failed to update outcome' }, { status: 500 });
  }
}
