import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { categoryId, salespersonId, brief } = body;

    const enquiry = await prisma.enquiry.findUnique({ where: { id } });
    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    const patch: any = {};

    if (categoryId !== undefined) {
      if (categoryId) {
        const cat = await prisma.category.findUnique({ where: { id: categoryId } });
        if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 400 });
        patch.categoryId = cat.id;
      } else {
        patch.categoryId = null;
      }
    }

    if (salespersonId !== undefined) {
      if (salespersonId) {
        const sp = await prisma.employee.findUnique({ where: { id: salespersonId } });
        if (!sp) return NextResponse.json({ error: 'Salesperson not found' }, { status: 400 });
        patch.salespersonId = sp.id;
        patch.salespersonName = sp.name;
      } else {
        patch.salespersonId = null;
        patch.salespersonName = null;
      }
    }

    if (brief !== undefined) {
      if (typeof brief !== 'string') {
        return NextResponse.json({ error: 'Brief must be text' }, { status: 400 });
      }
      patch.brief = brief.trim();
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updated = await prisma.enquiry.update({
      where: { id },
      data: patch,
      include: { client: true, category: true, salesperson: true, items: true }
    });

    return NextResponse.json({
      enquiry: {
        ...updated,
        code: updated.enquiryNumber,
        clientName: updated.client?.name || '',
      }
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/enquiries/[id]/details:', error);
    return NextResponse.json({ error: error.message || 'Failed to update details' }, { status: 500 });
  }
}
