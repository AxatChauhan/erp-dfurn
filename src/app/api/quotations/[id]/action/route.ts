import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getAuthenticatedSession } from '@/lib/auth';
import { readinessOf, nextQuoteNumber, followupInfo, versionLabelOf, normalizeQuoteStatus } from '@/lib/quotations/quoteService';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getAuthenticatedSession(req);
    const cookieStore = await cookies();
    const userId = session?.userId || cookieStore.get('user_id')?.value || null;
    const userName = session?.name || cookieStore.get('user_name')?.value || 'Admin';
    const userRole = session?.role || cookieStore.get('user_role')?.value || 'SALES';

    const body = await req.json();
    const { action } = body;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        enquiry: true,
        versions: {
          orderBy: { versionNo: 'desc' },
          take: 1,
          include: { items: true, additionalCharges: true }
        }
      }
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const currentVersion = quotation.versions[0];
    if (!currentVersion) {
      return NextResponse.json({ error: 'No active version for quotation' }, { status: 400 });
    }

    const currentStatus = normalizeQuoteStatus(currentVersion.status);
    let newStatus = currentStatus;
    let extraVersionData: any = {};
    let extraQuoteData: any = {};

    switch (action) {
      case 'SUBMIT_FOR_VERIFICATION':
      case 'SUBMIT_VERIFICATION': {
        if (currentStatus !== 'Draft') {
          return NextResponse.json({ error: 'Only a draft can be submitted for verification' }, { status: 400 });
        }

        // 1. Mandatory 8-point Readiness check
        const readiness = readinessOf(quotation, quotation.client);
        if (!readiness.ready) {
          const open = readiness.items.filter(i => !i.done);
          return NextResponse.json(
            {
              error: `Not ready to submit: ${open.map(i => `${i.label} (${i.detail})`).join('; ')}`,
              errors: open.map(i => `${i.label}: ${i.detail}`),
              readiness
            },
            { status: 400 }
          );
        }

        // 2. Assign client-facing quotation number if not numbered yet
        if (!quotation.code) {
          const officialNumber = await nextQuoteNumber();
          extraQuoteData.code = officialNumber;
          extraQuoteData.quotationNumber = officialNumber;
          extraVersionData.versionCode = `${officialNumber}-${versionLabelOf(currentVersion.versionNo)}`;
        }

        newStatus = 'Verification Required';
        extraVersionData.submittedAt = new Date();

        // 3. Advance linked Enquiry to 'Quoted'
        if (quotation.enquiryId) {
          await prisma.enquiry.update({
            where: { id: quotation.enquiryId },
            data: { stage: 'Quoted', status: 'IN_PROGRESS' }
          }).catch(console.error);
        }
        break;
      }

      case 'VERIFY': {
        if (currentStatus !== 'Verification Required') {
          return NextResponse.json({ error: 'Quote is not awaiting verification' }, { status: 400 });
        }
        newStatus = 'Admin Approval Required';
        extraVersionData = {
          verifiedById: userId,
          verifiedByName: userName,
          verifiedAt: new Date()
        };
        break;
      }

      case 'APPROVE': {
        if (userRole !== 'SUPER_ADMIN') {
          return NextResponse.json({ error: 'Forbidden: Only Super Admin can approve quotations' }, { status: 403 });
        }
        if (currentStatus !== 'Admin Approval Required') {
          return NextResponse.json({ error: 'Quote is not awaiting approval' }, { status: 400 });
        }
        newStatus = 'Approved';
        extraVersionData = {
          approvedById: userId,
          approvedByName: userName,
          approvedAt: new Date(),
          verifiedAt: currentVersion.verifiedAt || new Date(),
          verifiedById: currentVersion.verifiedById || userId,
          verifiedByName: currentVersion.verifiedByName || userName
        };
        break;
      }

      case 'REJECT_APPROVAL':
      case 'REJECT': {
        if (userRole !== 'SUPER_ADMIN') {
          return NextResponse.json({ error: 'Forbidden: Only Super Admin can reject quotations' }, { status: 403 });
        }
        newStatus = 'Not Approved';
        break;
      }

      case 'MARK_SENT': {
        if (currentStatus !== 'Approved') {
          return NextResponse.json({ error: 'Only an Approved quote can be marked Sent' }, { status: 400 });
        }
        newStatus = 'Sent';
        extraVersionData = {
          sentAt: new Date()
        };
        break;
      }

      case 'LOG_FOLLOWUP': {
        if (currentStatus !== 'Sent') {
          return NextResponse.json({ error: 'Follow-up only applies to a quote that has been sent' }, { status: 400 });
        }
        const existingFollowups = Array.isArray(currentVersion.followupDoneAt)
          ? (currentVersion.followupDoneAt as string[])
          : [];
        extraVersionData = {
          followupDoneAt: [...existingFollowups, new Date().toISOString()]
        };

        // Write CommunicationLog entry if details provided
        if (body.description && quotation.enquiryId) {
          await prisma.communicationLog.create({
            data: {
              enquiryId: quotation.enquiryId,
              stage: 'Quote',
              date: new Date().toISOString().slice(0, 10),
              mode: body.mode || 'Phone',
              description: body.description,
              comment: body.comment || null,
              loggedById: userId,
              loggedByName: userName
            }
          }).catch(console.error);
        }
        break;
      }

      case 'CONVERT':
      case 'CLIENT_APPROVED': {
        if (currentStatus !== 'Sent') {
          return NextResponse.json({ error: 'Only a sent quote can be converted' }, { status: 400 });
        }
        newStatus = 'Converted';
        extraVersionData = {
          decidedAt: new Date()
        };

        // Advance linked enquiry to 'Converted'
        if (quotation.enquiryId) {
          await prisma.enquiry.update({
            where: { id: quotation.enquiryId },
            data: { stage: 'Converted', status: 'CONVERTED', outcome: 'Open' }
          }).catch(console.error);
        }
        break;
      }

      case 'REJECT_CLIENT':
      case 'CLIENT_REJECTED': {
        if (currentStatus !== 'Sent') {
          return NextResponse.json({ error: 'Only a sent quote can be rejected' }, { status: 400 });
        }
        newStatus = 'Not Converted';
        const reason = body.notConvertedReason || body.reason || 'Price Too High';
        extraVersionData = {
          notConvertedReason: reason,
          decidedAt: new Date()
        };

        // Mark linked enquiry as Lost
        if (quotation.enquiryId) {
          await prisma.enquiry.update({
            where: { id: quotation.enquiryId },
            data: {
              outcome: 'Lost',
              lostAtStage: 'Quoted',
              lostReason: body.lostReasonId || reason,
              lostNote: reason,
              status: 'DROPPED'
            }
          }).catch(console.error);
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Update version
    const updatedVersion = await prisma.quotationVersion.update({
      where: { id: currentVersion.id },
      data: {
        status: newStatus,
        ...extraVersionData
      },
      include: { items: true, additionalCharges: true }
    });

    // Update parent quotation
    const updatedQuote = await prisma.quotation.update({
      where: { id },
      data: {
        status: newStatus,
        ...extraQuoteData
      }
    });

    const fu = followupInfo(updatedVersion);
    const effectiveStatus = fu.followupNeeded ? 'Followup Needed' : updatedVersion.status;

    return NextResponse.json({
      id: updatedQuote.id,
      code: updatedQuote.code,
      number: updatedQuote.code,
      quotationNumber: updatedQuote.quotationNumber,
      status: updatedVersion.status,
      effectiveStatus,
      latestVersion: {
        ...updatedVersion,
        versionLabel: versionLabelOf(updatedVersion.versionNo),
        createdAt: updatedVersion.createdAt.toISOString()
      }
    });
  } catch (err: any) {
    console.error('Error executing quotation action:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
