import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';
import { computeCbm, dimensionsInInches } from '@/lib/products/measures';
import { processStatusOf, bomStatusOf, packingStatusOf } from '@/lib/products/status';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const variant = await prisma.variant.findUnique({
      where: { id },
      include: {
        masterProduct: true,
        semiFinishedGoods: true,
      },
    });

    if (!variant) {
      return NextResponse.json({ ok: false, error: 'Variant not found' }, { status: 404 });
    }

    const naked = variant.nakedDimensions as any;
    const box = variant.boxDimensions as any;

    return NextResponse.json({
      ok: true,
      variant: {
        ...variant,
        cbm: computeCbm(box),
        nakedDimensionsInches: dimensionsInInches(naked),
        boxDimensionsInches: dimensionsInInches(box),
        processStatus: processStatusOf(variant),
        bomStatus: bomStatusOf(variant.bom),
        packingStatus: packingStatusOf(variant.packingList),
      },
    });
  } catch (err: any) {
    console.error('[variants/[id]/GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Admin or Manager privileges required to update variants' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.variant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Variant not found' }, { status: 404 });
    }

    if (body.code && body.code.trim().toUpperCase() !== existing.code) {
      const newCode = body.code.trim().toUpperCase();
      const collision = await prisma.variant.findUnique({
        where: { code: newCode },
      });
      if (collision && collision.id !== id) {
        return NextResponse.json(
          { ok: false, error: `Variant code "${newCode}" is already in use by "${collision.name}".` },
          { status: 409 }
        );
      }
    }

    const dataToUpdate: any = {};
    const allowed = [
      'name', 'code', 'departmentIds', 'specifications', 'nakedDimensions',
      'boxDimensions', 'defaultDeliveryMode', 'defaultCreationMode',
      'unitOfMeasurement', 'baseSellingRate', 'leadTimeDays', 'moq',
      'thumbnail', 'images', 'documents', 'processChart', 'bom', 'packingList', 'costing'
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) dataToUpdate[key] = body[key];
    }

    if (dataToUpdate.code) dataToUpdate.code = dataToUpdate.code.trim().toUpperCase();
    if (dataToUpdate.name) dataToUpdate.name = dataToUpdate.name.trim();
    if (dataToUpdate.baseSellingRate) dataToUpdate.baseSellingRate = Math.round(dataToUpdate.baseSellingRate);

    const updated = await prisma.variant.update({
      where: { id },
      data: dataToUpdate,
    });

    try {
      revalidateTag('products-catalog', { expire: 0 });
    } catch {}

    return NextResponse.json({ ok: true, variant: updated });
  } catch (err: any) {
    console.error('[variants/[id]/PUT] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Admin or Manager privileges required to delete variants' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const existing = await prisma.variant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Variant not found' }, { status: 404 });
    }

    await prisma.variant.delete({ where: { id } });

    try {
      revalidateTag('products-catalog', { expire: 0 });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[variants/[id]/DELETE] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
