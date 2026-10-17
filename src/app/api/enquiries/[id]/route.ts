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
      lineItems: enquiry.items || [],
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

    // Cascade delete related records
    await prisma.enquiryItem.deleteMany({ where: { enquiryId: id } });
    await prisma.communicationLog.deleteMany({ where: { enquiryId: id } });
    await prisma.enquiryFile.deleteMany({ where: { enquiryId: id } });
    await prisma.enquiry.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Enquiry deleted successfully' });
  } catch (error: any) {
    console.error('Error in DELETE /api/enquiries/[id]:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete enquiry' }, { status: 500 });
  }
}
