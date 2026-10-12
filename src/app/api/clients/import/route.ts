import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeGstin, formatClientCode, normalizePhoneNumber } from '@/lib/clientUtils';

export async function POST(req: Request) {
  try {
    const { rows } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No client rows provided for import' }, { status: 400 });
    }

    // Fetch existing clients to calculate next client codes and detect duplicates
    const existingClients = await prisma.client.findMany({
      select: { id: true, name: true, clientCode: true, phones: true }
    });

    let maxSeq = 0;
    const existingPhoneMap = new Map<string, string>(); // normalizedPhone -> clientName

    existingClients.forEach(c => {
      if (c.clientCode && c.clientCode.startsWith('DF_CL_')) {
        const num = parseInt(c.clientCode.replace('DF_CL_', ''), 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
      if (Array.isArray(c.phones)) {
        (c.phones as string[]).forEach(p => {
          const norm = normalizePhoneNumber(p);
          if (norm) existingPhoneMap.set(norm, c.name);
        });
      }
    });

    const importedClients: any[] = [];
    const skippedRows: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row.name || row['Company Name'] || row['Client Name'] || '').trim();

      if (!name) {
        skippedRows.push({ row: i + 1, reason: 'Missing Name', data: row });
        continue;
      }

      // Parse phones
      const rawPhone = row.phone || row['Phone'] || row['Mobile'] || '';
      const phones = rawPhone ? [String(rawPhone).trim()] : [];
      const normPhone = normalizePhoneNumber(rawPhone);

      // Check duplicate
      if (normPhone && existingPhoneMap.has(normPhone)) {
        skippedRows.push({
          row: i + 1,
          name,
          reason: `Duplicate phone number (${normPhone}) already registered to ${existingPhoneMap.get(normPhone)}`,
          data: row
        });
        continue;
      }

      // Parse email
      const rawEmail = row.email || row['Email'] || '';
      const emails = rawEmail ? [String(rawEmail).trim()] : [];

      // Parse address
      const street = row.address || row['Address'] || row['Street'] || '';
      const city = row.city || row['City'] || '';
      const state = row.state || row['State'] || '';
      const zip = row.zip || row['Pincode'] || row['PIN'] || '';

      const addresses = (street || city || state || zip)
        ? [{ label: 'Main Office', street, city, state, zip, isBilling: true, isShipping: true }]
        : [];

      // Parse GSTIN & PAN
      const taxId = (row.taxId || row.gstin || row['GSTIN'] || row['GST'] || '').trim().toUpperCase();
      let pan = (row.pan || row['PAN'] || '').trim().toUpperCase();
      let primaryState = state;

      if (taxId) {
        const gstinAnalysis = analyzeGstin(taxId);
        if (gstinAnalysis.pan && !pan) pan = gstinAnalysis.pan;
        if (gstinAnalysis.stateName && !primaryState) primaryState = gstinAnalysis.stateName;
      }

      maxSeq++;
      const clientCode = formatClientCode(maxSeq);

      importedClients.push({
        clientCode,
        name,
        clientType: (row.type || row['Client Type'] || 'BUSINESS').toUpperCase() === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'BUSINESS',
        contactPerson: (row.contactPerson || row['Contact Person'] || '').trim() || null,
        emails,
        phones,
        addresses,
        sourceCategory: (row.sourceCategory || row['Source'] || 'DIRECT_ENQUIRY').replace(/\s+/g, '_').toUpperCase(),
        sourceName: (row.sourceName || '').trim() || null,
        taxId: taxId || null,
        pan: pan || null,
        state: primaryState || null,
        country: (row.country || 'IN').toUpperCase(),
        paymentTerms: (row.paymentTerms || '').trim() || null,
        creditLimit: parseFloat(row.creditLimit || row['Credit Limit'] || '0') || 0,
        outstandingBalance: parseFloat(row.outstandingBalance || '0') || 0,
        isActive: true
      });

      if (normPhone) existingPhoneMap.set(normPhone, name);
    }

    // Insert imported clients in batches
    if (importedClients.length > 0) {
      await prisma.client.createMany({
        data: importedClients
      });
    }

    return NextResponse.json({
      success: true,
      importedCount: importedClients.length,
      skippedCount: skippedRows.length,
      skippedRows
    });
  } catch (error: any) {
    console.error('Error during client bulk import:', error);
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
