import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';
import { processStatusOf, bomStatusOf, packingStatusOf } from '@/lib/products/status';

/**
 * GET /api/products/config?entityType=...&id=...
 * Returns the 5 configuration summaries for the workspace.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType') || 'master-products';
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Entity ID is required' }, { status: 400 });
    }

    if (entityType === 'master-products') {
      const product = await prisma.masterProduct.findUnique({
        where: { id },
        include: {
          category: true,
          subCategory: true,
        },
      });
      if (!product) return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });

      const departments = await prisma.department.findMany({
        where: { id: { in: product.departmentIds } },
      });

      return NextResponse.json({
        ok: true,
        entity: {
          id: product.id,
          code: product.code,
          name: product.name,
          baseSellingRate: product.baseSellingRate,
          departmentIds: product.departmentIds,
          departments,
          processChart: product.processChart || {},
          bom: product.bom || { configured: false, sections: {} },
          packingList: product.packingList || { configured: false, boxes: [] },
          costing: null,
          statuses: {
            process: processStatusOf(product),
            bom: bomStatusOf(product.bom),
            packing: packingStatusOf(product.packingList),
          },
        },
      });
    }

    if (entityType === 'variants') {
      const variant = await prisma.variant.findUnique({
        where: { id },
        include: {
          masterProduct: true,
        },
      });
      if (!variant) return NextResponse.json({ ok: false, error: 'Variant not found' }, { status: 404 });

      const departments = await prisma.department.findMany({
        where: { id: { in: variant.departmentIds } },
      });

      return NextResponse.json({
        ok: true,
        entity: {
          id: variant.id,
          code: variant.code,
          name: variant.name,
          baseSellingRate: variant.baseSellingRate,
          departmentIds: variant.departmentIds,
          departments,
          processChart: variant.processChart || {},
          bom: variant.bom || { configured: false, sections: {} },
          packingList: variant.packingList || { configured: false, boxes: [] },
          costing: variant.costing || null,
          statuses: {
            process: processStatusOf(variant),
            bom: bomStatusOf(variant.bom),
            packing: packingStatusOf(variant.packingList),
          },
        },
      });
    }

    return NextResponse.json({ ok: false, error: 'Invalid entityType' }, { status: 400 });
  } catch (err: any) {
    console.error('[config/GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/products/config
 * Updates a configuration step (processChart, bom, packingList, costing).
 * Body: { entityType: 'master-products' | 'variants', id: string, step: string, data: any }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Admin or Manager privileges required to update product configuration' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { entityType, id, step, data } = body;

    if (!id || !step || data === undefined) {
      return NextResponse.json({ ok: false, error: 'id, step, and data are required' }, { status: 400 });
    }

    const updatePayload: any = {};
    if (step === 'process') updatePayload.processChart = data;
    else if (step === 'bom') updatePayload.bom = data;
    else if (step === 'packing') updatePayload.packingList = data;
    else if (step === 'costing') updatePayload.costing = data;
    else return NextResponse.json({ ok: false, error: 'Invalid step' }, { status: 400 });

    if (entityType === 'master-products') {
      const updated = await prisma.masterProduct.update({
        where: { id },
        data: updatePayload,
      });
      try {
        revalidateTag('products-catalog', { expire: 0 });
      } catch {}
      return NextResponse.json({ ok: true, data: updated });
    }

    if (entityType === 'variants') {
      const updated = await prisma.variant.update({
        where: { id },
        data: updatePayload,
      });
      try {
        revalidateTag('products-catalog', { expire: 0 });
      } catch {}
      return NextResponse.json({ ok: true, data: updated });
    }

    return NextResponse.json({ ok: false, error: 'Invalid entityType' }, { status: 400 });
  } catch (err: any) {
    console.error('[config/PUT] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
