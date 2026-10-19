import { NextRequest, NextResponse, connection } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';
import { formatMasterProductCode } from '@/lib/products/codeGen';
import { computeCbm, dimensionsInInches, isPositiveDimensions, DELIVERY_MODES, UNITS, CREATION_MODES } from '@/lib/products/measures';
import { processStatusOf, bomStatusOf, packingStatusOf, toSlimListRow } from '@/lib/products/status';

/**
 * GET /api/products/master-products
 * Slim list for catalogue table with computed rollups.
 */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const segmentId = searchParams.get('segmentId');
    const categoryId = searchParams.get('categoryId');
    const subCategoryId = searchParams.get('subCategoryId');

    const where: any = {};
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (subCategoryId) {
      where.subCategoryId = subCategoryId;
    } else if (categoryId) {
      where.categoryId = categoryId;
    } else if (segmentId) {
      where.category = { segmentId };
    }

    const [products, departments] = await Promise.all([
      prisma.masterProduct.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: { id: true, name: true, code: true, segmentId: true },
          },
          subCategory: {
            select: { id: true, name: true, code: true },
          },
          variants: {
            select: {
              id: true,
              code: true,
              name: true,
              baseSellingRate: true,
              thumbnail: true,
              departmentIds: true,
              processChart: true,
              bom: true,
              packingList: true,
            },
            orderBy: { code: 'asc' },
          },
        },
      }),
      prisma.department.findMany({
        select: { id: true, name: true, code: true },
      }),
    ]);

    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    const enriched = products.map((p) => {
      const naked = p.nakedDimensions as any;
      const box = p.boxDimensions as any;
      const cbm = computeCbm(box);
      const inches = dimensionsInInches(naked);

      const variantCount = p.variants.length;
      const avgSellingPrice = variantCount > 0
        ? Math.round(p.variants.reduce((sum, v) => sum + v.baseSellingRate, 0) / variantCount)
        : null;

      const deptNames = p.departmentIds.map((id) => deptMap.get(id) || id);

      const enrichedVariants = p.variants.map((v) => ({
        id: v.id,
        code: v.code,
        name: v.name,
        baseSellingRate: v.baseSellingRate,
        thumbnail: v.thumbnail,
        processStatus: processStatusOf(v),
        bomStatus: bomStatusOf(v.bom),
        packingStatus: packingStatusOf(v.packingList),
      }));

      return toSlimListRow({
        id: p.id,
        code: p.code,
        name: p.name,
        categoryId: p.categoryId,
        categoryName: p.category.name,
        subCategoryId: p.subCategoryId,
        subCategoryName: p.subCategory.name,
        departmentIds: p.departmentIds,
        departments: deptNames,
        defaultDeliveryMode: p.defaultDeliveryMode,
        defaultCreationMode: p.defaultCreationMode,
        unitOfMeasurement: p.unitOfMeasurement,
        baseSellingRate: p.baseSellingRate,
        grossMarginTargetPct: p.grossMarginTargetPct,
        leadTimeDays: p.leadTimeDays,
        moq: p.moq,
        thumbnail: p.thumbnail,
        cbm,
        nakedDimensions: naked,
        boxDimensions: box,
        nakedDimensionsInches: inches,
        totalVariants: variantCount,
        avgSellingPrice,
        processStatus: processStatusOf(p),
        bomStatus: bomStatusOf(p.bom),
        packingStatus: packingStatusOf(p.packingList),
        variants: enrichedVariants,
        createdAt: p.createdAt,
      });
    });

    return NextResponse.json({ ok: true, products: enriched });
  } catch (err: any) {
    console.error('[master-products/GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/products/master-products
 * Creates a Master Product with 409 collision prevention.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Admin or Manager privileges required to create master products' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      subCategoryId,
      departmentIds,
      specifications,
      nakedDimensions,
      boxDimensions,
      defaultDeliveryMode,
      defaultCreationMode,
      unitOfMeasurement,
      baseSellingRate,
      grossMarginTargetPct,
      leadTimeDays,
      moq,
      code,
      thumbnail,
      images,
    } = body;

    // 1. Validation
    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'Product name is required' }, { status: 400 });
    }
    if (!subCategoryId) {
      return NextResponse.json({ ok: false, error: 'Sub-category is required' }, { status: 400 });
    }
    if (!Array.isArray(departmentIds) || departmentIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'At least one department is required' }, { status: 400 });
    }
    if (!isPositiveDimensions(nakedDimensions)) {
      return NextResponse.json({ ok: false, error: 'Valid naked dimensions (L B H mm) are required' }, { status: 400 });
    }
    if (!isPositiveDimensions(boxDimensions)) {
      return NextResponse.json({ ok: false, error: 'Valid box dimensions (L B H mm) are required' }, { status: 400 });
    }
    if (!DELIVERY_MODES.includes(defaultDeliveryMode)) {
      return NextResponse.json({ ok: false, error: 'Delivery mode must be RTA or Pre-assembled' }, { status: 400 });
    }
    if (!CREATION_MODES.includes(defaultCreationMode)) {
      return NextResponse.json({ ok: false, error: 'Creation mode must be In-house or Outsource' }, { status: 400 });
    }
    if (!UNITS.includes(unitOfMeasurement)) {
      return NextResponse.json({ ok: false, error: 'Unit of measurement is invalid' }, { status: 400 });
    }
    if (typeof baseSellingRate !== 'number' || baseSellingRate <= 0) {
      return NextResponse.json({ ok: false, error: 'Base selling rate must be a positive number' }, { status: 400 });
    }

    const subCategory = await prisma.subCategory.findUnique({
      where: { id: subCategoryId },
      include: { category: true },
    });
    if (!subCategory) {
      return NextResponse.json({ ok: false, error: 'Sub-category not found' }, { status: 404 });
    }

    const catCode = subCategory.category.code || 'CAT';
    const subCode = subCategory.code || 'SUB';
    const finalCode = (code && code.trim())
      ? code.trim().toUpperCase()
      : formatMasterProductCode(catCode, subCode, name);

    // 2. Uniqueness check (409 Conflict)
    const existing = await prisma.masterProduct.findUnique({
      where: { code: finalCode },
      select: { name: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: `Master Product code "${finalCode}" is already in use by "${existing.name}". Please adjust it manually.`,
        },
        { status: 409 }
      );
    }

    // 3. Create record
    const product = await prisma.masterProduct.create({
      data: {
        code: finalCode,
        name: name.trim(),
        categoryId: subCategory.categoryId,
        subCategoryId: subCategory.id,
        departmentIds,
        specifications: specifications || [],
        nakedDimensions,
        boxDimensions,
        defaultDeliveryMode,
        defaultCreationMode,
        unitOfMeasurement,
        baseSellingRate: Math.round(baseSellingRate),
        grossMarginTargetPct: typeof grossMarginTargetPct === 'number' ? grossMarginTargetPct : 30.0,
        leadTimeDays: typeof leadTimeDays === 'number' ? leadTimeDays : null,
        moq: typeof moq === 'number' ? moq : 1,
        thumbnail: thumbnail || null,
        images: images || [],
        processChart: {},
        bom: { configured: false, sections: {} },
        packingList: { configured: false, boxes: [] },
      },
    });

    try {
      revalidateTag('products-catalog', { expire: 0 });
    } catch {}

    return NextResponse.json({ ok: true, product });
  } catch (err: any) {
    console.error('[master-products/POST] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
