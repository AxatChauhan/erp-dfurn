import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALLOWED_MODES = ['Call', 'Email', 'WhatsApp', 'Meeting', 'Site Visit'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const logs = await prisma.communicationLog.findMany({
      where: { enquiryId: id },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json({
      logs: logs.map(l => ({
        ...l,
        date: l.date,
        createdAt: l.createdAt.toISOString(),
      }))
    });
  } catch (error: any) {
    console.error('Error in GET /api/enquiries/[id]/logs:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { date, mode, description, comment, stage, loggedById, loggedByName } = body;

    const enquiry = await prisma.enquiry.findUnique({ where: { id } });
    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    const effectiveDate = date ? (typeof date === 'string' ? date.slice(0, 10) : new Date(date).toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
    const normalizedMode = mode === 'Phone' ? 'Call' : mode;

    const errors: string[] = [];
    if (!ALLOWED_MODES.includes(normalizedMode)) {
      errors.push(`Mode must be one of: ${ALLOWED_MODES.join(', ')}`);
    }
    if (!description || !description.trim()) errors.push('Description is required');

    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    const dateString = effectiveDate;

    const created = await prisma.$transaction(async (tx) => {
      const log = await tx.communicationLog.create({
        data: {
          enquiryId: id,
          stage: stage === 'Quote' ? 'Quote' : 'Enquiry',
          date: dateString,
          mode,
          description: description.trim(),
          comment: (comment || '').trim(),
          loggedById: loggedById || null,
          loggedByName: loggedByName || 'User',
        }
      });

      // The enquiry can no longer be deleted once anything has been logged on it.
      // Set once, never cleared.
      if (!enquiry.hasCommunication) {
        await tx.enquiry.update({
          where: { id },
          data: { hasCommunication: true }
        });
      }

      return log;
    });

    return NextResponse.json({
      ok: true,
      record: {
        ...created,
        date: created.date,
        createdAt: created.createdAt.toISOString(),
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/enquiries/[id]/logs:', error);
    return NextResponse.json({ error: error.message || 'Failed to add log entry' }, { status: 500 });
  }
}
