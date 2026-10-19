import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const catalogues = await prisma.standardCatalogue.findMany({
      orderBy: { name: 'asc' },
      include: {
        entries: {
          orderBy: { name: 'asc' },
        },
      },
    });

    return NextResponse.json({ ok: true, catalogues });
  } catch (err: any) {
    console.error('[standard-catalogues/GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, catalogueId, name, description, facets, entry } = body;

    if (action === 'create_catalogue') {
      if (!name || !name.trim()) return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
      const created = await prisma.standardCatalogue.create({
        data: {
          name: name.trim(),
          description: description || null,
          facets: facets || [],
        },
      });
      return NextResponse.json({ ok: true, catalogue: created });
    }

    if (action === 'create_entry') {
      if (!catalogueId || !entry || !entry.name) {
        return NextResponse.json({ ok: false, error: 'catalogueId and entry name are required' }, { status: 400 });
      }
      const created = await prisma.catalogueEntry.create({
        data: {
          catalogueId,
          name: entry.name.trim(),
          code: entry.code || null,
          swatch: entry.swatch || null,
          imageUrl: entry.imageUrl || null,
          attributes: entry.attributes || {},
          materialIds: entry.materialIds || [],
          isActive: entry.isActive !== false,
        },
      });
      return NextResponse.json({ ok: true, entry: created });
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[standard-catalogues/POST] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
