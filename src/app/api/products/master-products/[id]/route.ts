import { NextRequest, NextResponse, connection } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';
import { computeCbm, dimensionsInInches, isPositiveDimensions } from '@/lib/products/measures';
import { processStatusOf, bomStatusOf, packingStatusOf } from '@/lib/products/status';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/products/master-products/[id]
 * Full master product detail.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  await connection();
  try {
    const { id } = await context.params;
    const product = await prisma.masterProduct.findUnique({
      where: { id },
      include: {
        category: true,
        subCategory: true,
        variants: {
          orderBy: { code: 'asc' },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ ok: false, error: 'Master Product not found' }, { status: 404 });
    }

    const departments = await prisma.department.findMany({
      where: { id: { in: product.departmentIds } },
    });
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    const naked = product.nakedDimensions as any;
    const box = product.boxDimensions as any;

    return NextResponse.json({
      ok: true,
      product: {
        ...product,
        cbm: computeCbm(box),
        nakedDimensionsInches: dimensionsInInches(naked),
        boxDimensionsInches: dimensionsInInches(box),
        departments: product.departmentIds.map((did) => deptMap.get(did) || did),
        processStatus: processStatusOf(product),
        bomStatus: bomStatusOf(product.bom),
        packingStatus: packingStatusOf(product.packingList),
      },
    });
  } catch (err: any) {
    console.error('[master-products/[id]/GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/products/master-products/[id]
 * Updates master product with 409 code collision check and RBAC gate.
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Admin or Manager privileges required to update master products' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.masterProduct.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Master Product not found' }, { status: 404 });
    }

    if (body.code && body.code.trim().toUpperCase() !== existing.code) {
      const newCode = body.code.trim().toUpperCase();
      const collision = await prisma.masterProduct.findUnique({
        where: { code: newCode },
      });
      if (collision && collision.id !== id) {
        return NextResponse.json(
          { ok: false, error: `Code "${newCode}" is already in use by "${collision.name}".` },
          { status: 409 }
        );
      }
    }

    const dataToUpdate: any = {};
    const allowed = [
      'name', 'code', 'departmentIds', 'specifications', 'nakedDimensions',
      'boxDimensions', 'defaultDeliveryMode', 'defaultCreationMode',
      'unitOfMeasurement', 'baseSellingRate', 'grossMarginTargetPct',
      'leadTimeDays', 'moq', 'thumbnail', 'images', 'documents',
      'processChart', 'bom', 'packingList',
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        dataToUpdate[key] = body[key];
      }
    }

    if (dataToUpdate.code) dataToUpdate.code = dataToUpdate.code.trim().toUpperCase();
    if (dataToUpdate.name) dataToUpdate.name = dataToUpdate.name.trim();
    if (dataToUpdate.baseSellingRate) dataToUpdate.baseSellingRate = Math.round(dataToUpdate.baseSellingRate);

    const updated = await prisma.masterProduct.update({
      where: { id },
      data: dataToUpdate,
    });

    try {
      revalidateTag('products-catalog', { expire: 0 });
    } catch {}

    return NextResponse.json({ ok: true, product: updated });
  } catch (err: any) {
    console.error('[master-products/[id]/PUT] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/products/master-products/[id]
 * Delete guard: Enforces RBAC & Blocks deletion if variants exist.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Admin or Manager privileges required to delete master products' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const variantCount = await prisma.variant.count({
      where: { masterProductId: id },
    });

    if (variantCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot delete: ${variantCount} Variants still exist under this product. Delete them first.`,
        },
        { status: 409 }
      );
    }

    await prisma.masterProduct.delete({ where: { id } });

    try {
      revalidateTag('products-catalog', { expire: 0 });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[master-products/[id]/DELETE] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
