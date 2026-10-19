import { NextRequest, NextResponse, connection } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';
import { autoCode } from '@/lib/products/codeGen';

/**
 * GET /api/products/hierarchy
 * Returns full 3-tier hierarchy: Segments -> Categories -> Sub-Categories
 */
export async function GET() {
  await connection();
  try {
    const segments = await prisma.segment.findMany({
      orderBy: { name: 'asc' },
      include: {
        categories: {
          orderBy: { name: 'asc' },
          include: {
            subCategories: {
              orderBy: { name: 'asc' },
              include: {
                _count: {
                  select: { masterProducts: true },
                },
              },
            },
            _count: {
              select: { subCategories: true, masterProducts: true },
            },
          },
        },
        _count: {
          select: { categories: true },
        },
      },
    });

    return NextResponse.json({ ok: true, segments });
  } catch (err: any) {
    console.error('[hierarchy/GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/products/hierarchy
 * Creates a Segment, Category, or Sub-Category with 409 collision prevention.
 * Body: { type: 'segment' | 'category' | 'subcategory', name: string, code?: string, parentId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Admin or Manager privileges required to create product hierarchy' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { type, name, code, parentId } = body;

    if (!type || !name || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'Type and name are required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const finalCode = (code && code.trim()) ? code.trim().toUpperCase() : autoCode(trimmedName);

    if (type === 'segment') {
      const existing = await prisma.segment.findFirst({
        where: {
          OR: [{ name: { equals: trimmedName, mode: 'insensitive' } }, { code: finalCode }],
        },
      });
      if (existing) {
        return NextResponse.json(
          { ok: false, error: `Segment "${trimmedName}" or code "${finalCode}" already exists.` },
          { status: 409 }
        );
      }
      const segment = await prisma.segment.create({
        data: { name: trimmedName, code: finalCode },
      });
      return NextResponse.json({ ok: true, data: segment });
    }

    if (type === 'category') {
      if (!parentId) {
        return NextResponse.json({ ok: false, error: 'Segment ID is required for a category' }, { status: 400 });
      }
      const existing = await prisma.category.findFirst({
        where: {
          OR: [{ name: { equals: trimmedName, mode: 'insensitive' } }, { code: finalCode }],
        },
      });
      if (existing) {
        return NextResponse.json(
          { ok: false, error: `Category "${trimmedName}" or code "${finalCode}" already exists company-wide.` },
          { status: 409 }
        );
      }
      const category = await prisma.category.create({
        data: {
          name: trimmedName,
          code: finalCode,
          segmentId: parentId,
        },
      });
      return NextResponse.json({ ok: true, data: category });
    }

    if (type === 'subcategory') {
      if (!parentId) {
        return NextResponse.json({ ok: false, error: 'Category ID is required for a sub-category' }, { status: 400 });
      }
      const existing = await prisma.subCategory.findFirst({
        where: {
          categoryId: parentId,
          OR: [{ name: { equals: trimmedName, mode: 'insensitive' } }, { code: finalCode }],
        },
      });
      if (existing) {
        return NextResponse.json(
          { ok: false, error: `Sub-category "${trimmedName}" or code "${finalCode}" already exists in this category.` },
          { status: 409 }
        );
      }
      const subCategory = await prisma.subCategory.create({
        data: {
          name: trimmedName,
          code: finalCode,
          categoryId: parentId,
        },
      });

      try {
        revalidateTag('products-catalog', { expire: 0 });
      } catch {}

      return NextResponse.json({ ok: true, data: subCategory });
    }

    return NextResponse.json({ ok: false, error: 'Invalid hierarchy type' }, { status: 400 });
  } catch (err: any) {
    console.error('[hierarchy/POST] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
