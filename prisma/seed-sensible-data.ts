import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting sensible data simulation for D\'furn Modular Systems ERP...');

  // 1. Fetch reference users and employees
  const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const salesUser = await prisma.user.findFirst({ where: { role: 'SALES' } }) || adminUser;

  const employees = await prisma.employee.findMany();
  const salesEmp1 = employees.find(e => e.name.includes('Rajesh')) || employees[0];
  const salesEmp2 = employees.find(e => e.name.includes('Pooja')) || employees[1] || employees[0];
  const salesEmp3 = employees.find(e => e.name.includes('Vikram')) || employees[2] || employees[0];

  const lostReasons = await prisma.lostReason.findMany();
  const reasonPostponed = lostReasons.find(r => r.name.includes('Postponed'))?.id || lostReasons[0]?.id;
  const reasonCompetitor = lostReasons.find(r => r.name.includes('Competitor'))?.id || lostReasons[1]?.id;

  // 2. Identify and Purge Bloat Data (While STRICTLY PRESERVING Nexus Interiors Studio)
  console.log('🧹 Purging test artifacts and bloat data...');

  const bloatClients = await prisma.client.findMany({
    where: {
      AND: [
        { name: { not: 'Nexus Interiors Studio' } },
        {
          OR: [
            { name: { startsWith: 'HeisenByte' } },
            { name: { startsWith: 'Auto Stub' } },
            { name: { startsWith: 'Live Vercel' } },
            { name: { startsWith: 'Privilege Probe' } },
            { name: { startsWith: 'Duplicate Phone' } },
            { name: { startsWith: 'Bench' } },
            { name: { startsWith: 'Automated Test' } },
            { name: { startsWith: 'Local Test' } },
            { name: { startsWith: 'Mumbai Test' } },
            { name: { startsWith: 'John Observer' } },
            { name: { startsWith: 'Precision Modulars Ltd' } },
            { name: { startsWith: 'Apex Corporate Towers' } },
            { name: { in: ['test enq', 'ff', '1st Client'] } }
          ]
        }
      ]
    },
    select: { id: true, name: true }
  });

  const bloatClientIds = bloatClients.map(c => c.id);
  console.log(`Found ${bloatClientIds.length} bloat clients to clean.`);

  if (bloatClientIds.length > 0) {
    // Clean quotations linked to bloat clients
    const bloatQuotes = await prisma.quotation.findMany({
      where: { clientId: { in: bloatClientIds } },
      select: { id: true }
    });
    const bloatQuoteIds = bloatQuotes.map(q => q.id);

    if (bloatQuoteIds.length > 0) {
      await prisma.quotationAdditionalCharge.deleteMany({ where: { version: { quotationId: { in: bloatQuoteIds } } } }).catch(() => {});
      await prisma.quotationItem.deleteMany({ where: { quotationId: { in: bloatQuoteIds } } }).catch(() => {});
      await prisma.quotationItem.deleteMany({ where: { version: { quotationId: { in: bloatQuoteIds } } } }).catch(() => {});
      await prisma.quotationVersion.deleteMany({ where: { quotationId: { in: bloatQuoteIds } } }).catch(() => {});
      await prisma.quotation.deleteMany({ where: { id: { in: bloatQuoteIds } } }).catch(() => {});
    }

    // Clean enquiries linked to bloat clients
    const bloatEnquiries = await prisma.enquiry.findMany({
      where: { clientId: { in: bloatClientIds } },
      select: { id: true }
    });
    const bloatEnqIds = bloatEnquiries.map(e => e.id);

    if (bloatEnqIds.length > 0) {
      await prisma.enquiryItem.deleteMany({ where: { enquiryId: { in: bloatEnqIds } } }).catch(() => {});
      await prisma.communicationLog.deleteMany({ where: { enquiryId: { in: bloatEnqIds } } }).catch(() => {});
      await prisma.enquiryFile.deleteMany({ where: { enquiryId: { in: bloatEnqIds } } }).catch(() => {});
      await prisma.enquiry.deleteMany({ where: { id: { in: bloatEnqIds } } }).catch(() => {});
    }

    // Clean clients
    await prisma.client.deleteMany({ where: { id: { in: bloatClientIds } } }).catch(() => {});
  }

  // Also clean old standalone mock quotes with tiny numbers (e.g. ₹5, ₹46, ₹184)
  const tinyQuotes = await prisma.quotation.findMany({
    where: { totalAmount: { lt: 1000 } },
    select: { id: true }
  });
  for (const tq of tinyQuotes) {
    await prisma.quotationAdditionalCharge.deleteMany({ where: { version: { quotationId: tq.id } } }).catch(() => {});
    await prisma.quotationItem.deleteMany({ where: { quotationId: tq.id } }).catch(() => {});
    await prisma.quotationItem.deleteMany({ where: { version: { quotationId: tq.id } } }).catch(() => {});
    await prisma.quotationVersion.deleteMany({ where: { quotationId: tq.id } }).catch(() => {});
    await prisma.quotation.delete({ where: { id: tq.id } }).catch(() => {});
  }

  console.log('✅ Purge complete. Preserved test fixtures.');

  // 3. SEED REALISTIC CLIENTS
  console.log('🏢 Seeding authentic modular systems clients...');

  const clientDefs = [
    {
      code: 'DF/C/B2B/00011',
      name: 'Zydus Infotech Solutions Pvt Ltd',
      companyName: 'Zydus Infotech Solutions Pvt Ltd',
      type: 'Business',
      mode: 'B2B',
      contact: 'Karan Singhal (Head of Corporate Procurement)',
      taxId: '24AABCZ1234F1Z8',
      phones: ['+919825014892'],
      emails: ['karan.singhal@zydusinfotech.in'],
      state: 'Gujarat',
      source: 'Direct',
      credit: 2500000,
      paymentTerms: '50% Advance · 40% against Proforma · 10% on Handover',
      address: {
        id: 'addr-zydus-1',
        addressLine1: 'Tower B, 7th Floor, Mondeal Heights',
        addressLine2: 'Near Wide Angle, SG Highway',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380015',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2B/00012',
      name: 'Torrent Diagnostics & Research Centre',
      companyName: 'Torrent Diagnostics & Research Centre',
      type: 'Business',
      mode: 'B2B',
      contact: 'Dr. Rakesh Mankad (Director of Infrastructure)',
      taxId: '24AABCT9876C1Z3',
      phones: ['+919879122841'],
      emails: ['rmankad@torrentresearch.org'],
      state: 'Gujarat',
      source: 'Direct',
      credit: 1500000,
      paymentTerms: '40% Advance · 50% against Dispatch · 10% on Installation',
      address: {
        id: 'addr-torrent-1',
        addressLine1: 'Plot 42, GIDC Phase II',
        addressLine2: 'Vatva Industrial Estate',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '382445',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2B/00013',
      name: 'Hive Co-Working Spaces LLP',
      companyName: 'Hive Co-Working Spaces LLP',
      type: 'Business',
      mode: 'B2B',
      contact: 'Devangi Shah (Managing Partner)',
      taxId: '24AAFFH5432B1Z1',
      phones: ['+919924033190'],
      emails: ['devangi@thehiveworkspaces.com'],
      state: 'Gujarat',
      source: 'Website',
      credit: 2000000,
      paymentTerms: '50% Advance · 50% before Dispatch',
      address: {
        id: 'addr-hive-1',
        addressLine1: '4th Floor, Dev Prime',
        addressLine2: 'Corporate Road, Prahlad Nagar',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380015',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2B/00014',
      name: 'Adani Logistics & Cold Chain Corp',
      companyName: 'Adani Logistics & Cold Chain Corp',
      type: 'Business',
      mode: 'B2B',
      contact: 'Sandeep Nambiar (General Manager - Facilities)',
      taxId: '24AAACA1122D1ZV',
      phones: ['+919727788123'],
      emails: ['sandeep.nambiar@adanilogistics.com'],
      state: 'Gujarat',
      source: 'Referral',
      credit: 5000000,
      paymentTerms: '30 Days Net from Delivery',
      address: {
        id: 'addr-adani-1',
        addressLine1: 'Adani Corporate House, Shantigram',
        addressLine2: 'Near Vaishnodevi Circle, SG Highway',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '382421',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2B/00015',
      name: 'Equitas FinTech Solutions Ltd',
      companyName: 'Equitas FinTech Solutions Ltd',
      type: 'Business',
      mode: 'B2B',
      contact: 'Priyanka Bhatt (Operations Head)',
      taxId: '24AABCE4455E1ZX',
      phones: ['+919824455678'],
      emails: ['priyanka.bhatt@equitasfin.in'],
      state: 'Gujarat',
      source: 'Website',
      credit: 3000000,
      paymentTerms: '50% Advance · 40% on Delivery · 10% on Handover',
      address: {
        id: 'addr-equitas-1',
        addressLine1: 'Block C, 9th Floor, GIFT One Tower',
        addressLine2: 'GIFT City Road',
        city: 'Gandhinagar',
        state: 'Gujarat',
        pincode: '382355',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2B/00016',
      name: 'Apex Precision Engineering Pvt Ltd',
      companyName: 'Apex Precision Engineering Pvt Ltd',
      type: 'Business',
      mode: 'B2B',
      contact: 'Dharmesh Panchal (Works Director)',
      taxId: '24AABCA7788P1Z0',
      phones: ['+919898011234'],
      emails: ['dharmesh@apexprecision.co.in'],
      state: 'Gujarat',
      source: 'Direct',
      credit: 1000000,
      paymentTerms: '50% Advance · 50% on Delivery',
      address: {
        id: 'addr-apex-prec-1',
        addressLine1: 'Survey No. 128, Changodar Industrial Zone',
        addressLine2: 'Sarkhej-Bavla Road, Moraiya',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '382213',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2B/00017',
      name: 'Mindspace Digital Media Pvt Ltd',
      companyName: 'Mindspace Digital Media Pvt Ltd',
      type: 'Business',
      mode: 'B2B',
      contact: 'Rohit Nair (Admin Lead - West Region)',
      taxId: '27AABCM6677G1ZA',
      phones: ['+919820044321'],
      emails: ['rohit.nair@mindspacemedia.in'],
      state: 'Maharashtra',
      source: 'Social Media',
      credit: 2000000,
      paymentTerms: '50% Advance · 50% against Dispatch',
      address: {
        id: 'addr-mindspace-1',
        addressLine1: 'Building 5, Mindspace IT Park',
        addressLine2: 'Link Road, Malad West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400064',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2B2C/00018',
      name: 'Studio Vistara Architects',
      companyName: 'Studio Vistara Architects',
      type: 'Business',
      mode: 'B2B2C',
      contact: 'Ar. Nirav Trivedi (Principal Architect)',
      taxId: '24AACFS9900H1ZT',
      phones: ['+919825566778'],
      emails: ['nirav@studiovistara.in'],
      state: 'Gujarat',
      source: 'Architect/Designer',
      credit: 4000000,
      paymentTerms: 'Trade Partner Terms · 40% Advance · 50% Dispatch · 10% Handover',
      address: {
        id: 'addr-vistara-1',
        addressLine1: '301, Titanium Square',
        addressLine2: 'Thaltej Cross Roads, SG Highway',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380054',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2B2C/00019',
      name: 'Paramount Turnkey Fitouts & Interiors',
      companyName: 'Paramount Turnkey Fitouts & Interiors',
      type: 'Business',
      mode: 'B2B2C',
      contact: 'Bhavesh Prajapati (Managing Partner)',
      taxId: '24AAHFP3344J1ZQ',
      phones: ['+919824077890'],
      emails: ['bhavesh@paramountturnkey.com'],
      state: 'Gujarat',
      source: 'Architect/Designer',
      credit: 6000000,
      paymentTerms: 'Running Account · 15 Days Net',
      address: {
        id: 'addr-paramount-1',
        addressLine1: '12, Race Course Circle',
        addressLine2: 'Alkapuri',
        city: 'Vadodara',
        state: 'Gujarat',
        pincode: '390007',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2B2C/00020',
      name: 'Design Box Spaces Studio',
      companyName: 'Design Box Spaces Studio',
      type: 'Business',
      mode: 'B2B2C',
      contact: 'Ar. Shruti Chokshi (Design Director)',
      taxId: '24AABCD8899K1ZR',
      phones: ['+919712911223'],
      emails: ['shruti@designboxspaces.com'],
      state: 'Gujarat',
      source: 'Architect/Designer',
      credit: 2500000,
      paymentTerms: '50% Advance · 50% on Handover',
      address: {
        id: 'addr-designbox-1',
        addressLine1: '402, Venus Atlantis',
        addressLine2: 'Anand Nagar Road, Prahlad Nagar',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380015',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2B2C/00021',
      name: 'Kothari & Associates EPC Turnkey',
      companyName: 'Kothari & Associates EPC Turnkey',
      type: 'Business',
      mode: 'B2B2C',
      contact: 'Haresh Kothari (Managing Director)',
      taxId: '24AAACK5566L1ZM',
      phones: ['+919825199887'],
      emails: ['haresh@kothariepc.com'],
      state: 'Gujarat',
      source: 'Referral',
      credit: 5000000,
      paymentTerms: '30% Advance · 50% on Site Delivery · 20% on Snag Clearance',
      address: {
        id: 'addr-kothari-1',
        addressLine1: 'Ring Road Industrial Hub',
        addressLine2: 'Near Majura Gate',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395002',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2C/00022',
      name: 'Dr. Aniruddh Parekh',
      companyName: null,
      type: 'Individual',
      mode: 'B2C',
      contact: 'Dr. Aniruddh Parekh (Vascular Surgeon)',
      taxId: null,
      phones: ['+919825233445'],
      emails: ['draniruddh.parekh@gmail.com'],
      state: 'Gujarat',
      source: 'Referral',
      credit: 0,
      paymentTerms: '60% Advance with Order · 40% before Installation',
      address: {
        id: 'addr-parekh-1',
        addressLine1: 'Bungalow 18, Aarohi Star Villas',
        addressLine2: 'South Bopal Road',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380058',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2C/00023',
      name: 'Meera R. Singhania',
      companyName: null,
      type: 'Individual',
      mode: 'B2C',
      contact: 'Meera Singhania (Entrepreneur)',
      taxId: null,
      phones: ['+919879544112'],
      emails: ['meera.singhania@outlook.com'],
      state: 'Gujarat',
      source: 'Social Media',
      credit: 0,
      paymentTerms: '50% Advance · 50% before Dispatch',
      address: {
        id: 'addr-singhania-1',
        addressLine1: 'Penthouse 1401, The Park Residences',
        addressLine2: 'Sindhu Bhavan Road, Bodakdev',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380059',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2C/00024',
      name: 'Vikramaditya Mehta',
      companyName: null,
      type: 'Individual',
      mode: 'B2C',
      contact: 'Vikramaditya Mehta (Diamond Exporter)',
      taxId: null,
      phones: ['+919825088776'],
      emails: ['vmehta.diamonds@gmail.com'],
      state: 'Gujarat',
      source: 'Direct',
      credit: 0,
      paymentTerms: '50% Advance · 40% on Delivery · 10% Handover',
      address: {
        id: 'addr-mehta-1',
        addressLine1: 'Villa 7, Gulmohar Greens',
        addressLine2: 'Sanand-Sarkhej Highway',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '382210',
        country: 'India',
        isBilling: true
      }
    },
    {
      code: 'DF/C/B2C/00025',
      name: 'Cyrus S. Poonawalla',
      companyName: null,
      type: 'Individual',
      mode: 'B2C',
      contact: 'Cyrus Poonawalla (HNI Investor)',
      taxId: null,
      phones: ['+919820155443'],
      emails: ['cyrus.poonawalla@hotmail.com'],
      state: 'Maharashtra',
      source: 'Architect/Designer',
      credit: 0,
      paymentTerms: '50% Advance · 50% before Dispatch',
      address: {
        id: 'addr-poonawalla-1',
        addressLine1: 'Sea Face Penthouse, Worli Sea Face',
        addressLine2: 'Near Flora Restaurant',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400030',
        country: 'India',
        isBilling: true
      }
    }
  ];

  const createdClients: Record<string, any> = {};

  for (const c of clientDefs) {
    const existing = await prisma.client.findFirst({
      where: {
        OR: [
          { clientCode: c.code },
          { name: c.name }
        ]
      }
    });

    const clientData = {
      clientCode: c.code,
      name: c.name,
      companyName: c.companyName,
      clientType: c.type,
      businessMode: c.mode,
      contactPerson: c.contact,
      taxId: c.taxId,
      phones: c.phones,
      phoneDetails: c.phones.map(p => ({
        e164: p,
        dial: '+91',
        number: p.replace('+91', ''),
        iso2: 'IN',
        valid: true,
        kind: 'mobile'
      })),
      emails: c.emails,
      state: c.state,
      country: 'India',
      countryIso2: 'IN',
      sourceCategory: c.source,
      creditLimit: c.credit,
      paymentTerms: c.paymentTerms,
      addresses: [c.address],
      isActive: true
    };

    if (existing) {
      const updated = await prisma.client.update({
        where: { id: existing.id },
        data: clientData
      });
      createdClients[c.code] = updated;
    } else {
      const created = await prisma.client.create({
        data: clientData
      });
      createdClients[c.code] = created;
    }
  }

  console.log(`✅ Seeded ${Object.keys(createdClients).length} authentic clients.`);

  // 4. SEED REALISTIC ENQUIRIES & ITEMS
  console.log('📋 Seeding authentic enquiries with communication logs and items...');

  const enquiryDefs = [
    {
      enquiryNumber: 'DF_ENQ_20261019_01',
      clientCode: 'DF/C/B2B/00011', // Zydus Infotech
      stage: 'Quoted',
      outcome: 'Open',
      salesperson: salesEmp1,
      propertyType: 'Commercial Office',
      budget: 2200000,
      timeline: '45 Days',
      brief: 'Turnkey workstation fit-out for 140 software engineers on 7th floor Mondeal Heights. 25mm pre-lam particle board linear benching with extruded aluminum raceway, acoustic fabric tile screens, and 3-drawer mobile pedestals. Includes 2 meeting room credenzas.',
      items: [
        {
          description: '4-Seater Linear Benching Cluster with Aluminum Dual-Chamber Raceway',
          expectedDimensions: 'L 2400 × B 1200 × H 750 mm',
          materialPreference: 'Action TESA Pre-lam MDF (Classic Walnut & Frosty White)',
          quantity: 35,
          unitPrice: 38000,
          total: 1330000
        },
        {
          description: 'Under-desk 3-Drawer Lockable Mobile Pedestal Unit with Central Lock',
          expectedDimensions: 'L 400 × B 450 × H 650 mm',
          materialPreference: '18mm engineered board with Hafele central lock mechanism',
          quantity: 140,
          unitPrice: 4200,
          total: 588000
        },
        {
          description: 'Executive Meeting Room Credenza Console with 4-Shutter Storage',
          expectedDimensions: 'L 1800 × B 450 × H 800 mm',
          materialPreference: 'Natural Teak veneer with PU clear matte finish',
          quantity: 2,
          unitPrice: 36000,
          total: 72000
        }
      ],
      logs: [
        {
          date: '2026-10-13',
          mode: 'Site Visit',
          description: 'Completed site visit and 3D laser survey at Mondeal Heights 7th floor. Verified core power conduit placements and column grid spacing.'
        },
        {
          date: '2026-10-15',
          mode: 'Meeting',
          description: 'Presented 3D layouts and material sample finishes. Client approved Classic Walnut top with Frosty White understructure.'
        },
        {
          date: '2026-10-18',
          mode: 'Call',
          description: 'Commercial BOQ submitted. Discussed 5% volume rebate on 35 workstation clusters.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-14T10:00:00.000Z', byName: salesEmp1.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_02',
      clientCode: 'DF/C/B2B/00012', // Torrent Diagnostics
      stage: 'Converted',
      outcome: 'Open',
      salesperson: salesEmp2,
      propertyType: 'Healthcare / Lab',
      budget: 1500000,
      timeline: '30 Days',
      brief: 'Modular laboratory storage and admin desks for pathology block at Vatva. Chemical-resistant epoxy edge-banded modular cabinets, laminate workstations, and heavy-duty sample storage racks.',
      items: [
        {
          description: '2-Person Chemical-Resistant Pathology Laboratory Workstation',
          expectedDimensions: 'L 1200 × B 600 × H 750 mm',
          materialPreference: 'High-pressure anti-bacterial laminate with 2mm PVC edgeband',
          quantity: 18,
          unitPrice: 28000,
          total: 504000
        },
        {
          description: 'Modular Chemical Storage Overhead Unit with Frosted Toughened Glass',
          expectedDimensions: 'L 1200 × B 350 × H 600 mm',
          materialPreference: '18mm moisture-resistant BWR plywood carcass',
          quantity: 24,
          unitPrice: 18500,
          total: 444000
        },
        {
          description: 'Mobile Reagent & Specimen Storage Cart with Castors',
          expectedDimensions: 'L 600 × B 500 × H 850 mm',
          materialPreference: 'Stainless steel frame with laminate shelves',
          quantity: 12,
          unitPrice: 14500,
          total: 174000
        }
      ],
      logs: [
        {
          date: '2026-10-07',
          mode: 'Site Visit',
          description: 'Inspected pathology wing layout. Confirmed anti-bacterial surface requirements and gas/water line access clearances.'
        },
        {
          date: '2026-10-12',
          mode: 'Meeting',
          description: 'Technical specification sheet and warranty certificate on Blum hinges reviewed. Client approved commercial proposal.'
        },
        {
          date: '2026-10-17',
          mode: 'WhatsApp',
          description: 'Purchase order received. 40% mobilization advance received via RTGS. Advanced to production.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-09T11:00:00.000Z', byName: salesEmp2.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_03',
      clientCode: 'DF/C/B2B/00013', // Hive Co-Working
      stage: 'Quoted',
      outcome: 'Open',
      salesperson: salesEmp1,
      propertyType: 'Co-Working Space',
      budget: 2000000,
      timeline: '30 Days',
      brief: 'Flexible collaborative workstation layout for new 60-seat co-working wing at Prahlad Nagar. 120-degree 3-seater workstation clusters with frosted acoustic dividers, 4 single-person acoustic phone pods, and 12-seater conference table with motorized pop-up boxes.',
      items: [
        {
          description: '120-Degree Collaborative Workstation Cluster (3-Seater Pod)',
          expectedDimensions: 'L 2100 × B 2100 × H 750 mm',
          materialPreference: 'Merino prelaminated particle board with chamfered edges',
          quantity: 20,
          unitPrice: 42000,
          total: 840000
        },
        {
          description: 'Single-Person Acoustic Phone Booth / Pod with Ventilation & Power',
          expectedDimensions: 'L 1000 × B 1000 × H 2200 mm',
          materialPreference: 'Acoustic fabric felt interior, 10mm acoustic laminated glass door',
          quantity: 4,
          unitPrice: 110000,
          total: 440000
        },
        {
          description: '12-Seater Executive Conference Table with Dual Motorized Connectivity Box',
          expectedDimensions: 'L 3600 × B 1200 × H 750 mm',
          materialPreference: 'Smoked Walnut veneer with black powder-coated chamfered legs',
          quantity: 1,
          unitPrice: 165000,
          total: 165000
        }
      ],
      logs: [
        {
          date: '2026-10-11',
          mode: 'Site Visit',
          description: 'Detailed measurement of co-working floor. Agreed on collaborative 120-degree pods to maximize density and natural light.'
        },
        {
          date: '2026-10-16',
          mode: 'Email',
          description: 'Submitted DF/Q/2026-27/0013 with 12% founder volume rebate. Awaiting partner approval.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-12T14:00:00.000Z', byName: salesEmp1.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_04',
      clientCode: 'DF/C/B2B/00014', // Adani Logistics
      stage: 'Qualified',
      outcome: 'Open',
      salesperson: salesEmp3,
      propertyType: 'Commercial Office',
      budget: 1800000,
      timeline: '60 Days',
      brief: 'Control room and dispatch office modular desking for 40 operations personnel at Shantigram. Dual monitor arm mounts, heavy gauge steel understructure, cable management baskets, and anti-static laminate surfaces.',
      items: [
        {
          description: 'Heavy-Duty 24/7 Operations Control Room Console Desk',
          expectedDimensions: 'L 1500 × B 800 × H 750 mm',
          materialPreference: '25mm anti-static postformed laminate with MS structural frame',
          quantity: 40,
          unitPrice: 32000,
          total: 1280000
        },
        {
          description: 'Shift Supervisor Credenza Storage Unit with Tamper-Proof Locks',
          expectedDimensions: 'L 1200 × B 450 × H 750 mm',
          materialPreference: 'Heavy gauge cold-rolled steel carcass with laminate shutters',
          quantity: 10,
          unitPrice: 19000,
          total: 190000
        }
      ],
      logs: [
        {
          date: '2026-10-14',
          mode: 'Meeting',
          description: 'Reviewed 24x7 control room ergonomic guidelines. Specified dual-articulating monitor arms and 200kg load test requirements.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-15T15:30:00.000Z', byName: salesEmp3.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_05',
      clientCode: 'DF/C/B2B/00015', // Equitas FinTech
      stage: 'Converted',
      outcome: 'Open',
      salesperson: salesEmp2,
      propertyType: 'Commercial Office',
      budget: 1900000,
      timeline: '25 Days',
      brief: 'Branch head cabin and banking back-office fit-out at GIFT City. Smoked oak laminate executive L-desk, glass credenza, and 24 modular back-office cubicles.',
      items: [
        {
          description: 'Managing Director Executive Desk Suite with Integrated Side Runner',
          expectedDimensions: 'L 2100 × B 900 × H 760 mm',
          materialPreference: 'Natural Smoked Oak veneer with wireless Qi charging pad',
          quantity: 2,
          unitPrice: 85000,
          total: 170000
        },
        {
          description: 'Modular Privacy Cubicle Workstation with Fabric Tackable Pinboard',
          expectedDimensions: 'L 1200 × B 600 × H 1200 mm',
          materialPreference: 'E1 grade particle board with fire-retardant fabric tiles',
          quantity: 24,
          unitPrice: 24000,
          total: 576000
        },
        {
          description: 'Executive Full-Height Archive Storage Unit with Digital Lock',
          expectedDimensions: 'L 1800 × B 450 × H 2100 mm',
          materialPreference: 'BWR plywood with veneer-matching laminate',
          quantity: 4,
          unitPrice: 48000,
          total: 192000
        }
      ],
      logs: [
        {
          date: '2026-10-05',
          mode: 'Site Visit',
          description: 'Completed laser scan of GIFT One Tower 9th floor premises.'
        },
        {
          date: '2026-10-10',
          mode: 'Meeting',
          description: 'Signed off veneer samples and fabric swatch code #F-8821.'
        },
        {
          date: '2026-10-16',
          mode: 'WhatsApp',
          description: 'Work order confirmed. 50% advance cleared. Production initiated.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-07T09:30:00.000Z', byName: salesEmp2.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_06',
      clientCode: 'DF/C/B2B2C/00018', // Studio Vistara Architects
      stage: 'Quoted',
      outcome: 'Open',
      salesperson: salesEmp1,
      propertyType: 'Commercial Showroom',
      budget: 1600000,
      timeline: '35 Days',
      brief: 'Corporate headquarters for their real estate developer client on SG Highway. Bespoke curved reception desk in solid acrylic surface with modular veneer wall panelling and 16-seater board room table.',
      items: [
        {
          description: '16-Seater Boardroom Table with Motorized Pop-Up Conduits & Concealed Spine',
          expectedDimensions: 'L 4800 × B 1400 × H 750 mm',
          materialPreference: 'Imported American Walnut bookmatched veneer with PU clear coat',
          quantity: 1,
          unitPrice: 245000,
          total: 245000
        },
        {
          description: 'Seamless Thermoformed Acrylic Solid Surface Curved Reception Console',
          expectedDimensions: 'L 3000 × B 1000 × H 1050 mm',
          materialPreference: '12mm Corian / Dupont solid surface over CNC-routed marine ply frame',
          quantity: 1,
          unitPrice: 195000,
          total: 195000
        },
        {
          description: 'Acoustic Fluted Wall Panelling System with Concealed Z-Clips',
          expectedDimensions: 'L 6000 × B 50 × H 2800 mm',
          materialPreference: 'FR-MDF with natural American Walnut acoustic micro-perforated veneer',
          quantity: 1,
          unitPrice: 260000,
          total: 260000
        }
      ],
      logs: [
        {
          date: '2026-10-10',
          mode: 'Meeting',
          description: 'Detailed AutoCAD drawing exchange and joinery detail sign-off for the curved Corian desk.'
        },
        {
          date: '2026-10-17',
          mode: 'Email',
          description: 'Quotation DF/Q/2026-27/0015 shared. Trade commission structure confirmed.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-11T12:00:00.000Z', byName: salesEmp1.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_07',
      clientCode: 'DF/C/B2B2C/00019', // Paramount Turnkey Fitouts
      stage: 'Converted',
      outcome: 'Open',
      salesperson: salesEmp3,
      propertyType: 'Commercial Turnkey',
      budget: 2800000,
      timeline: '40 Days',
      brief: 'Turnkey modular furniture package for GIDC Savli administrative building. 80 modular benching workstations, 6 manager cabins, and cafeteria dining modular tables.',
      items: [
        {
          description: '4-Seater Linear Benching Workstations with Acrylic Screens',
          expectedDimensions: 'L 2400 × B 1200 × H 750 mm',
          materialPreference: 'Commercial grade prelam particle board, 2mm PVC edge banding',
          quantity: 20,
          unitPrice: 36000,
          total: 720000
        },
        {
          description: 'Manager Cabin L-Shaped Executive Desk with Credenza',
          expectedDimensions: 'L 1650 × B 1500 × H 750 mm',
          materialPreference: 'Teak laminate with dark bronze powder-coated steel legs',
          quantity: 6,
          unitPrice: 42000,
          total: 252000
        },
        {
          description: 'Cafeteria Heavy-Duty 4-Seater Fixed Pedestal Modular Dining Table',
          expectedDimensions: 'L 1200 × B 800 × H 750 mm',
          materialPreference: 'Compact laminate top with stainless steel round pedestal base',
          quantity: 15,
          unitPrice: 18000,
          total: 270000
        }
      ],
      logs: [
        {
          date: '2026-10-04',
          mode: 'Site Visit',
          description: 'Savli site visited. Building civil work in completion stage. Lift dimensions verified for workstation top loading.'
        },
        {
          date: '2026-10-15',
          mode: 'Meeting',
          description: 'Turnkey contract awarded. First mobilization advance processed.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-05T14:00:00.000Z', byName: salesEmp3.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_08',
      clientCode: 'DF/C/B2C/00022', // Dr. Aniruddh Parekh
      stage: 'Converted',
      outcome: 'Open',
      salesperson: salesEmp1,
      propertyType: 'Luxury Villa',
      budget: 1200000,
      timeline: '25 Days',
      brief: 'Luxury modular kitchen and master bedroom walk-in wardrobe for new villa in South Bopal. Island kitchen with German anti-scratch acrylic shutters, Blum soft-close tandem boxes, and full-height glass-front sliding wardrobe with sensor LED strip lights.',
      items: [
        {
          description: 'Grand Island Modular Kitchen Suite with German Acrylic Shutters & Blum Servo-Drive',
          expectedDimensions: 'L 3600 × B 2400 × H 850 mm',
          materialPreference: 'Action TESA HDHMR carcass, Senosan acrylic shutters, Blum Legrabox drawers',
          quantity: 1,
          unitPrice: 580000,
          total: 580000
        },
        {
          description: 'Floor-to-Ceiling 3-Track Tinted Glass Sliding Wardrobe with Sensor LED Strips',
          expectedDimensions: 'L 3000 × B 650 × H 2800 mm',
          materialPreference: 'Anodized black aluminum profile with fluted tinted glass and velvet-lined jewelry drawers',
          quantity: 1,
          unitPrice: 320000,
          total: 320000
        }
      ],
      logs: [
        {
          date: '2026-10-09',
          mode: 'Site Visit',
          description: 'Measured Aarohi Star villa kitchen and master bedroom. Client requested premium Senosan acrylic finish and full Blum hardware.'
        },
        {
          date: '2026-10-13',
          mode: 'Meeting',
          description: 'Showroom mock-up tested. Client confirmed drawer configurations and cutlery trays.'
        },
        {
          date: '2026-10-17',
          mode: 'WhatsApp',
          description: 'Client transferred 60% booking advance. Manufacturing drawings finalized.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-10T11:00:00.000Z', byName: salesEmp1.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_09',
      clientCode: 'DF/C/B2C/00023', // Meera R. Singhania
      stage: 'Quoted',
      outcome: 'Open',
      salesperson: salesEmp2,
      propertyType: 'Luxury Penthouse',
      budget: 900000,
      timeline: '20 Days',
      brief: 'Complete modular wardrobe package for 4BHK apartment at Sindhu Bhavan Road. 4 custom sliding wardrobes in PU lacquer finish with integrated dressing console and vanity unit.',
      items: [
        {
          description: '3-Door Sliding Modular Wardrobe with Soft-Close Top-Hung Sliders',
          expectedDimensions: 'L 2400 × B 600 × H 2600 mm',
          materialPreference: 'BWR plywood carcass with Italian PU matte lacquer shutters',
          quantity: 4,
          unitPrice: 165000,
          total: 660000
        },
        {
          description: 'Floating Dressing Console with Backlit LED Mirror & Velvet Drawers',
          expectedDimensions: 'L 1200 × B 400 × H 750 mm',
          materialPreference: 'Corian top with PU lacquer drawers',
          quantity: 2,
          unitPrice: 45000,
          total: 90000
        }
      ],
      logs: [
        {
          date: '2026-10-12',
          mode: 'Site Visit',
          description: 'Surveyed penthouse 1401. Wall verticality verified. Ceiling level dropped ceiling confirmed for wardrobe recess.'
        },
        {
          date: '2026-10-17',
          mode: 'WhatsApp',
          description: 'Shared DF/Q/2026-27/0018 with PU lacquer finish color code NCS S 1502-Y.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-13T10:00:00.000Z', byName: salesEmp2.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_10',
      clientCode: 'DF/C/B2B/00016', // Apex Precision
      stage: 'New',
      outcome: 'Open',
      salesperson: salesEmp3,
      propertyType: 'Industrial Factory Shed',
      budget: 650000,
      timeline: '30 Days',
      brief: 'Factory shop-floor supervisor cabins and documentation desks for new manufacturing shed at Moraiya. Pre-laminated robust workbenches with lockable tool storage.',
      items: [],
      logs: [
        {
          date: '2026-10-18',
          mode: 'Call',
          description: 'Client requested catalogue and quote for 8 shop-floor supervisor cabins. Scheduled site visit for Thursday.'
        }
      ],
      history: []
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_11',
      clientCode: 'DF/C/B2B/00017', // Mindspace Digital
      stage: 'Qualified',
      outcome: 'Open',
      salesperson: salesEmp1,
      propertyType: 'Creative Studio',
      budget: 1400000,
      timeline: '35 Days',
      brief: 'Creative agency open studio fit-out in Malad West. Raw industrial pine finish modular benching for 48 animators, sound-dampening acoustic wall dividers, and informal pantry bar counter.',
      items: [
        {
          description: 'Industrial Modular Benching Cluster with Powder-Coated Metal A-Frame',
          expectedDimensions: 'L 2400 × B 1200 × H 750 mm',
          materialPreference: 'Rustic Pine textured laminate with black matte A-frame legs',
          quantity: 12,
          unitPrice: 42000,
          total: 504000
        },
        {
          description: 'Acoustic Sound-Dampening Fabric Free-Standing Dividers',
          expectedDimensions: 'L 1200 × B 40 × H 1600 mm',
          materialPreference: 'NRC 0.85 acoustic polyester felt core with aluminum frame',
          quantity: 24,
          unitPrice: 11000,
          total: 264000
        }
      ],
      logs: [
        {
          date: '2026-10-15',
          mode: 'Meeting',
          description: 'Discussed Mumbai logistics and night delivery restrictions in Mindspace park. BOQ prepared.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-16T15:00:00.000Z', byName: salesEmp1.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_12',
      clientCode: 'DF/C/B2B2C/00020', // Design Box
      stage: 'New',
      outcome: 'Open',
      salesperson: salesEmp2,
      propertyType: 'Legal Firm Office',
      budget: 1000000,
      timeline: '45 Days',
      brief: 'Architectural client enquiry for a law firm office on Anand Nagar Road. 12 lawyer partner desks in walnut veneer with concealed wire management and leather writing pads.',
      items: [],
      logs: [
        {
          date: '2026-10-18',
          mode: 'Meeting',
          description: 'Received tender drawings for advocate chambers. BOQ costing underway.'
        }
      ],
      history: []
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_13',
      clientCode: 'DF/C/B2C/00024', // Vikramaditya Mehta
      stage: 'Qualified',
      outcome: 'Open',
      salesperson: salesEmp1,
      propertyType: 'Luxury Villa',
      budget: 1500000,
      timeline: '40 Days',
      brief: 'Modular walk-in closet for villa master suite and guest bedroom wardrobes at Gulmohar Greens. Smoked eucalyptus veneer with matte black aluminum profile glass shutters.',
      items: [
        {
          description: 'Luxury Walk-in Wardrobe System with Sensor Warm-White LED Profiles',
          expectedDimensions: 'L 4200 × B 2800 × H 2800 mm',
          materialPreference: 'Eucalyptus Smoked Veneer with Hafele sensor lighting and velvet inserts',
          quantity: 1,
          unitPrice: 780000,
          total: 780000
        }
      ],
      logs: [
        {
          date: '2026-10-14',
          mode: 'Site Visit',
          description: 'Measured villa master suite closet room. Sample finishes submitted.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-15T11:00:00.000Z', byName: salesEmp1.name }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_14',
      clientCode: 'DF/C/B2C/00025', // Cyrus Poonawalla
      stage: 'Lost',
      outcome: 'Lost',
      salesperson: salesEmp1,
      propertyType: 'Luxury Penthouse',
      budget: 800000,
      timeline: '60 Days',
      brief: 'Penthouse second kitchen and butler pantry at Worli Sea Face. Stainless steel carcass with matte ceramic finish shutters.',
      lostReasonId: reasonPostponed,
      lostNote: 'Client decided to postpone penthouse renovation until Q3 due to extended overseas business travel.',
      items: [],
      logs: [
        {
          date: '2026-10-09',
          mode: 'Call',
          description: 'Client informed that civil contractor has pushed back project handover. Project placed on hold.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-05T10:00:00.000Z', byName: salesEmp1.name },
        { type: 'lost', at: '2026-10-10T12:00:00.000Z', byName: salesEmp1.name, atStage: 'Qualified' }
      ]
    },
    {
      enquiryNumber: 'DF_ENQ_20261019_15',
      clientCode: 'DF/C/B2B2C/00021', // Kothari & Associates
      stage: 'Lost',
      outcome: 'Lost',
      salesperson: salesEmp3,
      propertyType: 'Corporate Office',
      budget: 1800000,
      timeline: '30 Days',
      brief: 'Textile market corporate office in Surat for 120 linear seats.',
      lostReasonId: reasonCompetitor,
      lostNote: 'Client opted for a local Surat fabricator who quoted 15% lower on unbranded non-warranty hardware.',
      items: [],
      logs: [
        {
          date: '2026-10-11',
          mode: 'Meeting',
          description: 'Client decided based purely on low capital outlay; chose local vendor without standardized warranty.'
        }
      ],
      history: [
        { type: 'qualified', at: '2026-10-07T11:00:00.000Z', byName: salesEmp3.name },
        { type: 'lost', at: '2026-10-12T16:00:00.000Z', byName: salesEmp3.name, atStage: 'Qualified' }
      ]
    }
  ];

  const createdEnquiries: Record<string, any> = {};

  for (const e of enquiryDefs) {
    const client = createdClients[e.clientCode];
    if (!client) continue;

    const existing = await prisma.enquiry.findUnique({
      where: { enquiryNumber: e.enquiryNumber }
    });

    const enqData = {
      enquiryNumber: e.enquiryNumber,
      clientId: client.id,
      salespersonId: e.salesperson.id,
      salespersonName: e.salesperson.name,
      propertyType: e.propertyType,
      estimatedBudget: e.budget,
      expectedTimeline: e.timeline,
      brief: e.brief,
      notes: e.brief,
      stage: e.stage,
      outcome: e.outcome,
      lostReasonId: e.lostReasonId || null,
      lostNote: e.lostNote || null,
      hasCommunication: e.logs.length > 0,
      history: e.history as any,
      items: {
        create: e.items.map(it => ({
          description: it.description,
          expectedDimensions: it.expectedDimensions,
          materialPreference: it.materialPreference,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total
        }))
      },
      communicationLogs: {
        create: e.logs.map(l => ({
          stage: 'Enquiry',
          date: l.date,
          mode: l.mode,
          description: l.description,
          loggedByName: e.salesperson.name
        }))
      }
    };

    if (existing) {
      await prisma.enquiryItem.deleteMany({ where: { enquiryId: existing.id } });
      await prisma.communicationLog.deleteMany({ where: { enquiryId: existing.id } });
      const updated = await prisma.enquiry.update({
        where: { id: existing.id },
        data: enqData
      });
      createdEnquiries[e.enquiryNumber] = updated;
    } else {
      const created = await prisma.enquiry.create({
        data: enqData
      });
      createdEnquiries[e.enquiryNumber] = created;
    }
  }

  console.log(`✅ Seeded ${Object.keys(createdEnquiries).length} authentic enquiries.`);

  // 5. SEED REALISTIC QUOTATIONS WITH EXACT COMMERCIAL MATH
  console.log('💰 Seeding authentic multi-versioned quotations with commercial mathematics...');

  const quoteDefs = [
    {
      code: 'DF/Q/2026-27/0011',
      enquiryCode: 'DF_ENQ_20261019_01',
      clientCode: 'DF/C/B2B/00011',
      status: 'Sent',
      salesperson: salesEmp1,
      versions: [
        {
          versionNo: 1,
          versionCode: 'DF/Q/2026-27/0011-v0',
          status: 'Superseded',
          supersededAt: new Date(Date.now() - 2 * 86400000),
          items: [
            {
              description: '4-Seater Linear Benching Cluster with Aluminum Dual-Chamber Raceway',
              quantity: 35,
              unitPrice: 38000,
              discountAmount: 0,
              total: 1330000,
              expectedDimensions: 'L 2400 × B 1200 × H 750 mm',
              materialPreference: 'Action TESA Pre-lam MDF (Classic Walnut & Frosty White)'
            },
            {
              description: 'Under-desk 3-Drawer Lockable Mobile Pedestal Unit with Central Lock',
              quantity: 140,
              unitPrice: 4200,
              discountAmount: 0,
              total: 588000,
              expectedDimensions: 'L 400 × B 450 × H 650 mm',
              materialPreference: '18mm engineered board with Hafele central lock mechanism'
            },
            {
              description: 'Executive Meeting Room Credenza Console with 4-Shutter Storage',
              quantity: 2,
              unitPrice: 36000,
              discountAmount: 0,
              total: 72000,
              expectedDimensions: 'L 1800 × B 450 × H 800 mm',
              materialPreference: 'Natural Teak veneer with PU clear matte finish'
            }
          ],
          grossTotal: 1990000,
          discountType: 'none',
          discountVal: 0,
          discountAmt: 0,
          discountedGross: 1990000,
          additionalCharges: [
            { title: 'On-site Rigging & Turnkey Installation', amount: 45000, taxable: true }
          ],
          extraCosts: 45000,
          gstRatePct: 18,
          gstAmount: 366300,
          grandTotal: 2401300
        },
        {
          versionNo: 2,
          versionCode: 'DF/Q/2026-27/0011-v1',
          status: 'Sent',
          items: [
            {
              description: '4-Seater Linear Benching Cluster with Aluminum Dual-Chamber Raceway',
              quantity: 35,
              unitPrice: 38000,
              discountAmount: 0,
              total: 1330000,
              expectedDimensions: 'L 2400 × B 1200 × H 750 mm',
              materialPreference: 'Action TESA Pre-lam MDF (Classic Walnut & Frosty White)'
            },
            {
              description: 'Under-desk 3-Drawer Lockable Mobile Pedestal Unit with Central Lock',
              quantity: 140,
              unitPrice: 4200,
              discountAmount: 0,
              total: 588000,
              expectedDimensions: 'L 400 × B 450 × H 650 mm',
              materialPreference: '18mm engineered board with Hafele central lock mechanism'
            },
            {
              description: 'Executive Meeting Room Credenza Console with 4-Shutter Storage',
              quantity: 2,
              unitPrice: 36000,
              discountAmount: 0,
              total: 72000,
              expectedDimensions: 'L 1800 × B 450 × H 800 mm',
              materialPreference: 'Natural Teak veneer with PU clear matte finish'
            }
          ],
          grossTotal: 1990000,
          discountType: 'percent',
          discountVal: 5,
          discountAmt: 99500,
          discountedGross: 1890500,
          additionalCharges: [
            { title: 'On-site Rigging & Turnkey Installation', amount: 45000, taxable: true },
            { title: 'Freight & Packaging Protection', amount: 15000, taxable: true }
          ],
          extraCosts: 60000,
          gstRatePct: 18,
          gstAmount: 351090,
          grandTotal: 2301590
        }
      ]
    },
    {
      code: 'DF/Q/2026-27/0012',
      enquiryCode: 'DF_ENQ_20261019_02',
      clientCode: 'DF/C/B2B/00012',
      status: 'Converted',
      salesperson: salesEmp2,
      versions: [
        {
          versionNo: 1,
          versionCode: 'DF/Q/2026-27/0012-v1',
          status: 'Converted',
          items: [
            {
              description: '2-Person Chemical-Resistant Pathology Laboratory Workstation',
              quantity: 18,
              unitPrice: 28000,
              discountAmount: 0,
              total: 504000,
              expectedDimensions: 'L 1200 × B 600 × H 750 mm'
            },
            {
              description: 'Modular Chemical Storage Overhead Unit with Frosted Toughened Glass',
              quantity: 24,
              unitPrice: 18500,
              discountAmount: 0,
              total: 444000,
              expectedDimensions: 'L 1200 × B 350 × H 600 mm'
            },
            {
              description: 'Mobile Reagent & Specimen Storage Cart with Castors',
              quantity: 12,
              unitPrice: 14500,
              discountAmount: 0,
              total: 174000,
              expectedDimensions: 'L 600 × B 500 × H 850 mm'
            }
          ],
          grossTotal: 1122000,
          discountType: 'flat',
          discountVal: 32000,
          discountAmt: 32000,
          discountedGross: 1090000,
          additionalCharges: [
            { title: 'Installation & Biological Sealant Application', amount: 35000, taxable: true }
          ],
          extraCosts: 35000,
          gstRatePct: 18,
          gstAmount: 202500,
          grandTotal: 1327500
        }
      ]
    },
    {
      code: 'DF/Q/2026-27/0013',
      enquiryCode: 'DF_ENQ_20261019_03',
      clientCode: 'DF/C/B2B/00013',
      status: 'Admin Approval Required',
      salesperson: salesEmp1,
      versions: [
        {
          versionNo: 1,
          versionCode: 'DF/Q/2026-27/0013-v1',
          status: 'Admin Approval Required',
          items: [
            {
              description: '120-Degree Collaborative Workstation Cluster (3-Seater Pod)',
              quantity: 20,
              unitPrice: 42000,
              discountAmount: 0,
              total: 840000,
              expectedDimensions: 'L 2100 × B 2100 × H 750 mm'
            },
            {
              description: 'Single-Person Acoustic Phone Booth / Pod with Ventilation & Power',
              quantity: 4,
              unitPrice: 110000,
              discountAmount: 0,
              total: 440000,
              expectedDimensions: 'L 1000 × B 1000 × H 2200 mm'
            },
            {
              description: '12-Seater Executive Conference Table with Dual Motorized Connectivity Box',
              quantity: 1,
              unitPrice: 165000,
              discountAmount: 0,
              total: 165000,
              expectedDimensions: 'L 3600 × B 1200 × H 750 mm'
            }
          ],
          grossTotal: 1445000,
          discountType: 'percent',
          discountVal: 12, // >10% discount triggers Admin Approval Required
          discountAmt: 173400,
          discountedGross: 1271600,
          additionalCharges: [
            { title: 'Acoustic Pod Rigging & Commissioning', amount: 28000, taxable: true }
          ],
          extraCosts: 28000,
          gstRatePct: 18,
          gstAmount: 233928,
          grandTotal: 1533528
        }
      ]
    },
    {
      code: 'DF/Q/2026-27/0014',
      enquiryCode: 'DF_ENQ_20261019_05',
      clientCode: 'DF/C/B2B/00015',
      status: 'Converted',
      salesperson: salesEmp2,
      versions: [
        {
          versionNo: 1,
          versionCode: 'DF/Q/2026-27/0014-v1',
          status: 'Converted',
          items: [
            {
              description: 'Managing Director Executive Desk Suite with Integrated Side Runner',
              quantity: 2,
              unitPrice: 85000,
              discountAmount: 0,
              total: 170000,
              expectedDimensions: 'L 2100 × B 900 × H 760 mm'
            },
            {
              description: 'Modular Privacy Cubicle Workstation with Fabric Tackable Pinboard',
              quantity: 24,
              unitPrice: 24000,
              discountAmount: 0,
              total: 576000,
              expectedDimensions: 'L 1200 × B 600 × H 1200 mm'
            },
            {
              description: 'Executive Full-Height Archive Storage Unit with Digital Lock',
              quantity: 4,
              unitPrice: 48000,
              discountAmount: 0,
              total: 192000,
              expectedDimensions: 'L 1800 × B 450 × H 2100 mm'
            }
          ],
          grossTotal: 938000,
          discountType: 'none',
          discountVal: 0,
          discountAmt: 0,
          discountedGross: 938000,
          additionalCharges: [
            { title: 'Turnkey Installation & Wire Harnessing', amount: 35000, taxable: true }
          ],
          extraCosts: 35000,
          gstRatePct: 18,
          gstAmount: 175140,
          grandTotal: 1148140
        }
      ]
    },
    {
      code: 'DF/Q/2026-27/0015',
      enquiryCode: 'DF_ENQ_20261019_06',
      clientCode: 'DF/C/B2B2C/00018',
      status: 'Approved',
      salesperson: salesEmp1,
      versions: [
        {
          versionNo: 1,
          versionCode: 'DF/Q/2026-27/0015-v1',
          status: 'Approved',
          items: [
            {
              description: '16-Seater Boardroom Table with Motorized Pop-Up Conduits & Concealed Spine',
              quantity: 1,
              unitPrice: 245000,
              discountAmount: 0,
              total: 245000,
              expectedDimensions: 'L 4800 × B 1400 × H 750 mm'
            },
            {
              description: 'Seamless Thermoformed Acrylic Solid Surface Curved Reception Console',
              quantity: 1,
              unitPrice: 195000,
              discountAmount: 0,
              total: 195000,
              expectedDimensions: 'L 3000 × B 1000 × H 1050 mm'
            },
            {
              description: 'Acoustic Fluted Wall Panelling System with Concealed Z-Clips',
              quantity: 1,
              unitPrice: 260000,
              discountAmount: 0,
              total: 260000,
              expectedDimensions: 'L 6000 × B 50 × H 2800 mm'
            }
          ],
          grossTotal: 700000,
          discountType: 'percent',
          discountVal: 5,
          discountAmt: 35000,
          discountedGross: 665000,
          additionalCharges: [
            { title: 'Solid Surface Thermoforming & Seamless Buffing', amount: 30000, taxable: true },
            { title: 'Installation & Scaffolding', amount: 20000, taxable: true }
          ],
          extraCosts: 50000,
          gstRatePct: 18,
          gstAmount: 128700,
          grandTotal: 843700
        }
      ]
    },
    {
      code: 'DF/Q/2026-27/0016',
      enquiryCode: 'DF_ENQ_20261019_07',
      clientCode: 'DF/C/B2B2C/00019',
      status: 'Converted',
      salesperson: salesEmp3,
      versions: [
        {
          versionNo: 1,
          versionCode: 'DF/Q/2026-27/0016-v1',
          status: 'Converted',
          items: [
            {
              description: '4-Seater Linear Benching Workstations with Acrylic Screens',
              quantity: 20,
              unitPrice: 36000,
              discountAmount: 0,
              total: 720000,
              expectedDimensions: 'L 2400 × B 1200 × H 750 mm'
            },
            {
              description: 'Manager Cabin L-Shaped Executive Desk with Credenza',
              quantity: 6,
              unitPrice: 42000,
              discountAmount: 0,
              total: 252000,
              expectedDimensions: 'L 1650 × B 1500 × H 750 mm'
            },
            {
              description: 'Cafeteria Heavy-Duty 4-Seater Fixed Pedestal Modular Dining Table',
              quantity: 15,
              unitPrice: 18000,
              discountAmount: 0,
              total: 270000,
              expectedDimensions: 'L 1200 × B 800 × H 750 mm'
            }
          ],
          grossTotal: 1242000,
          discountType: 'percent',
          discountVal: 8,
          discountAmt: 99360,
          discountedGross: 1142640,
          additionalCharges: [
            { title: 'GIDC Savli Site Delivery & Installation', amount: 48000, taxable: true }
          ],
          extraCosts: 48000,
          gstRatePct: 18,
          gstAmount: 214315,
          grandTotal: 1404955
        }
      ]
    },
    {
      code: 'DF/Q/2026-27/0017',
      enquiryCode: 'DF_ENQ_20261019_08',
      clientCode: 'DF/C/B2C/00022',
      status: 'Converted',
      salesperson: salesEmp1,
      versions: [
        {
          versionNo: 1,
          versionCode: 'DF/Q/2026-27/0017-v1',
          status: 'Converted',
          items: [
            {
              description: 'Grand Island Modular Kitchen Suite with German Acrylic Shutters & Blum Servo-Drive',
              quantity: 1,
              unitPrice: 580000,
              discountAmount: 0,
              total: 580000,
              expectedDimensions: 'L 3600 × B 2400 × H 850 mm'
            },
            {
              description: 'Floor-to-Ceiling 3-Track Tinted Glass Sliding Wardrobe with Sensor LED Strips',
              quantity: 1,
              unitPrice: 320000,
              discountAmount: 0,
              total: 320000,
              expectedDimensions: 'L 3000 × B 650 × H 2800 mm'
            }
          ],
          grossTotal: 900000,
          discountType: 'flat',
          discountVal: 40000,
          discountAmt: 40000,
          discountedGross: 860000,
          additionalCharges: [
            { title: 'Turnkey Residential Precision Assembly & Hardware Calibration', amount: 25000, taxable: true }
          ],
          extraCosts: 25000,
          gstRatePct: 18,
          gstAmount: 159300,
          grandTotal: 1044300
        }
      ]
    },
    {
      code: 'DF/Q/2026-27/0018',
      enquiryCode: 'DF_ENQ_20261019_09',
      clientCode: 'DF/C/B2C/00023',
      status: 'Verification Required',
      salesperson: salesEmp2,
      versions: [
        {
          versionNo: 1,
          versionCode: 'DF/Q/2026-27/0018-v1',
          status: 'Verification Required',
          items: [
            {
              description: '3-Door Sliding Modular Wardrobe with Soft-Close Top-Hung Sliders',
              quantity: 4,
              unitPrice: 165000,
              discountAmount: 0,
              total: 660000,
              expectedDimensions: 'L 2400 × B 600 × H 2600 mm'
            },
            {
              description: 'Floating Dressing Console with Backlit LED Mirror & Velvet Drawers',
              quantity: 2,
              unitPrice: 45000,
              discountAmount: 0,
              total: 90000,
              expectedDimensions: 'L 1200 × B 400 × H 750 mm'
            }
          ],
          grossTotal: 750000,
          discountType: 'none',
          discountVal: 0,
          discountAmt: 0,
          discountedGross: 750000,
          additionalCharges: [
            { title: 'Penthouse Freight & Installation', amount: 22000, taxable: true }
          ],
          extraCosts: 22000,
          gstRatePct: 18,
          gstAmount: 138960,
          grandTotal: 910960
        }
      ]
    },
    {
      code: null, // Draft has no official code until submit
      enquiryCode: 'DF_ENQ_20261019_11',
      clientCode: 'DF/C/B2B/00017',
      status: 'Draft',
      salesperson: salesEmp1,
      versions: [
        {
          versionNo: 1,
          versionCode: 'v1',
          status: 'Draft',
          items: [
            {
              description: 'Industrial Modular Benching Cluster with Powder-Coated Metal A-Frame',
              quantity: 12,
              unitPrice: 42000,
              discountAmount: 0,
              total: 504000,
              expectedDimensions: 'L 2400 × B 1200 × H 750 mm'
            },
            {
              description: 'Acoustic Sound-Dampening Fabric Free-Standing Dividers',
              quantity: 24,
              unitPrice: 11000,
              discountAmount: 0,
              total: 264000,
              expectedDimensions: 'L 1200 × B 40 × H 1600 mm'
            }
          ],
          grossTotal: 768000,
          discountType: 'none',
          discountVal: 0,
          discountAmt: 0,
          discountedGross: 768000,
          additionalCharges: [
            { title: 'Interstate Logistics & Mumbai Entry Tax', amount: 35000, taxable: true }
          ],
          extraCosts: 35000,
          gstRatePct: 18,
          gstAmount: 144540,
          grandTotal: 947540
        }
      ]
    }
  ];

  let quoteCounter = 100;

  for (const q of quoteDefs) {
    const client = createdClients[q.clientCode];
    const enquiry = createdEnquiries[q.enquiryCode];
    if (!client || !enquiry) continue;

    quoteCounter++;
    const quotationNumber = `DF_Q_2026_${quoteCounter}`;

    const existing = await prisma.quotation.findFirst({
      where: {
        OR: [
          { enquiryId: enquiry.id },
          ...(q.code ? [{ code: q.code }] : [])
        ]
      }
    });

    const latestVer = q.versions[q.versions.length - 1];

    if (existing) {
      // Clean old versions
      await prisma.quotationAdditionalCharge.deleteMany({ where: { version: { quotationId: existing.id } } }).catch(() => {});
      await prisma.quotationItem.deleteMany({ where: { quotationId: existing.id } }).catch(() => {});
      await prisma.quotationItem.deleteMany({ where: { version: { quotationId: existing.id } } }).catch(() => {});
      await prisma.quotationVersion.deleteMany({ where: { quotationId: existing.id } }).catch(() => {});

      await prisma.quotation.update({
        where: { id: existing.id },
        data: {
          code: q.code,
          enquiryCode: enquiry.enquiryNumber,
          salespersonId: q.salesperson.id,
          salespersonName: q.salesperson.name,
          currentVersionNo: latestVer.versionNo,
          status: q.status,
          totalAmount: latestVer.grandTotal,
          versions: {
            create: q.versions.map(v => ({
              versionNo: v.versionNo,
              versionCode: v.versionCode,
              status: v.status,
              grossTotal: v.grossTotal,
              overallDiscountType: v.discountType,
              overallDiscountVal: v.discountVal,
              overallDiscountAmt: v.discountAmt,
              discountedGross: v.discountedGross,
              extraCostsTotal: v.extraCosts,
              gstApplicable: true,
              gstRatePct: v.gstRatePct,
              gstAmount: v.gstAmount,
              grandTotal: v.grandTotal,
              supersededAt: (v as any).supersededAt || null,
              submittedAt: v.status !== 'Draft' ? new Date(Date.now() - 3 * 86400000) : null,
              items: {
                create: v.items.map(it => ({
                  lineId: crypto.randomUUID(),
                  description: it.description,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  discountAmount: it.discountAmount,
                  total: it.total,
                  expectedDimensions: it.expectedDimensions || null,
                  materialPreference: (it as any).materialPreference || null
                }))
              },
              additionalCharges: {
                create: v.additionalCharges.map(ac => ({
                  title: ac.title,
                  amount: ac.amount,
                  taxable: ac.taxable
                }))
              }
            }))
          }
        }
      });
    } else {
      await prisma.quotation.create({
        data: {
          code: q.code,
          quotationNumber,
          clientId: client.id,
          enquiryId: enquiry.id,
          enquiryCode: enquiry.enquiryNumber,
          salespersonId: q.salesperson.id,
          salespersonName: q.salesperson.name,
          currentVersionNo: latestVer.versionNo,
          status: q.status,
          totalAmount: latestVer.grandTotal,
          versions: {
            create: q.versions.map(v => ({
              versionNo: v.versionNo,
              versionCode: v.versionCode,
              status: v.status,
              grossTotal: v.grossTotal,
              overallDiscountType: v.discountType,
              overallDiscountVal: v.discountVal,
              overallDiscountAmt: v.discountAmt,
              discountedGross: v.discountedGross,
              extraCostsTotal: v.extraCosts,
              gstApplicable: true,
              gstRatePct: v.gstRatePct,
              gstAmount: v.gstAmount,
              grandTotal: v.grandTotal,
              supersededAt: (v as any).supersededAt || null,
              submittedAt: v.status !== 'Draft' ? new Date(Date.now() - 3 * 86400000) : null,
              items: {
                create: v.items.map(it => ({
                  lineId: crypto.randomUUID(),
                  description: it.description,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  discountAmount: it.discountAmount,
                  total: it.total,
                  expectedDimensions: it.expectedDimensions || null,
                  materialPreference: (it as any).materialPreference || null
                }))
              },
              additionalCharges: {
                create: v.additionalCharges.map(ac => ({
                  title: ac.title,
                  amount: ac.amount,
                  taxable: ac.taxable
                }))
              }
            }))
          }
        }
      });
    }
  }

  console.log(`✅ Seeded ${quoteDefs.length} authentic multi-versioned quotations.`);
  console.log('🎉 Sensible data simulation complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error during data simulation:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
