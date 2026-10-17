import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import {
  versionLabelOf,
  followupInfo,
  buildVersionComputedFields,
  readinessOf,
  normalizeQuoteStatus
} from '@/lib/quotations/quoteService';
import { diffVersions } from '@/lib/quotations/quoteChanges';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        enquiry: {
          include: {
            salesperson: true,
            communicationLogs: {
              orderBy: { createdAt: 'desc' }
            },
            files: {
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        jobOrders: {
          select: { id: true, jobNumber: true, status: true }
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
    const fu = followupInfo(latestVersion);
    const versionLabel = versionLabelOf(latestVersion?.versionNo || quotation.currentVersionNo);
    const displayStatus = normalizeQuoteStatus(latestVersion?.status || quotation.status);
    const effectiveStatus = fu.followupNeeded ? 'Followup Needed' : displayStatus;
    const readiness = readinessOf(quotation, quotation.client);

    const linkedJobOrder = quotation.jobOrders[0] || null;

    return NextResponse.json({
      id: quotation.id,
      code: quotation.code,
      number: quotation.code,
      quotationNumber: quotation.quotationNumber,
      displayCode: quotation.code || (quotation.enquiryCode ? `Draft for ${quotation.enquiryCode}` : `Draft · ${quotation.quotationNumber}`),
      enquiryCode: quotation.enquiryCode || quotation.enquiry?.enquiryNumber || null,
      enquiryId: quotation.enquiryId,
      enquiryStage: quotation.enquiry?.stage || null,
      brief: (quotation.enquiry as any)?.brief || quotation.enquiry?.notes || '',

      clientId: quotation.clientId,
      clientName: quotation.client.name,
      client: quotation.client,

      salespersonId: quotation.salespersonId || quotation.enquiry?.salespersonId || null,
      salespersonName: quotation.salespersonName || quotation.enquiry?.salesperson?.name || null,

      currentVersionNo: quotation.currentVersionNo,
      versionLabel,
      status: displayStatus,
      effectiveStatus,
      totalAmount: latestVersion?.grandTotal || quotation.totalAmount,

      readiness,
      linkedJobOrder,

      communications: quotation.enquiry?.communicationLogs || [],
      files: quotation.enquiry?.files || [],

      latestVersion: latestVersion
        ? {
            ...latestVersion,
            status: normalizeQuoteStatus(latestVersion.status),
            versionLabel,
            followupNeeded: fu.followupNeeded,
            followupCount: fu.followupCount,
            validUntil: latestVersion.validUntil?.toISOString() || null,
            createdAt: latestVersion.createdAt.toISOString(),
            submittedAt: latestVersion.submittedAt?.toISOString() || null,
            verifiedAt: (latestVersion as any).verifiedAt?.toISOString() || null,
            approvedAt: (latestVersion as any).approvedAt?.toISOString() || null,
            sentAt: (latestVersion as any).sentAt?.toISOString() || null,
            decidedAt: latestVersion.decidedAt?.toISOString() || null
          }
        : null,

      versions: quotation.versions.map(v => ({
        ...v,
        status: normalizeQuoteStatus(v.status),
        versionLabel: versionLabelOf(v.versionNo),
        validUntil: v.validUntil?.toISOString() || null,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        submittedAt: v.submittedAt?.toISOString() || null,
        verifiedAt: (v as any).verifiedAt?.toISOString() || null,
        approvedAt: (v as any).approvedAt?.toISOString() || null,
        sentAt: (v as any).sentAt?.toISOString() || null,
        decidedAt: v.decidedAt?.toISOString() || null,
        supersededAt: v.supersededAt?.toISOString() || null
      })),

      createdAt: quotation.createdAt.toISOString(),
      updatedAt: quotation.updatedAt.toISOString()
    });
  } catch (err: any) {
    console.error('Error fetching quotation detail:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch quotation' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value || null;
    const userName = cookieStore.get('user_name')?.value || 'Admin';

    const body = await req.json();

    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        enquiry: true,
        versions: {
          orderBy: { versionNo: 'desc' },
          take: 1,
          include: {
            items: true,
            additionalCharges: true
          }
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

    // Terminal guard: closed deals cannot be resurrected
    const normCurStatus = normalizeQuoteStatus(currentVersion.status);
    if (normCurStatus === 'Converted' || normCurStatus === 'Not Converted') {
      return NextResponse.json(
        { error: `Cannot change a ${normCurStatus} quotation: its outcome is final.` },
        { status: 400 }
      );
    }

    // Prepare line items
    const rawLines = Array.isArray(body.items) ? body.items : currentVersion.items;
    const computed = buildVersionComputedFields({
      items: (rawLines as any[]).map((it: any) => ({
        ...it,
        lineId: it.lineId || crypto.randomUUID()
      })),
      additionalCharges: Array.isArray(body.additionalCharges) ? body.additionalCharges : currentVersion.additionalCharges,
      gstApplicable: body.gstApplicable !== undefined ? body.gstApplicable : currentVersion.gstApplicable,
      gstRatePct: body.gstRatePct !== undefined ? body.gstRatePct : currentVersion.gstRatePct,
      overallDiscountType: body.overallDiscountType !== undefined ? body.overallDiscountType : currentVersion.overallDiscountType,
      overallDiscountVal: body.overallDiscountVal !== undefined ? body.overallDiscountVal : currentVersion.overallDiscountVal
    });

    const validUntilDate = body.validUntil ? new Date(body.validUntil) : currentVersion.validUntil;
    const termsToSave = body.terms !== undefined ? body.terms : (currentVersion.terms || []);
    const reason = body.reason?.trim() || null;

    // Check if only salesperson changed
    const salespersonChanged = body.salespersonId !== undefined && body.salespersonId !== existing.salespersonId;

    // Compute diff against current version
    const candidateNext = {
      items: computed.items,
      additionalCharges: computed.additionalCharges,
      gstApplicable: computed.gstApplicable,
      gstRatePct: computed.gstRatePct,
      overallDiscountType: computed.overallDiscountType,
      overallDiscountVal: computed.overallDiscountVal,
      validUntil: validUntilDate,
      terms: termsToSave
    };

    const changes = diffVersions(currentVersion, candidateNext);

    // If nothing changed in the commercial content:
    if (changes.length === 0) {
      if (salespersonChanged) {
        // Just update salesperson on quotation
        const updatedQuote = await prisma.quotation.update({
          where: { id },
          data: {
            salespersonId: body.salespersonId || null,
            salespersonName: body.salespersonName || null
          }
        });
        return NextResponse.json({
          ok: true,
          versioned: false,
          record: updatedQuote
        });
      }
      return NextResponse.json(
        { error: 'Nothing has changed, so there is nothing to save.' },
        { status: 400 }
      );
    }

    // EVERY Save changes creates the next version (Round 4 ruling)
    const nextVersionNo = existing.currentVersionNo + 1;
    const nextLabel = versionLabelOf(nextVersionNo);
    const nextVersionCode = existing.code ? `${existing.code}-${nextLabel}` : `Draft · ${existing.enquiryCode || existing.quotationNumber}`;

    // Mark current version as superseded
    await prisma.quotationVersion.update({
      where: { id: currentVersion.id },
      data: { supersededAt: new Date() }
    });

    // Create the new version atomically
    const newVersion = await prisma.quotationVersion.create({
      data: {
        quotationId: existing.id,
        versionNo: nextVersionNo,
        versionCode: nextVersionCode,
        status: 'Draft',
        grossTotal: computed.grossTotal,
        overallDiscountType: computed.overallDiscountType,
        overallDiscountVal: computed.overallDiscountVal,
        overallDiscountAmt: computed.overallDiscountAmt,
        discountedGross: computed.discountedGross,
        extraCostsTotal: computed.extraCostsTotal,
        gstApplicable: computed.gstApplicable,
        gstRatePct: computed.gstRatePct,
        gstAmount: computed.gstAmount,
        grandTotal: computed.grandTotal,
        previousGrandTotal: currentVersion.grandTotal,
        validUntil: validUntilDate,
        reason,
        changes: (changes || []) as any,
        terms: termsToSave,
        createdById: userId,
        createdByName: userName,
        items: {
          create: computed.items.map(it => ({
            lineId: it.lineId,
            refType: it.refType,
            refId: it.refId,
            snapshot: it.snapshot,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountType: it.discountType,
            discountValue: it.discountValue,
            discountAmount: it.discountAmount,
            total: it.total,
            customizations: it.customizations,
            expectedDimensions: it.expectedDimensions,
            materialPreference: it.materialPreference,
            clientComment: it.clientComment
          }))
        },
        additionalCharges: {
          create: computed.additionalCharges.map(c => ({
            title: c.title,
            amount: c.amount,
            taxable: c.taxable
          }))
        }
      },
      include: {
        items: true,
        additionalCharges: true
      }
    });

    // Update parent quotation
    const updatedQuotation = await prisma.quotation.update({
      where: { id },
      data: {
        currentVersionNo: nextVersionNo,
        status: 'Draft',
        totalAmount: computed.grandTotal,
        salespersonId: body.salespersonId !== undefined ? body.salespersonId : existing.salespersonId,
        salespersonName: body.salespersonName !== undefined ? body.salespersonName : existing.salespersonName
      },
      include: {
        client: true,
        enquiry: true,
        versions: {
          orderBy: { versionNo: 'desc' },
          include: { items: true, additionalCharges: true }
        }
      }
    });

    const readiness = readinessOf(updatedQuotation, updatedQuotation.client);

    return NextResponse.json({
      ok: true,
      versioned: true,
      id: updatedQuotation.id,
      code: updatedQuotation.code,
      number: updatedQuotation.code,
      quotationNumber: updatedQuotation.quotationNumber,
      status: 'Draft',
      effectiveStatus: 'Draft',
      currentVersionNo: nextVersionNo,
      versionLabel: nextLabel,
      totalAmount: computed.grandTotal,
      readiness,
      latestVersion: {
        ...newVersion,
        versionLabel: nextLabel,
        createdAt: newVersion.createdAt.toISOString()
      }
    });
  } catch (err: any) {
    console.error('Error saving new quotation version:', err);
    return NextResponse.json({ error: err.message || 'Failed to update quotation' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: {
        versions: true
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    // Owner ruling: only a draft that was never submitted can be deleted
    const wasSubmitted = existing.code !== null || existing.versions.some(v => v.submittedAt !== null || v.status !== 'Draft');
    if (wasSubmitted) {
      return NextResponse.json(
        { error: 'Only a draft that has never been submitted can be deleted. A submitted quotation is a permanent record.' },
        { status: 409 }
      );
    }

    await prisma.quotation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Error deleting draft quotation:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete quotation' }, { status: 500 });
  }
}
