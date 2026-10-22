import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: {
        client: true,
        category: true,
        salesperson: true,
        items: true,
        communicationLogs: {
          orderBy: { date: 'desc' }
        },
        files: {
          orderBy: { createdAt: 'desc' }
        },
        quotations: {
          include: {
            versions: {
              orderBy: { versionNo: 'desc' }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        jobOrders: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    const latestQuote = enquiry.quotations?.[0] || null;
    const latestJob = enquiry.jobOrders?.[0] || null;

    const formattedQuote = latestQuote ? {
      id: latestQuote.id,
      quotationNumber: latestQuote.quotationNumber,
      number: latestQuote.quotationNumber,
      status: latestQuote.status,
      effectiveStatus: latestQuote.status,
      totalAmount: latestQuote.totalAmount,
      createdAt: latestQuote.createdAt.toISOString(),
      versions: latestQuote.versions.map(v => ({
        id: v.id,
        versionNo: v.versionNo,
        versionCode: v.versionCode,
        versionLabel: v.versionCode,
        grossTotal: v.grossTotal,
        totals: { grandTotal: v.grossTotal },
        status: v.status,
        createdAt: v.createdAt.toISOString(),
      })),
      currentVersion: latestQuote.versions?.[0] ? {
        id: latestQuote.versions[0].id,
        versionNo: latestQuote.versions[0].versionNo,
        versionCode: latestQuote.versions[0].versionCode,
        versionLabel: latestQuote.versions[0].versionCode,
        totals: { grandTotal: latestQuote.versions[0].grossTotal },
        status: latestQuote.versions[0].status,
        createdAt: latestQuote.versions[0].createdAt.toISOString(),
      } : {
        versionNo: 1,
        versionCode: 'v1',
        versionLabel: 'v1',
        totals: { grandTotal: latestQuote.totalAmount },
      }
    } : null;

    const formattedJob = latestJob ? {
      id: latestJob.id,
      jobNumber: latestJob.jobNumber,
      status: latestJob.status,
      bomStatus: latestJob.bomStatus,
      procurementStatus: latestJob.procurementStatus,
      productionStatus: latestJob.productionStatus,
      holdReason: latestJob.holdReason,
      cancelledReason: latestJob.cancelledReason,
      productionDueDate: latestJob.productionDueDate ? latestJob.productionDueDate.toISOString() : null,
      createdAt: latestJob.createdAt.toISOString(),
      orderDate: latestJob.orderDate ? latestJob.orderDate.toISOString() : null,
      createdByName: latestJob.salespersonName || null,
    } : null;

    const clientPhones = Array.isArray(enquiry.client?.phones) ? (enquiry.client.phones as string[]) : [];
    const clientEmails = Array.isArray(enquiry.client?.emails) ? (enquiry.client.emails as string[]) : [];
    const clientPhoneDetails = Array.isArray(enquiry.client?.phoneDetails) ? enquiry.client.phoneDetails : [];
    const clientAddresses = Array.isArray(enquiry.client?.addresses) ? enquiry.client.addresses : [];

    // Enrich line items with master product metadata (photos, SKU, dimensions, lead times)
    const productIds = (enquiry.items || [])
      .map(it => it.refId)
      .filter((id): id is string => Boolean(id));

    let productsMap = new Map<string, any>();
    if (productIds.length > 0) {
      const prods = await prisma.masterProduct.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          code: true,
          name: true,
          thumbnail: true,
          unitOfMeasurement: true,
          nakedDimensions: true,
          leadTimeDays: true,
          defaultDeliveryMode: true,
          baseSellingRate: true,
        }
      });
      prods.forEach(p => productsMap.set(p.id, p));
    }

    const enrichedItems = (enquiry.items || []).map(it => {
      const prod = it.refId ? productsMap.get(it.refId) : null;
      return {
        ...it,
        product: prod || null,
        thumbnail: prod?.thumbnail || null,
        productCode: prod?.code || null,
        productName: prod?.name || it.description,
        unit: prod?.unitOfMeasurement || 'Nos',
        leadTimeDays: prod?.leadTimeDays || null,
        defaultDeliveryMode: prod?.defaultDeliveryMode || null,
      };
    });

    const formattedEnquiry = {
      ...enquiry,
      code: enquiry.enquiryNumber,
      clientName: enquiry.client?.name || 'Unknown Client',
      clientCode: enquiry.client?.clientCode || null,
      clientPhones,
      clientEmails,
      client: enquiry.client ? {
        ...enquiry.client,
        displayName: enquiry.client.name,
        phones: clientPhones,
        emails: clientEmails,
        phoneDetails: clientPhoneDetails,
        addresses: clientAddresses,
      } : null,
      lineItems: enrichedItems,
      items: enrichedItems,
      logs: enquiry.communicationLogs.map(l => ({
        ...l,
        date: l.date,
        createdAt: l.createdAt.toISOString(),
      })),
      files: enquiry.files.map(f => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
      quote: formattedQuote,
      jobOrder: formattedJob,
      createdAt: enquiry.createdAt.toISOString(),
      updatedAt: enquiry.updatedAt.toISOString(),
    };

    return NextResponse.json({ enquiry: formattedEnquiry });
  } catch (error: any) {
    console.error('Error in GET /api/enquiries/[id]:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch enquiry' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.enquiry.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (body.brief !== undefined) updateData.brief = (body.brief || '').trim();
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;
    if (body.salespersonId !== undefined) {
      if (body.salespersonId) {
        const sp = await prisma.employee.findUnique({ where: { id: body.salespersonId } });
        updateData.salespersonId = sp ? sp.id : null;
        updateData.salespersonName = sp ? sp.name : null;
      } else {
        updateData.salespersonId = null;
        updateData.salespersonName = null;
      }
    }

    let calculatedOppValue = existing.opportunityValue;

    await prisma.$transaction(async (tx) => {
      if (Array.isArray(body.items)) {
        await tx.enquiryItem.deleteMany({ where: { enquiryId: id } });

        const itemCreates = body.items.map((it: any) => {
          const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
          const price = Math.max(0, parseFloat(it.unitPrice) || 0);
          const tot = Math.max(0, parseFloat(it.total) || (qty * price));
          return {
            enquiryId: id,
            description: (it.productName || it.name || it.description || 'Custom Unit').trim(),
            quantity: qty,
            unitPrice: price,
            total: tot,
            expectedDimensions: it.expectedDimensions || null,
            materialPreference: it.materialPreference || null,
            clientComment: it.clientComment || null,
            refType: it.refType || 'MasterProduct',
            refId: it.refId || null,
            customizations: it.customizations || undefined,
          };
        });

        if (itemCreates.length > 0) {
          await tx.enquiryItem.createMany({ data: itemCreates });
          calculatedOppValue = itemCreates.reduce((sum: number, it: any) => sum + it.total, 0);
        } else {
          calculatedOppValue = null;
        }

        updateData.opportunityValue = calculatedOppValue;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.enquiry.update({
          where: { id },
          data: updateData,
        });
      }
    });

    const updated = await prisma.enquiry.findUnique({
      where: { id },
      include: {
        client: true,
        category: true,
        salesperson: true,
        items: true,
      }
    });

    return NextResponse.json({ success: true, enquiry: updated });
  } catch (error: any) {
    console.error('Error in PATCH /api/enquiries/[id]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update enquiry' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: {
        quotations: true,
        communicationLogs: true,
        files: true,
      }
    });

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    // Guard 1: Cannot delete if quotation exists
    if (enquiry.quotations.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete: this enquiry has a Quote. Quotes are permanent records once created.'
      }, { status: 409 });
    }

    // Guard 2: Cannot delete if communication has ever been logged
    if (enquiry.hasCommunication || enquiry.communicationLogs.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete: communication has already been logged on this enquiry, so it is kept as the record of it.'
      }, { status: 409 });
    }

    // Cascade delete related records atomically
    await prisma.$transaction(async (tx) => {
      await tx.enquiryItem.deleteMany({ where: { enquiryId: id } });
      await tx.communicationLog.deleteMany({ where: { enquiryId: id } });
      await tx.enquiryFile.deleteMany({ where: { enquiryId: id } });
      await tx.enquiry.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: 'Enquiry deleted successfully' });
  } catch (error: any) {
    console.error('Error in DELETE /api/enquiries/[id]:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete enquiry' }, { status: 500 });
  }
}
