import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { calculateQuoteCommercials, computeEffectiveStatus } from '../route';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        enquiry: {
          include: { items: true }
        },
        versions: {
          orderBy: { versionNo: 'desc' },
          include: {
            items: true,
            additionalCharges: true
          }
        }
      }
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const latestVersion = quotation.versions[0] || null;
    const effectiveStatus = latestVersion
      ? computeEffectiveStatus(latestVersion.status, latestVersion.sentAt, latestVersion.followupDoneAt as string[])
      : quotation.status;

    return NextResponse.json({
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      clientId: quotation.clientId,
      clientName: quotation.client.name,
      clientPhone: (quotation.client.phones as any)?.[0] || null,
      clientAddress: (quotation.client.addresses as any)?.[0] || null,
      enquiryId: quotation.enquiryId,
      enquiryNumber: quotation.enquiry?.enquiryNumber || null,
      enquiryStage: quotation.enquiry?.stage || null,
      currentVersionNo: quotation.currentVersionNo,
      status: latestVersion?.status || quotation.status,
      effectiveStatus,
      totalAmount: latestVersion?.grandTotal || quotation.totalAmount,
      latestVersion,
      versions: quotation.versions,
      createdAt: quotation.createdAt.toISOString(),
      updatedAt: quotation.updatedAt.toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch quotation' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;
    const userName = cookieStore.get('user_name')?.value || 'Admin';
    const cookieRole = cookieStore.get('user_role')?.value;

    const body = await req.json();
    const userRole = body.userRole || cookieRole || 'SUPER_ADMIN';
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        versions: {
          orderBy: { versionNo: 'desc' },
          take: 1,
          include: { items: true, additionalCharges: true }
        }
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const currentVersion = existing.versions[0];
    if (!currentVersion) {
      return NextResponse.json({ error: 'No version found for quotation' }, { status: 400 });
    }

    // Guard: closed deals cannot be resurrected by editing
    if (currentVersion.status === 'CONVERTED' || currentVersion.status === 'NOT_CONVERTED') {
      return NextResponse.json(
        { error: 'Cannot edit a finalized/closed quotation.' },
        { status: 400 }
      );
    }

    // Recalculate commercials
    const commercials = calculateQuoteCommercials(
      body.items || currentVersion.items,
      body.overallDiscountType !== undefined ? body.overallDiscountType : currentVersion.overallDiscountType,
      body.overallDiscountVal !== undefined ? body.overallDiscountVal : currentVersion.overallDiscountVal,
      body.additionalCharges || currentVersion.additionalCharges,
      body.gstApplicable !== undefined ? body.gstApplicable : currentVersion.gstApplicable,
      body.gstRatePct !== undefined ? Number(body.gstRatePct) : currentVersion.gstRatePct
    );

    const termsToSave = body.terms !== undefined ? body.terms : (currentVersion.terms || []);

    // 1. IN-PLACE EDIT: If quotation is GENERATED (draft) or APPROVED (admin editing unsent quote)
    const canEditInPlace = currentVersion.status === 'GENERATED' || currentVersion.status === 'APPROVED';

    if (canEditInPlace) {
      // Clear old items and charges
      await prisma.quotationItem.deleteMany({ where: { versionId: currentVersion.id } });
      await prisma.quotationAdditionalCharge.deleteMany({ where: { versionId: currentVersion.id } });

      let newStatus = currentVersion.status;
      let approvalData: { approvedById?: string | null; approvedByName?: string; approvedAt?: Date } = {};

      if (isAdmin) {
        newStatus = 'APPROVED';
        approvalData = {
          approvedById: userId || null,
          approvedByName: userName,
          approvedAt: new Date()
        };
        if (existing.enquiryId) {
          await prisma.enquiry.update({
            where: { id: existing.enquiryId },
            data: { stage: 'Quoted', status: 'IN_PROGRESS' }
          }).catch(console.error);
        }
      } else if (body.submitForVerification) {
        newStatus = 'VERIFICATION_REQUIRED';

        // Gracefully persist or update client address if provided
        if (body.clientAddress) {
          try {
            let addresses: any = existing.client.addresses;
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
                where: { id: existing.clientId },
                data: { addresses }
              });
            }
          } catch (e) {
            console.error('Failed to save client address', e);
          }
        }

        if (existing.enquiryId) {
          await prisma.enquiry.update({
            where: { id: existing.enquiryId },
            data: { stage: 'Quoted', status: 'IN_PROGRESS' }
          }).catch(console.error);
        }
      }

      const updatedVersion = await prisma.quotationVersion.update({
        where: { id: currentVersion.id },
        data: {
          status: newStatus,
          ...approvalData,
          grossTotal: commercials.grossTotal,
          overallDiscountType: commercials.overallDiscountType,
          overallDiscountVal: commercials.overallDiscountVal,
          overallDiscountAmt: commercials.overallDiscountAmt,
          discountedGross: commercials.discountedGross,
          extraCostsTotal: commercials.extraCostsTotal,
          gstApplicable: commercials.gstApplicable,
          gstRatePct: commercials.gstRatePct,
          gstAmount: commercials.gstAmount,
          grandTotal: commercials.grandTotal,
          terms: termsToSave,
          items: {
            create: commercials.items.map(it => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discountType: it.discountType,
              discountValue: it.discountValue,
              discountAmount: it.discountAmount,
              total: it.total,
              expectedDimensions: it.expectedDimensions,
              materialPreference: it.materialPreference,
              clientComment: it.clientComment
            }))
          },
          additionalCharges: {
            create: commercials.additionalCharges.map(c => ({
              title: c.title,
              amount: c.amount,
              taxable: c.taxable
            }))
          }
        },
        include: { items: true, additionalCharges: true }
      });

      await prisma.quotation.update({
        where: { id },
        data: { 
          status: newStatus,
          totalAmount: commercials.grandTotal 
        }
      });

      return NextResponse.json({
        id: existing.id,
        quotationNumber: existing.quotationNumber,
        currentVersionNo: existing.currentVersionNo,
        status: newStatus,
        effectiveStatus: newStatus,
        totalAmount: commercials.grandTotal,
        latestVersion: updatedVersion
      });
    }

    // 2. FORK NEW VERSION: The quote was already SENT, REJECTED, etc.
    // An edit forks a new version (v2, v3...)
    const nextVersionNo = existing.currentVersionNo + 1;
    const nextVersionCode = `${existing.quotationNumber}-v${nextVersionNo}`;

    // Mark current version as superseded
    await prisma.quotationVersion.update({
      where: { id: currentVersion.id },
      data: { supersededAt: new Date() }
    });

    let nextStatus = 'GENERATED';
    let nextApprovalData: { approvedById?: string | null; approvedByName?: string; approvedAt?: Date } = {};

    if (isAdmin) {
      nextStatus = 'APPROVED';
      nextApprovalData = {
        approvedById: userId || null,
        approvedByName: userName,
        approvedAt: new Date()
      };
      if (existing.enquiryId) {
        await prisma.enquiry.update({
          where: { id: existing.enquiryId },
          data: { stage: 'Quoted', status: 'IN_PROGRESS' }
        }).catch(console.error);
      }
    } else if (body.submitForVerification) {
      nextStatus = 'VERIFICATION_REQUIRED';

      // Gracefully persist or update client address if provided
      if (body.clientAddress) {
        try {
          let addresses: any = existing.client.addresses;
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
              where: { id: existing.clientId },
              data: { addresses }
            });
          }
        } catch (e) {
          console.error('Failed to save client address', e);
        }
      }

      if (existing.enquiryId) {
        await prisma.enquiry.update({
          where: { id: existing.enquiryId },
          data: { stage: 'Quoted', status: 'IN_PROGRESS' }
        }).catch(console.error);
      }
    }

    // Create the new version
    const newVersion = await prisma.quotationVersion.create({
      data: {
        quotationId: existing.id,
        versionNo: nextVersionNo,
        versionCode: nextVersionCode,
        status: nextStatus,
        grossTotal: commercials.grossTotal,
        overallDiscountType: commercials.overallDiscountType,
        overallDiscountVal: commercials.overallDiscountVal,
        overallDiscountAmt: commercials.overallDiscountAmt,
        discountedGross: commercials.discountedGross,
        extraCostsTotal: commercials.extraCostsTotal,
        gstApplicable: commercials.gstApplicable,
        gstRatePct: commercials.gstRatePct,
        gstAmount: commercials.gstAmount,
        grandTotal: commercials.grandTotal,
        createdById: userId || null,
        createdByName: userName,
        terms: termsToSave,
        ...nextApprovalData,
        items: {
          create: commercials.items.map(it => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountType: it.discountType,
            discountValue: it.discountValue,
            discountAmount: it.discountAmount,
            total: it.total,
            expectedDimensions: it.expectedDimensions,
            materialPreference: it.materialPreference,
            clientComment: it.clientComment
          }))
        },
        additionalCharges: {
          create: commercials.additionalCharges.map(c => ({
            title: c.title,
            amount: c.amount,
            taxable: c.taxable
          }))
        }
      },
      include: { items: true, additionalCharges: true }
    });

    // Update parent quotation
    await prisma.quotation.update({
      where: { id },
      data: {
        currentVersionNo: nextVersionNo,
        status: nextStatus,
        totalAmount: commercials.grandTotal
      }
    });

    return NextResponse.json({
      id: existing.id,
      quotationNumber: existing.quotationNumber,
      currentVersionNo: nextVersionNo,
      status: nextStatus,
      effectiveStatus: nextStatus,
      totalAmount: commercials.grandTotal,
      latestVersion: newVersion
    });
  } catch (err: any) {
    console.error('Error updating quotation:', err);
    return NextResponse.json({ error: err.message || 'Failed to update quotation' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const currentVersion = existing.versions[0];
    if (currentVersion && currentVersion.status !== 'GENERATED') {
      return NextResponse.json(
        { error: 'Cannot delete a quotation that has been submitted, approved or sent. Audit integrity requires preservation.' },
        { status: 400 }
      );
    }

    await prisma.quotation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete quotation' }, { status: 500 });
  }
}
