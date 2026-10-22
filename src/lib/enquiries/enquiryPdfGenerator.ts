import { formatDate } from '@/lib/dates';
import { numberToWordsINR } from '@/lib/quotations/quotePdfGenerator';

export interface EnquiryPdfOptions {
  fileName?: string;
  autoDownload?: boolean;
}

/**
 * Generates and downloads a clean Enquiry Specification PDF using jsPDF + jsPDF-AutoTable.
 */
export async function generateEnquiryPDF(
  enquiry: any,
  options: EnquiryPdfOptions = {}
): Promise<void> {
  if (!enquiry) throw new Error('Enquiry data is required for PDF generation.');

  // Dynamically import client libraries
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = (autoTableModule as any).default || autoTableModule;

  const enqCode = enquiry.enquiryNumber || enquiry.enquiryCode || 'ENQ–DRAFT';
  const client = enquiry.client || {};
  const clientName = client.name || enquiry.rawName || 'Valued Client';
  const clientPhones = client.phones || (enquiry.rawPhone ? [enquiry.rawPhone] : []);
  const clientEmails = client.emails || (enquiry.rawEmail ? [enquiry.rawEmail] : []);
  const categoryName = enquiry.category?.name || 'Modular Furniture';
  const stage = enquiry.stage || 'New';
  const outcome = enquiry.outcome || 'Open';
  const salesperson = enquiry.salesperson?.name || 'Direct Sales';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const charcoal = [30, 41, 59] as [number, number, number];
  const warmOrange = [234, 88, 12] as [number, number, number];
  const mutedText = [100, 116, 139] as [number, number, number];
  const borderLight = [226, 232, 240] as [number, number, number];
  const bgSoft = [248, 250, 252] as [number, number, number];

  // =========================================================================
  // 1. HEADER SECTION
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...charcoal);
  doc.text("D'FURN MODULAR SYSTEMS", margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text('Commercial Furniture, Workspaces & Modular Manufacturing', margin, 23);
  doc.text('Plot 14, GIDC Industrial Estate, Ahmedabad, Gujarat · 382445', margin, 27);
  doc.text('GSTIN: 24AADCD4139R1ZB · sales@dfurn.in · Tel: +91 98250 12345', margin, 31);

  // Right-aligned Enquiry Title & Reference
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...warmOrange);
  doc.text('ENQUIRY SPECIFICATION', pageWidth - margin, 18, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...charcoal);
  doc.text(`Ref: ${enqCode}`, pageWidth - margin, 24, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text(`Date: ${formatDate(enquiry.createdAt || new Date())}`, pageWidth - margin, 29, { align: 'right' });
  doc.text(`Stage: ${stage} (${outcome})`, pageWidth - margin, 33, { align: 'right' });

  // Divider Line
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.4);
  doc.line(margin, 37, pageWidth - margin, 37);

  // =========================================================================
  // 2. CLIENT & PROJECT DETAILS (2-Column Card)
  // =========================================================================
  const cardY = 41;
  const colWidth = (contentWidth - 6) / 2;

  // Left Box: Client Info
  doc.setFillColor(...bgSoft);
  doc.roundedRect(margin, cardY, colWidth, 30, 2, 2, 'F');
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, cardY, colWidth, 30, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...warmOrange);
  doc.text('CLIENT DETAILS', margin + 4, cardY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...charcoal);
  doc.text(String(clientName).substring(0, 36), margin + 4, cardY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  const phoneText = clientPhones.length > 0 ? String(clientPhones[0]) : '–';
  doc.text(`Phone: ${phoneText}`, margin + 4, cardY + 18);
  const emailText = clientEmails.length > 0 ? String(clientEmails[0]) : '–';
  doc.text(`Email: ${emailText}`, margin + 4, cardY + 23);

  // Right Box: Project Overview
  const rightX = margin + colWidth + 6;
  doc.setFillColor(...bgSoft);
  doc.roundedRect(rightX, cardY, colWidth, 30, 2, 2, 'F');
  doc.setDrawColor(...borderLight);
  doc.roundedRect(rightX, cardY, colWidth, 30, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...warmOrange);
  doc.text('PROJECT OVERVIEW', rightX + 4, cardY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text('Category:', rightX + 4, cardY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...charcoal);
  doc.text(categoryName, rightX + 24, cardY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text('Salesperson:', rightX + 4, cardY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...charcoal);
  doc.text(salesperson, rightX + 24, cardY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text('Est. Value:', rightX + 4, cardY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...charcoal);
  const estVal = Number(enquiry.opportunityValue ?? enquiry.estimatedBudget ?? enquiry.estimatedValue ?? 0);
  doc.text(estVal > 0 ? `₹${Math.round(estVal).toLocaleString('en-IN')}` : '–', rightX + 24, cardY + 24);

  // =========================================================================
  // 3. PROJECT SCOPE / BRIEF SECTION
  // =========================================================================
  let currentY = cardY + 34;

  const briefContent = enquiry.brief || enquiry.scopeBrief;
  if (briefContent) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...charcoal);
    doc.text('Project Scope & Client Requirements:', margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mutedText);
    const splitBrief = doc.splitTextToSize(String(briefContent), contentWidth);
    doc.text(splitBrief, margin, currentY + 5);
    currentY += 6 + splitBrief.length * 4;
  }

  // =========================================================================
  // 4. SCOPED PRODUCTS TABLE
  // =========================================================================
  const items = Array.isArray(enquiry.items) ? enquiry.items : [];
  let tableRows: any[] = [];
  let computedTotal = 0;

  if (items.length > 0) {
    tableRows = items.map((item: any, idx: number) => {
      const qty = Number(item.quantity || 1);
      const rate = Number(item.unitPrice || item.baseSellingRate || 0);
      const total = Number(item.total || qty * rate);
      computedTotal += total;

      const dim = item.expectedDimensions || '–';

      return [
        idx + 1,
        item.name || 'Standard Furniture Item',
        item.code || '–',
        dim,
        `${qty} ${item.unit || 'Nos'}`,
        `₹${Math.round(rate).toLocaleString('en-IN')}`,
        `₹${Math.round(total).toLocaleString('en-IN')}`,
      ];
    });
  } else {
    // If no items scoped yet, show single row with category scope
    computedTotal = estVal;
    tableRows = [
      [
        1,
        `${categoryName} · Project Scope`,
        '–',
        'As per site specifications',
        '1 Lot',
        estVal > 0 ? `₹${Math.round(estVal).toLocaleString('en-IN')}` : '–',
        estVal > 0 ? `₹${Math.round(estVal).toLocaleString('en-IN')}` : '–',
      ]
    ];
  }

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: margin, right: margin },
    head: [['#', 'Item Description', 'Code', 'Dimensions (L B H mm)', 'Qty', 'Unit Rate', 'Line Total']],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 54 },
      2: { cellWidth: 26 },
      3: { cellWidth: 42 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
  });

  // Table Final Y
  const finalTableY = (doc as any).lastAutoTable?.finalY || currentY + 30;

  // =========================================================================
  // 5. COMMERCIAL SUMMARY
  // =========================================================================
  const summaryBoxY = finalTableY + 4;
  const summaryBoxWidth = 80;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;

  doc.setFillColor(...bgSoft);
  doc.roundedRect(summaryBoxX, summaryBoxY, summaryBoxWidth, 16, 2, 2, 'F');
  doc.setDrawColor(...borderLight);
  doc.roundedRect(summaryBoxX, summaryBoxY, summaryBoxWidth, 16, 2, 2, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedText);
  doc.text('Total Opportunity Value:', summaryBoxX + 4, summaryBoxY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...warmOrange);
  const finalAmount = computedTotal > 0 ? computedTotal : estVal;
  doc.text(`₹${Math.round(finalAmount).toLocaleString('en-IN')}`, summaryBoxX + summaryBoxWidth - 4, summaryBoxY + 11, { align: 'right' });

  // Amount in words
  if (finalAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedText);
    const inWords = numberToWordsINR(finalAmount);
    doc.text(inWords, margin, summaryBoxY + 10);
  }

  // =========================================================================
  // 6. FOOTER
  // =========================================================================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const footerText = 'Dfurn Modular Systems ERP · Internal Commercial Document · Subject to Final Measurement & Feasibility';
  doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });

  // Save / Trigger Download
  const cleanCode = enqCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetFileName = options.fileName || `DFurn_Enquiry_${cleanCode}.pdf`;

  if (options.autoDownload !== false) {
    doc.save(targetFileName);
  }
}
