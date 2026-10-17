import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALLOWED_MODES = ['Call', 'Email', 'WhatsApp', 'Meeting', 'Site Visit'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  try {
    const { id, logId } = await params;
    const body = await req.json();

    const existing = await prisma.communicationLog.findUnique({
      where: { id: logId }
    });

    if (!existing || existing.enquiryId !== id) {
      return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });
    }

    const patch: any = {};
    if (body.date !== undefined) {
      patch.date = typeof body.date === 'string' ? body.date.slice(0, 10) : new Date(body.date).toISOString().slice(0, 10);
    }
    if (body.mode !== undefined) {
      if (!ALLOWED_MODES.includes(body.mode)) {
        return NextResponse.json({ error: `Mode must be one of: ${ALLOWED_MODES.join(', ')}` }, { status: 400 });
      }
      patch.mode = body.mode;
    }
    if (body.description !== undefined) {
      if (!body.description.trim()) {
        return NextResponse.json({ error: 'Description cannot be empty' }, { status: 400 });
      }
      patch.description = body.description.trim();
    }
    if (body.comment !== undefined) patch.comment = String(body.comment).trim();

    const updated = await prisma.communicationLog.update({
      where: { id: logId },
      data: patch
    });

    return NextResponse.json({
      ok: true,
      record: {
        ...updated,
        date: updated.date,
        createdAt: updated.createdAt.toISOString(),
      }
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/enquiries/[id]/logs/[logId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update log entry' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  try {
    const { id, logId } = await params;

    const existing = await prisma.communicationLog.findUnique({
      where: { id: logId }
    });

    if (!existing || existing.enquiryId !== id) {
      return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });
    }

    await prisma.communicationLog.delete({ where: { id: logId } });

    // Note: Parent enquiry's hasCommunication remains true by design
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/enquiries/[id]/logs/[logId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete log entry' }, { status: 500 });
  }
}
