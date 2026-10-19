import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';

interface RouteContext {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

/**
 * PUT /api/products/hierarchy/[type]/[id]
 * Updates name or code with 409 collision prevention.
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Admin or Manager privileges required to update product hierarchy' },
        { status: 403 }
      );
    }

    const { type, id } = await context.params;
    const body = await req.json();
    const { name, code } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedCode = code ? code.trim().toUpperCase() : undefined;

    if (type === 'segment') {
      const collision = await prisma.segment.findFirst({
        where: {
          id: { not: id },
          OR: [
            { name: { equals: trimmedName, mode: 'insensitive' } },
            ...(trimmedCode ? [{ code: trimmedCode }] : []),
          ],
        },
      });
      if (collision) {
        return NextResponse.json(
          { ok: false, error: `Segment "${trimmedName}" or code "${trimmedCode}" is already in use.` },
          { status: 409 }
        );
      }
      const updated = await prisma.segment.update({
        where: { id },
        data: { name: trimmedName, ...(trimmedCode ? { code: trimmedCode } : {}) },
      });
      return NextResponse.json({ ok: true, data: updated });
    }

    if (type === 'category') {
      const collision = await prisma.category.findFirst({
        where: {
          id: { not: id },
          OR: [
            { name: { equals: trimmedName, mode: 'insensitive' } },
            ...(trimmedCode ? [{ code: trimmedCode }] : []),
          ],
        },
      });
      if (collision) {
        return NextResponse.json(
          { ok: false, error: `Category "${trimmedName}" or code "${trimmedCode}" is already in use.` },
          { status: 409 }
        );
      }
      const updated = await prisma.category.update({
        where: { id },
        data: { name: trimmedName, ...(trimmedCode ? { code: trimmedCode } : {}) },
      });
      return NextResponse.json({ ok: true, data: updated });
    }

    if (type === 'subcategory') {
      const current = await prisma.subCategory.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ ok: false, error: 'Sub-category not found' }, { status: 404 });

      const collision = await prisma.subCategory.findFirst({
        where: {
          id: { not: id },
          categoryId: current.categoryId,
          OR: [
            { name: { equals: trimmedName, mode: 'insensitive' } },
            ...(trimmedCode ? [{ code: trimmedCode }] : []),
          ],
        },
      });
      if (collision) {
        return NextResponse.json(
          { ok: false, error: `Sub-category "${trimmedName}" or code "${trimmedCode}" is already in use.` },
          { status: 409 }
        );
      }
      const updated = await prisma.subCategory.update({
        where: { id },
        data: { name: trimmedName, ...(trimmedCode ? { code: trimmedCode } : {}) },
      });
      try {
        revalidateTag('products-catalog', { expire: 0 });
      } catch {}
      return NextResponse.json({ ok: true, data: updated });
    }

    return NextResponse.json({ ok: false, error: 'Invalid type' }, { status: 400 });
  } catch (err: any) {
    console.error('[hierarchy/PUT] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/products/hierarchy/[type]/[id]
 * Delete guards with human-readable error messages and RBAC gates.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedSession(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: Admin or Manager privileges required to delete product hierarchy' },
        { status: 403 }
      );
    }

    const { type, id } = await context.params;

    if (type === 'segment') {
      const existing = await prisma.segment.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ ok: false, error: 'Segment not found' }, { status: 404 });

      const catCount = await prisma.category.count({ where: { segmentId: id } });
      if (catCount > 0) {
        return NextResponse.json(
          { ok: false, error: `Cannot delete: ${catCount} categories still reference this segment. Reassign or delete them first.` },
          { status: 409 }
        );
      }
      await prisma.segment.delete({ where: { id } });
      try { revalidateTag('products-catalog', { expire: 0 }); } catch {}
      return NextResponse.json({ ok: true });
    }

    if (type === 'category') {
      const existing = await prisma.category.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ ok: false, error: 'Category not found' }, { status: 404 });

      const [subCatCount, prodCount] = await Promise.all([
        prisma.subCategory.count({ where: { categoryId: id } }),
        prisma.masterProduct.count({ where: { categoryId: id } }),
      ]);
      if (subCatCount > 0 || prodCount > 0) {
        const parts = [];
        if (subCatCount > 0) parts.push(`${subCatCount} sub-categories`);
        if (prodCount > 0) parts.push(`${prodCount} master products`);
        return NextResponse.json(
          { ok: false, error: `Cannot delete: ${parts.join(' and ')} still reference this category. Reassign or delete them first.` },
          { status: 409 }
        );
      }
      await prisma.category.delete({ where: { id } });
      try { revalidateTag('products-catalog', { expire: 0 }); } catch {}
      return NextResponse.json({ ok: true });
    }

    if (type === 'subcategory') {
      const existing = await prisma.subCategory.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ ok: false, error: 'Sub-category not found' }, { status: 404 });

      const prodCount = await prisma.masterProduct.count({ where: { subCategoryId: id } });
      if (prodCount > 0) {
        return NextResponse.json(
          { ok: false, error: `Cannot delete: ${prodCount} master products still reference this sub-category. Delete or reassign them first.` },
          { status: 409 }
        );
      }
      await prisma.subCategory.delete({ where: { id } });
      try { revalidateTag('products-catalog', { expire: 0 }); } catch {}
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Invalid type' }, { status: 400 });
  } catch (err: any) {
    console.error('[hierarchy/DELETE] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
