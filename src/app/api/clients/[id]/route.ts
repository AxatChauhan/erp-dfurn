import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeGstin } from '@/lib/clientUtils';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        enquiries: {
          select: { id: true, enquiryNumber: true, status: true, estimatedBudget: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        },
        quotations: {
          select: { id: true, quotationNumber: true, status: true, totalAmount: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    let pan = body.pan;
    let state = body.state;
    if (body.taxId) {
      const gstinAnalysis = analyzeGstin(body.taxId);
      if (gstinAnalysis.pan && !pan) pan = gstinAnalysis.pan;
      if (gstinAnalysis.stateName && !state) state = gstinAnalysis.stateName;
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        clientCode: body.clientCode !== undefined ? body.clientCode : undefined,
        name: body.name !== undefined ? body.name.trim() : undefined,
        clientType: body.clientType !== undefined ? body.clientType : undefined,
        contactPerson: body.contactPerson !== undefined ? body.contactPerson?.trim() || null : undefined,
        emails: body.emails !== undefined ? body.emails : undefined,
        phones: body.phones !== undefined ? body.phones : undefined,
        addresses: body.addresses !== undefined ? body.addresses : undefined,
        sourceCategory: body.sourceCategory !== undefined ? body.sourceCategory : undefined,
        sourceName: body.sourceName !== undefined ? body.sourceName : undefined,
        taxId: body.taxId !== undefined ? body.taxId?.trim().toUpperCase() || null : undefined,
        pan: pan !== undefined ? pan?.trim().toUpperCase() || null : undefined,
        state: state !== undefined ? state?.trim() || null : undefined,
        country: body.country !== undefined ? body.country?.trim() || 'IN' : undefined,
        paymentTerms: body.paymentTerms !== undefined ? body.paymentTerms : undefined,
        creditLimit: body.creditLimit !== undefined ? (body.creditLimit ? parseFloat(body.creditLimit) : 0) : undefined,
        outstandingBalance: body.outstandingBalance !== undefined ? (body.outstandingBalance ? parseFloat(body.outstandingBalance) : 0) : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: error.message || 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check if client has linked enquiries or quotations
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: { enquiries: true, quotations: true }
        }
      }
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (client._count.enquiries > 0 || client._count.quotations > 0) {
      return NextResponse.json({
        error: `Cannot delete client with active records: ${client._count.enquiries} enquiries and ${client._count.quotations} quotations are linked. Archive or deactivate the client instead.`
      }, { status: 400 });
    }

    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Client deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete client' }, { status: 500 });
  }
}
