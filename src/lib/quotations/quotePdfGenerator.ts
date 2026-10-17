import { formatDate } from '@/lib/dates';
import { versionLabelOf } from './quoteService';

/**
 * Converts Indian Rupee numerical amounts into words.
 * Example: 145200 -> "Rupees One Lakh Forty Five Thousand Two Hundred Only"
 */
export function numberToWordsINR(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return 'Rupees Zero Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(num: number): string {
    if (num === 0) return '';
    if (num < 10) return singleDigits[num];
    if (num < 20) return teens[num - 10];
    const unit = num % 10;
    return tens[Math.floor(num / 10)] + (unit ? ' ' + singleDigits[unit] : '');
  }

  function convertThreeDigits(num: number): string {
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    let res = '';
    if (hundred > 0) {
      res += singleDigits[hundred] + ' Hundred';
      if (rest > 0) res += ' ';
    }
    res += convertTwoDigits(rest);
    return res.trim();
  }

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  let words = '';
  if (crore > 0) words += convertTwoDigits(crore) + ' Crore ';
  if (lakh > 0) words += convertTwoDigits(lakh) + ' Lakh ';
  if (thousand > 0) words += convertTwoDigits(thousand) + ' Thousand ';
  if (remainder > 0) words += convertThreeDigits(remainder);

  return 'Rupees ' + words.trim() + ' Only';
}

export interface QuotationPdfOptions {
  fileName?: string;
  autoDownload?: boolean;
}

/**
 * Generates and downloads a commercial quotation PDF using jsPDF + jsPDF-AutoTable.
 */
export async function generateQuotationPDF(
  quote: any,
  selectedVersion?: any,
  options: QuotationPdfOptions = {}
): Promise<void> {
  if (!quote) throw new Error('Quotation data is required for PDF generation.');

  // Dynamically import client libraries
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = (autoTableModule as any).default || autoTableModule;

  const currentVer =
    selectedVersion ||
    quote.latestVersion ||
    (quote.versions && quote.versions[0]) ||
    {};

  const versionNo = currentVer.versionNo || quote.currentVersionNo || 1;
  const versionLabel = versionLabelOf(versionNo);
  const quoteNumber =
    quote.code ||
    quote.quotationNumber ||
    (quote.enquiryCode ? `Draft · ${quote.enquiryCode}` : 'Commercial Quotation');

  const client = quote.client || {};
  const clientName = quote.clientName || client.name || 'Valued Client';
  const clientPhones = client.phones || (quote.clientPhone ? [quote.clientPhone] : []);
  const clientEmails = client.emails || (quote.clientEmail ? [quote.clientEmail] : []);
  const clientGstin = client.gstin || 'Unregistered / B2C';
  const billingAddress = client.billingAddress || client.address || '–';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
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
  doc.text('D. F. FURNITURE DESIGN & MANUFACTURING', margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text('Commercial Furniture, Workspaces & Bespoke Interior Solutions', margin, 23);
  doc.text('Plot 14, GIDC Industrial Estate, Ahmedabad, Gujarat - 382445', margin, 27);
  doc.text('GSTIN: 24AAAAA0000A1Z5 | Email: sales@dfurn.in | Tel: +91 98250 12345', margin, 31);

  // Right-aligned Quotation Title & Reference
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...warmOrange);
  doc.text('COMMERCIAL QUOTATION', pageWidth - margin, 18, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...charcoal);
  doc.text(`${quoteNumber} (${versionLabel})`, pageWidth - margin, 23, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  const quoteDate = formatDate(currentVer.submittedAt || currentVer.createdAt || new Date());
  const validUntil = currentVer.validUntil ? formatDate(currentVer.validUntil) : '30 Days from date';
  doc.text(`Date: ${quoteDate}`, pageWidth - margin, 27, { align: 'right' });
  doc.text(`Valid Until: ${validUntil}`, pageWidth - margin, 31, { align: 'right' });

  // Accent divider line
  doc.setDrawColor(...warmOrange);
  doc.setLineWidth(0.8);
  doc.line(margin, 35, pageWidth - margin, 35);

  // =========================================================================
  // 2. CLIENT & QUOTATION DETAILS CARD
  // =========================================================================
  const cardY = 38;
  const cardHeight = 28;

  // Background box
  doc.setFillColor(...bgSoft);
  doc.roundedRect(margin, cardY, contentWidth, cardHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cardY, contentWidth, cardHeight, 1.5, 1.5, 'S');

  // Left Column: Client Details
  const col1X = margin + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...warmOrange);
  doc.text('BILLED TO / CUSTOMER', col1X, cardY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...charcoal);
  doc.text(String(clientName).slice(0, 42), col1X, cardY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  const contact = client.contactPerson ? `Attn: ${client.contactPerson}  |  ` : '';
  const phone = clientPhones[0] || '–';
  doc.text(`${contact}Phone: ${phone}`, col1X, cardY + 15.5);

  const email = clientEmails[0] || '–';
  doc.text(`Email: ${email}  |  GSTIN: ${clientGstin}`, col1X, cardY + 19.5);

  let addressStr = typeof billingAddress === 'string' ? billingAddress : '–';
  if (addressStr.length > 55) addressStr = addressStr.slice(0, 52) + '...';
  doc.text(`Address: ${addressStr}`, col1X, cardY + 23.5);

  // Right Column: Quotation Metadata
  const col2X = margin + 115;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...warmOrange);
  doc.text('COMMERCIAL PARTICULARS', col2X, cardY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text('Enquiry Reference:', col2X, cardY + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...charcoal);
  doc.text(String(quote.enquiryCode || quote.enquiry?.enquiryNumber || 'Direct Requirement'), col2X + 28, cardY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text('Sales Representative:', col2X, cardY + 15.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...charcoal);
  doc.text(String(quote.salespersonName || 'Haresh Brahmbhatt'), col2X + 28, cardY + 15.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text('Quotation Status:', col2X, cardY + 19.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...charcoal);
  doc.text(String(currentVer.status || quote.status || 'Draft'), col2X + 28, cardY + 19.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text('Price Basis:', col2X, cardY + 23.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...charcoal);
  doc.text('Ex-Factory, Ahmedabad', col2X + 28, cardY + 23.5);

  // =========================================================================
  // 3. LINE ITEMS TABLE (AutoTable)
  // =========================================================================
  const rawItems = currentVer.items || [];
  const tableRows: any[] = [];

  rawItems.forEach((item: any, idx: number) => {
    const itemName = item.snapshot?.name || item.description || `Item #${idx + 1}`;
    const specs: string[] = [];
    if (item.expectedDimensions) specs.push(`Size: ${item.expectedDimensions}`);
    if (item.materialPreference) specs.push(`Material: ${item.materialPreference}`);
    if (item.clientComment) specs.push(`Note: ${item.clientComment}`);

    const descCell = specs.length > 0 ? `${itemName}\n${specs.join(' | ')}` : itemName;
    const qty = item.quantity || 1;
    const unitPrice = item.unitPrice || 0;
    const discountStr = item.discountPct
      ? `${item.discountPct}%`
      : item.discountAmount
        ? `₹${Math.round(item.discountAmount).toLocaleString('en-IN')}`
        : '–';
    const total = item.total || qty * unitPrice;

    tableRows.push([
      idx + 1,
      descCell,
      qty,
      `₹${Math.round(unitPrice).toLocaleString('en-IN')}`,
      discountStr,
      `₹${Math.round(total).toLocaleString('en-IN')}`
    ]);
  });

  // Additional Charges as rows if present
  const addCharges = currentVer.additionalCharges || [];
  if (addCharges.length > 0) {
    addCharges.forEach((c: any) => {
      tableRows.push([
        '',
        `[Additional Charge] ${c.label || 'Other Charge'}`,
        '–',
        '–',
        '–',
        `₹${Math.round(c.amount || 0).toLocaleString('en-IN')}`
      ]);
    });
  }

  // Fallback row if no items exist
  if (tableRows.length === 0) {
    tableRows.push(['1', 'Custom Furniture Design & Fabrication Scope', 1, '₹0', '–', '₹0']);
  }

  autoTable(doc, {
    startY: 69,
    margin: { left: margin, right: margin },
    head: [['#', 'Item Description & Technical Specifications', 'Qty', 'Unit Rate', 'Disc.', 'Total (₹)']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: charcoal,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: charcoal,
      lineColor: borderLight,
      lineWidth: 0.2,
      overflow: 'linebreak'
    },
    alternateRowStyles: {
      fillColor: [252, 253, 254]
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    },
    didDrawPage: (data: any) => {
      // Bottom footer on every page
      const pageNumber = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...mutedText);

      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      doc.text(
        'D. F. Furniture ERP · Commercial Quotation · Strictly Confidential',
        margin,
        pageHeight - 7.5
      );
      doc.text(
        `Page ${pageNumber}`,
        pageWidth - margin,
        pageHeight - 7.5,
        { align: 'right' }
      );
    }
  });

  let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 5 : 160;

  // If table went too close to bottom, add a new page for totals & terms
  if (finalY > pageHeight - 70) {
    doc.addPage();
    finalY = 20;
  }

  // =========================================================================
  // 4. COMMERCIAL SUMMARY & TOTALS
  // =========================================================================
  const grossTotal = currentVer.grossTotal || 0;
  const totalDiscount = currentVer.totalDiscount || 0;
  const taxableAmount = currentVer.taxableAmount || grossTotal - totalDiscount;
  const gstRatePct = currentVer.gstRatePct != null ? currentVer.gstRatePct : 18;
  const gstAmount = currentVer.gstAmount || Math.round(taxableAmount * (gstRatePct / 100));
  const grandTotal = currentVer.grandTotal || taxableAmount + gstAmount;

  const totalsBoxWidth = 84;
  const totalsBoxX = pageWidth - margin - totalsBoxWidth;
  let totalsY = finalY;

  // Left Side: Amount in Words + Bank details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...warmOrange);
  doc.text('AMOUNT IN WORDS (INR):', margin, totalsY + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...charcoal);
  const words = numberToWordsINR(grandTotal);
  const splitWords = doc.splitTextToSize(words, totalsBoxX - margin - 8);
  doc.text(splitWords, margin, totalsY + 9);

  // Bank Account Box
  const bankBoxY = totalsY + 18;
  doc.setFillColor(...bgSoft);
  doc.roundedRect(margin, bankBoxY, totalsBoxX - margin - 8, 22, 1, 1, 'F');
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, bankBoxY, totalsBoxX - margin - 8, 22, 1, 1, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...warmOrange);
  doc.text('BANK REMITTANCE DETAILS', margin + 3, bankBoxY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...charcoal);
  doc.text('Beneficiary: D. F. Furniture Design & Manufacturing', margin + 3, bankBoxY + 9);
  doc.text('Bank: HDFC Bank Ltd.  |  Branch: Industrial Area, Ahmedabad', margin + 3, bankBoxY + 13.5);
  doc.text('A/C No: 50200012345678  |  IFSC: HDFC0001234', margin + 3, bankBoxY + 18);

  // Right Side: Itemized Totals Box
  const rowHeight = 5.2;
  const renderTotalRow = (label: string, value: string, isBold = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 8.5 : 8);
    doc.setTextColor(...charcoal);
    doc.text(label, totalsBoxX + 2, totalsY + 4);
    doc.text(value, pageWidth - margin - 2, totalsY + 4, { align: 'right' });
    totalsY += rowHeight;
  };

  renderTotalRow('Gross Subtotal:', `₹${Math.round(grossTotal).toLocaleString('en-IN')}`);
  if (totalDiscount > 0) {
    renderTotalRow('Total Discount:', `-₹${Math.round(totalDiscount).toLocaleString('en-IN')}`);
  }
  renderTotalRow('Taxable Value:', `₹${Math.round(taxableAmount).toLocaleString('en-IN')}`);

  if (currentVer.gstApplicable !== false && gstRatePct > 0) {
    const halfRate = (gstRatePct / 2).toFixed(1);
    const halfGst = Math.round(gstAmount / 2);
    renderTotalRow(`CGST (${halfRate}%):`, `₹${halfGst.toLocaleString('en-IN')}`);
    renderTotalRow(`SGST (${halfRate}%):`, `₹${halfGst.toLocaleString('en-IN')}`);
  }

  // Grand Total Highlight Row
  doc.setFillColor(255, 247, 237); // Light amber
  doc.roundedRect(totalsBoxX, totalsY + 1, totalsBoxWidth, 8, 1, 1, 'F');
  doc.setDrawColor(...warmOrange);
  doc.setLineWidth(0.4);
  doc.roundedRect(totalsBoxX, totalsY + 1, totalsBoxWidth, 8, 1, 1, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...warmOrange);
  doc.text('GRAND TOTAL:', totalsBoxX + 3, totalsY + 6.2);
  doc.text(
    `₹${Math.round(grandTotal).toLocaleString('en-IN')}`,
    pageWidth - margin - 3,
    totalsY + 6.2,
    { align: 'right' }
  );
  totalsY += 14;

  // =========================================================================
  // 5. COMMERCIAL TERMS & SIGNATURE BLOCK
  // =========================================================================
  const remainingY = Math.max(totalsY, bankBoxY + 26);
  let termsY = remainingY + 4;

  if (termsY > pageHeight - 55) {
    doc.addPage();
    termsY = 20;
  }

  // Terms Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...charcoal);
  doc.text('COMMERCIAL TERMS & CONDITIONS', margin, termsY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);

  const defaultTerms = [
    '1. Prices quoted are Ex-Works Ahmedabad and valid for 30 days from the quotation date.',
    '2. Payment: 50% advance at the time of purchase order; 50% balance before factory dispatch.',
    '3. Delivery schedule: 3 to 4 weeks from date of confirmed order, advance and site readiness.',
    '4. Warranty: 12 months comprehensive warranty covering manufacturing and material defects.',
    '5. Any modifications in dimensions or specifications requested post-approval will be billed extra.'
  ];

  let ty = termsY + 4.5;
  defaultTerms.forEach(t => {
    doc.text(t, margin, ty);
    ty += 4;
  });

  // Signatures
  const sigY = ty + 6;
  if (sigY < pageHeight - 20) {
    // Client acceptance
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedText);
    doc.text('Accepted & Confirmed By:', margin, sigY);
    doc.text('Client Signature & Company Seal', margin, sigY + 10);

    // D. F. Furniture Signatory
    const sigRightX = pageWidth - margin - 55;
    doc.text('For D. F. FURNITURE DESIGN & MFG.', sigRightX, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...charcoal);
    doc.text('Authorized Signatory', sigRightX, sigY + 10);
  }

  // =========================================================================
  // 6. SAVE / DOWNLOAD PDF
  // =========================================================================
  const sanitizedNum = String(quoteNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
  const finalFileName =
    options.fileName || `Quotation-${sanitizedNum}-${versionLabel}.pdf`;

  if (options.autoDownload !== false) {
    doc.save(finalFileName);
  }
}
