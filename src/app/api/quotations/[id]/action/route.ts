import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { computeEffectiveStatus } from '../../route';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;
    const userName = cookieStore.get('user_name')?.value || 'Admin';
    const userRole = cookieStore.get('user_role')?.value;

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

    let newStatus = currentVersion.status;
    let extraVersionData: any = {};

    switch (action) {
      case 'SUBMIT_VERIFICATION': {
        newStatus = 'VERIFICATION_REQUIRED';

        // Gracefully persist or update client address if provided
        if (body.clientAddress) {
          try {
            let addresses: any = quotation.client.addresses;
            if (typeof addresses === 'string') {
              try { addresses = JSON.parse(addresses); } catch { addresses = []; }
            }
            if (!Array.isArray(addresses)) addresses = [];
            const addrObj = typeof body.clientAddress === 'string'
              ? { label: 'Billing Address', street: body.clientAddress.trim(), isBilling: true }
              : {
                  label: 'Billing Address',
                  street: body.clientAddress.street || body.clientAddress.addressLine || '',
                  city: body.clientAddress.city || '',
                  state: body.clientAddress.state || '',
                  zip: body.clientAddress.zip || body.clientAddress.pincode || '',
                  isBilling: true
                };
            if (addrObj.street || addrObj.city || addrObj.state) {
              addresses.push(addrObj);
              await prisma.client.update({
                where: { id: quotation.clientId },
                data: { addresses }
              });
            }
          } catch (e) {
            console.error('Failed to save client address', e);
          }
        }

        // Interlock: Advance linked Enquiry stage to 'Quoted'
        if (quotation.enquiryId) {
          await prisma.enquiry.update({
            where: { id: quotation.enquiryId },
            data: { stage: 'Quoted', status: 'IN_PROGRESS' }
          }).catch(console.error);
        }
        break;
      }

      case 'VERIFY': {
        newStatus = 'ADMIN_APPROVAL_REQUIRED';
        extraVersionData = {
          verifiedById: userId || null,
          verifiedByName: userName,
          verifiedAt: new Date()
        };
        break;
      }

      case 'APPROVE': {
        newStatus = 'APPROVED';
        extraVersionData = {
          approvedById: userId || null,
          approvedByName: userName,
          approvedAt: new Date()
        };
        break;
      }

      case 'REJECT_APPROVAL': {
        newStatus = 'NOT_APPROVED';
        break;
      }

      case 'MARK_SENT': {
        newStatus = 'SENT';
        extraVersionData = {
          sentAt: new Date()
        };
        break;
      }

      case 'LOG_FOLLOWUP': {
        const existingFollowups = Array.isArray(currentVersion.followupDoneAt)
          ? (currentVersion.followupDoneAt as string[])
          : [];
        const updatedFollowups = [...existingFollowups, new Date().toISOString()];
        extraVersionData = {
          followupDoneAt: updatedFollowups
        };

        // If follow-up note was provided, log it in enquiry notes
        if (body.note && quotation.enquiryId) {
          const timestamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          const newEntry = `[${timestamp} Follow-up via ${body.channel || 'Phone'}] ${body.note}`;
          const currentNotes = quotation.enquiry?.notes ? `${quotation.enquiry.notes}\n${newEntry}` : newEntry;
          await prisma.enquiry.update({
            where: { id: quotation.enquiryId },
            data: { notes: currentNotes }
          }).catch(console.error);
        }
        break;
      }

      case 'CONVERT': {
        newStatus = 'CONVERTED';

        // Interlock: Advance linked Enquiry stage to 'Converted' (Won!)
        if (quotation.enquiryId) {
          await prisma.enquiry.update({
            where: { id: quotation.enquiryId },
            data: { stage: 'Converted', status: 'CONVERTED', outcome: 'Open' }
          }).catch(console.error);
        }
        break;
      }

      case 'REJECT_CLIENT': {
        newStatus = 'NOT_CONVERTED';
        const reason = body.reason || 'Price Too High';
        extraVersionData = {
          notConvertedReason: reason
        };

        // Interlock: Mark linked Enquiry as Lost at Quoted stage
        if (quotation.enquiryId) {
          await prisma.enquiry.update({
            where: { id: quotation.enquiryId },
            data: { 
              outcome: 'Lost', 
              lostAtStage: 'Quoted', 
              lostReason: reason,
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
    await prisma.quotation.update({
      where: { id },
      data: { status: newStatus }
    });

    const effectiveStatus = computeEffectiveStatus(
      updatedVersion.status,
      updatedVersion.sentAt,
      updatedVersion.followupDoneAt as string[]
    );

    return NextResponse.json({
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      status: updatedVersion.status,
      effectiveStatus,
      latestVersion: updatedVersion
    });
  } catch (err: any) {
    console.error('Error executing quotation action:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
