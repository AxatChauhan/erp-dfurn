import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';
import { nextVariantCode } from '@/lib/products/codeGen';
import { computeCbm, dimensionsInInches, isPositiveDimensions } from '@/lib/products/measures';
import { processStatusOf, bomStatusOf, packingStatusOf } from '@/lib/products/status';

/**
 * Helper to re-base BOM part codes from master to variant.
 * e.g. WKSPC-PEDU-AMB-P01 -> WKSPC-PEDU-AMB-001-P01
 */
function rebaseBom(masterBom: any, variantCode: string): any {
  if (!masterBom || typeof masterBom !== 'object' || !masterBom.sections) {
    return { configured: false, sections: {} };
  }
  const cloned = JSON.parse(JSON.stringify(masterBom));
  cloned.configured = false; // Variant BOM needs review
  cloned.needsReview = true;

  if (cloned.sections?.assembly?.parts && Array.isArray(cloned.sections.assembly.parts)) {
    cloned.sections.assembly.parts = cloned.sections.assembly.parts.map((p: any, idx: number) => {
      const pNum = String(idx + 1).padStart(2, '0');
      const newPartCode = `${variantCode}-P${pNum}`;
      return {
        ...p,
        id: crypto.randomUUID(),
        code: newPartCode,
      };
    });
  }

  return cloned;
}

/**
 * GET /api/products/variants
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const masterProductId = searchParams.get('masterProductId');

    const where: any = {};
    if (masterProductId) where.masterProductId = masterProductId;

    const variants = await prisma.variant.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        masterProduct: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    const enriched = variants.map((v) => {
      const naked = v.nakedDimensions as any;
      const box = v.boxDimensions as any;
      return {
        ...v,
        cbm: computeCbm(box),
        nakedDimensionsInches: dimensionsInInches(naked),
        boxDimensionsInches: dimensionsInInches(box),
        processStatus: processStatusOf(v),
        bomStatus: bomStatusOf(v.bom),
        packingStatus: packingStatusOf(v.packingList),
      };
    });

    return NextResponse.json({ ok: true, variants: enriched });
  } catch (err: any) {
    console.error('[variants/GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/products/variants
 * Creates a Variant with inheritance, SFG auto-seeding, and monotonic code generation.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Admin or Manager privileges required to create variants' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { masterProductId, name, code, ...overrides } = body;

    if (!masterProductId) {
      return NextResponse.json({ ok: false, error: 'Master Product ID is required' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'Variant name is required' }, { status: 400 });
    }

    const master = await prisma.masterProduct.findUnique({
      where: { id: masterProductId },
      include: {
        variants: { select: { code: true } },
      },
    });

    if (!master) {
      return NextResponse.json({ ok: false, error: 'Master Product not found' }, { status: 404 });
    }

    const existingCodes = master.variants.map((v) => v.code);
    const finalCode = (code && code.trim())
      ? code.trim().toUpperCase()
      : nextVariantCode(master.code, existingCodes);

    const collision = await prisma.variant.findUnique({
      where: { code: finalCode },
      select: { name: true },
    });
    if (collision) {
      return NextResponse.json(
        { ok: false, error: `Variant code "${finalCode}" is already in use by "${collision.name}".` },
        { status: 409 }
      );
    }

    // Merge overrides with inherited fields
    const departmentIds = overrides.departmentIds || master.departmentIds;
    const specifications = overrides.specifications || master.specifications;
    const nakedDimensions = overrides.nakedDimensions || master.nakedDimensions;
    const boxDimensions = overrides.boxDimensions || master.boxDimensions;
    const defaultDeliveryMode = overrides.defaultDeliveryMode || master.defaultDeliveryMode;
    const defaultCreationMode = overrides.defaultCreationMode || master.defaultCreationMode;
    const unitOfMeasurement = overrides.unitOfMeasurement || master.unitOfMeasurement;
    const baseSellingRate = typeof overrides.baseSellingRate === 'number'
      ? Math.round(overrides.baseSellingRate)
      : Math.round(master.baseSellingRate);

    // Re-base inherited BOM and inherit Process Chart
    const variantBom = rebaseBom(master.bom, finalCode);
    const processChart = master.processChart || {};

    const variant = await prisma.variant.create({
      data: {
        masterProductId: master.id,
        code: finalCode,
        name: name.trim(),
        departmentIds,
        specifications,
        nakedDimensions,
        boxDimensions,
        defaultDeliveryMode,
        defaultCreationMode,
        unitOfMeasurement,
        baseSellingRate,
        leadTimeDays: overrides.leadTimeDays ?? master.leadTimeDays,
        moq: overrides.moq ?? master.moq,
        processChart,
        bom: variantBom,
        packingList: master.packingList || { configured: false, boxes: [] },
        costing: overrides.costing || null,
        thumbnail: overrides.thumbnail || master.thumbnail,
        images: overrides.images || [],
        documents: overrides.documents || [],
      },
    });

    // Auto-seed Semi-Finished Goods (SFG) at Qty 0 for assembly parts in the re-based BOM
    const parts = (variantBom?.sections?.assembly?.parts || []) as any[];
    if (parts.length > 0) {
      await prisma.semiFinishedGood.createMany({
        data: parts.map((part) => ({
          code: part.code,
          name: part.name || `Part ${part.code}`,
          variantId: variant.id,
          sourcing: part.sourcing || 'in-house',
          stockQty: 0,
        })),
        skipDuplicates: true,
      });
    }

    try {
      revalidateTag('products-catalog', { expire: 0 });
    } catch {}

    return NextResponse.json({ ok: true, variant });
  } catch (err: any) {
    console.error('[variants/POST] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
