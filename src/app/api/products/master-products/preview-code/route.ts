import { NextRequest, NextResponse, connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatMasterProductCode } from '@/lib/products/codeGen';

/**
 * GET /api/products/master-products/preview-code?subCategoryId=...&name=...
 * Live 350ms debounced preview and uniqueness check.
 */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(req.url);
    const subCategoryId = searchParams.get('subCategoryId');
    const name = searchParams.get('name');

    if (!subCategoryId || !name || !name.trim()) {
      return NextResponse.json(
        { ok: false, error: 'subCategoryId and name are required' },
        { status: 400 }
      );
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
    const code = formatMasterProductCode(catCode, subCode, name);

    const existing = await prisma.masterProduct.findUnique({
      where: { code },
      select: { name: true },
    });

    return NextResponse.json({
      ok: true,
      code,
      available: !existing,
      conflictWith: existing ? existing.name : null,
    });
  } catch (err: any) {
    console.error('[preview-code/GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
