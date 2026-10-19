import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Category default dimensional fallbacks (in mm)
const DIMENSION_BENCHMARKS: Record<string, { l: number; w: number; h: number }> = {
  'office-chairs': { l: 650, w: 650, h: 1150 },
  'chairs': { l: 550, w: 550, h: 850 },
  'outdoor-chairs': { l: 580, w: 600, h: 820 },
  'lounge-chair': { l: 800, w: 850, h: 900 },
  'lounge-chairs': { l: 800, w: 850, h: 900 },
  'leisure-chair': { l: 780, w: 820, h: 880 },
  'armchair': { l: 750, w: 780, h: 840 },
  'auditorium-chair': { l: 600, w: 650, h: 950 },
  'sofas': { l: 2100, w: 850, h: 800 },
  'outdoor-sofa': { l: 2000, w: 850, h: 780 },
  'sofa-set': { l: 2200, w: 900, h: 820 },
  'lounger-sofa': { l: 2100, w: 900, h: 800 },
  'waiting-area-sofa': { l: 1800, w: 750, h: 750 },
  'outdoor-swing': { l: 1500, w: 1200, h: 1900 },
  'outdoor-lounger': { l: 1950, w: 700, h: 350 },
  'cane-furniture': { l: 1200, w: 700, h: 750 },
  'bed-bases': { l: 1980, w: 1830, h: 350 },
  'headboards': { l: 1980, w: 100, h: 1200 },
  'night-stands': { l: 450, w: 400, h: 500 },
  'luggage-racks': { l: 700, w: 450, h: 550 },
  'media-panels': { l: 1500, w: 80, h: 1200 },
  'micro-combo-fridge-units': { l: 1100, w: 600, h: 900 },
  'vanity-units': { l: 900, w: 550, h: 850 },
  'closet-with-micro-combo': { l: 1200, w: 600, h: 2100 },
  'wardrobes': { l: 1800, w: 600, h: 2100 },
  'coffee-tables': { l: 1050, w: 600, h: 450 },
  'outdoor-table': { l: 1200, w: 800, h: 750 },
  'shoe-rack': { l: 900, w: 350, h: 1100 },
  'lockers': { l: 900, w: 450, h: 1800 },
  'changing-room-lockers': { l: 900, w: 450, h: 1800 },
  'mobile-compactors': { l: 2700, w: 915, h: 2180 },
  'pedestal-units': { l: 400, w: 500, h: 650 },
  'executive-desks': { l: 1800, w: 900, h: 750 },
  'staff-desk': { l: 1200, w: 600, h: 750 },
  'desks': { l: 1200, w: 600, h: 750 },
  'student-desks': { l: 600, w: 450, h: 750 },
  'teachers-desk': { l: 1350, w: 750, h: 750 },
  'office-desks': { l: 1200, w: 600, h: 750 },
  'storage-units': { l: 900, w: 450, h: 1200 },
  'storage-cabinets': { l: 900, w: 450, h: 1800 },
  'workstations': { l: 2400, w: 1200, h: 1150 },
  'magazine-rack': { l: 600, w: 400, h: 1500 },
  'library-book-racks': { l: 1800, w: 450, h: 2100 },
  'podium': { l: 600, w: 500, h: 1200 },
  'wall-guards': { l: 2400, w: 50, h: 150 },
  'hanger-units': { l: 900, w: 450, h: 1800 },
  'kitchen-overhead-units': { l: 900, w: 350, h: 600 },
};

// Pricing benchmarks by category (in INR)
const PRICE_BENCHMARKS: Record<string, number> = {
  'office-chairs': 8500,
  'chairs': 3500,
  'outdoor-chairs': 4500,
  'lounge-chair': 14500,
  'lounge-chairs': 14500,
  'leisure-chair': 16500,
  'armchair': 12000,
  'auditorium-chair': 6500,
  'sofas': 38000,
  'outdoor-sofa': 42000,
  'sofa-set': 45000,
  'lounger-sofa': 48000,
  'waiting-area-sofa': 28000,
  'outdoor-swing': 22500,
  'outdoor-lounger': 18500,
  'cane-furniture': 24000,
  'bed-bases': 19500,
  'headboards': 12500,
  'night-stands': 6500,
  'luggage-racks': 5500,
  'media-panels': 14500,
  'micro-combo-fridge-units': 18500,
  'vanity-units': 16500,
  'closet-with-micro-combo': 32000,
  'wardrobes': 42000,
  'coffee-tables': 8500,
  'outdoor-table': 16000,
  'shoe-rack': 9500,
  'lockers': 22000,
  'changing-room-lockers': 24000,
  'mobile-compactors': 125000,
  'pedestal-units': 6200,
  'executive-desks': 34000,
  'staff-desk': 11500,
  'desks': 12500,
  'student-desks': 4800,
  'teachers-desk': 14500,
  'office-desks': 11500,
  'storage-units': 16500,
  'storage-cabinets': 19500,
  'workstations': 48000,
  'magazine-rack': 7500,
  'library-book-racks': 24500,
  'podium': 18500,
  'wall-guards': 4200,
  'hanger-units': 8500,
  'kitchen-overhead-units': 11500,
};

async function main() {
  console.log('================================================================');
  console.log('STARTING D\'FURN SCRAPED CATALOG INGESTION');
  console.log('================================================================');

  // Load scraped files
  const catalogPath = path.join(process.cwd(), 'scripts', 'dfurn-full-detailed-catalog.json');
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Catalog file not found at ${catalogPath}`);
  }
  const detailedCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const productsList: any[] = detailedCatalog.products;
  console.log(`Loaded ${productsList.length} unique products from detailed catalog.`);

  // Load production departments
  const depts = await prisma.department.findMany();
  const deptMapByName = new Map(depts.map(d => [d.name.toLowerCase(), d.id]));
  const defaultDeptIds = depts.map(d => d.id);

  // -------------------------------------------------------------
  // STEP 1: UPSERT SEGMENTS (Matching Attached UI Screenshot)
  // -------------------------------------------------------------
  console.log('\n--- Step 1: Upserting Segments ---');
  const segmentDefinitions = [
    { name: 'Hospitality', code: 'HOSP' },
    { name: 'Commercial', code: 'COMM' },
    { name: 'Residential & Outdoor', code: 'RESI' },
  ];

  const segmentMap = new Map<string, any>();
  for (const sDef of segmentDefinitions) {
    const seg = await prisma.segment.upsert({
      where: { code: sDef.code },
      update: { name: sDef.name },
      create: { name: sDef.name, code: sDef.code },
    });
    segmentMap.set(sDef.code, seg);
    segmentMap.set(sDef.name.toLowerCase(), seg);
    console.log(`  ✓ Segment: ${seg.name} [${seg.code}] (${seg.id})`);
  }

  // Also clean up old sample segments if empty
  const allCurrentSegs = await prisma.segment.findMany({ include: { categories: true } });
  for (const oldSeg of allCurrentSegs) {
    if (!['HOSP', 'COMM', 'RESI'].includes(oldSeg.code) && oldSeg.categories.length === 0) {
      await prisma.segment.delete({ where: { id: oldSeg.id } });
      console.log(`  Cleaned up old unused segment: ${oldSeg.name}`);
    }
  }

  // -------------------------------------------------------------
  // STEP 2: UPSERT MASTER CATEGORIES
  // -------------------------------------------------------------
  console.log('\n--- Step 2: Upserting Master Categories ---');
  const categoryDefinitions = [
    // Hospitality
    { name: 'Hospitality', code: 'HOSP-FURN', segmentCode: 'HOSP' },
    // Commercial
    { name: 'Workspaces', code: 'COMM-WKSP', segmentCode: 'COMM' },
    { name: 'Educational Spaces', code: 'COMM-EDUC', segmentCode: 'COMM' },
    { name: 'Hostels & PG', code: 'COMM-HOST', segmentCode: 'COMM' },
    { name: 'Hospitals', code: 'COMM-HOSP', segmentCode: 'COMM' },
    { name: 'Laboratory Furniture', code: 'COMM-LABF', segmentCode: 'COMM' },
    // Residential & Outdoor
    { name: 'Residential & Outdoors', code: 'RESI-OUTD', segmentCode: 'RESI' },
  ];

  const categoryMap = new Map<string, any>();
  for (const cDef of categoryDefinitions) {
    const seg = segmentMap.get(cDef.segmentCode);
    const cat = await prisma.category.upsert({
      where: { name: cDef.name },
      update: { code: cDef.code, segmentId: seg?.id },
      create: { name: cDef.name, code: cDef.code, segmentId: seg?.id },
    });
    categoryMap.set(cDef.name.toLowerCase(), cat);
    categoryMap.set(cDef.code, cat);
    console.log(`  ✓ Category: ${cat.name} [${cat.code}] (Segment: ${seg?.name})`);
  }

  // -------------------------------------------------------------
  // STEP 3: UPSERT ALL 47 SUB-CATEGORIES
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Upserting Sub-Categories ---');
  const subCategoryDefs = [
    // Under Hospitality
    { catCode: 'HOSP-FURN', name: 'Bed Bases', code: 'HOSP-BDB', slug: 'bed-bases' },
    { catCode: 'HOSP-FURN', name: 'Desk', code: 'HOSP-DSK', slug: 'desks' },
    { catCode: 'HOSP-FURN', name: 'Headboards', code: 'HOSP-HBD', slug: 'headboards' },
    { catCode: 'HOSP-FURN', name: 'Hanger Units', code: 'HOSP-HNG', slug: 'hanger-units' },
    { catCode: 'HOSP-FURN', name: 'Kitchen Overhead Units', code: 'HOSP-KOH', slug: 'kitchen-overhead-units' },
    { catCode: 'HOSP-FURN', name: 'Luggage Racks', code: 'HOSP-LUG', slug: 'luggage-racks' },
    { catCode: 'HOSP-FURN', name: 'Media Panels', code: 'HOSP-MED', slug: 'media-panels' },
    { catCode: 'HOSP-FURN', name: 'Micro-combo Fridge Units', code: 'HOSP-MCF', slug: 'micro-combo-fridge-units' },
    { catCode: 'HOSP-FURN', name: 'Night Stands', code: 'HOSP-NST', slug: 'night-stands' },
    { catCode: 'HOSP-FURN', name: 'Vanity Units', code: 'HOSP-VAN', slug: 'vanity-units' },
    { catCode: 'HOSP-FURN', name: 'Wall Guards', code: 'HOSP-WGD', slug: 'wall-guards' },
    { catCode: 'HOSP-FURN', name: 'Closet With Micro Combo', code: 'HOSP-CMC', slug: 'closet-with-micro-combo' },
    { catCode: 'HOSP-FURN', name: 'Sofa Set', code: 'HOSP-SOF', slug: 'sofa-set' },
    { catCode: 'HOSP-FURN', name: 'Leisure Chair', code: 'HOSP-LCH', slug: 'leisure-chair' },

    // Under Workspaces
    { catCode: 'COMM-WKSP', name: 'Office Chairs', code: 'WKSP-OCH', slug: 'office-chairs' },
    { catCode: 'COMM-WKSP', name: 'Lockers', code: 'WKSP-LCK', slug: 'lockers' },
    { catCode: 'COMM-WKSP', name: 'Mobile Compactors', code: 'WKSP-CMP', slug: 'mobile-compactors' },
    { catCode: 'COMM-WKSP', name: 'Pedestal Units', code: 'WKSP-PED', slug: 'pedestal-units' },
    { catCode: 'COMM-WKSP', name: 'Executive Desks', code: 'WKSP-EXD', slug: 'executive-desks' },
    { catCode: 'COMM-WKSP', name: 'Storage Units', code: 'WKSP-STR', slug: 'storage-units' },
    { catCode: 'COMM-WKSP', name: 'Workstations', code: 'WKSP-WKS', slug: 'workstations' },
    { catCode: 'COMM-WKSP', name: 'Staff Desks', code: 'WKSP-STF', slug: 'staff-desk' },
    { catCode: 'COMM-WKSP', name: 'Magazine Rack', code: 'WKSP-MAG', slug: 'magazine-rack' },
    { catCode: 'COMM-WKSP', name: 'Lounger Sofa', code: 'WKSP-LSO', slug: 'lounger-sofa' },
    { catCode: 'COMM-WKSP', name: 'Lounge Chairs', code: 'WKSP-LCH', slug: 'lounge-chairs' },

    // Under Educational Spaces
    { catCode: 'COMM-EDUC', name: 'Student Desks', code: 'EDUC-STU', slug: 'student-desks' },
    { catCode: 'COMM-EDUC', name: 'Teacher\'s Desk', code: 'EDUC-TCH', slug: 'teachers-desk' },
    { catCode: 'COMM-EDUC', name: 'Storage Cabinets', code: 'EDUC-STR', slug: 'storage-cabinets' },
    { catCode: 'COMM-EDUC', name: 'Chairs', code: 'EDUC-CHR', slug: 'chairs' },
    { catCode: 'COMM-EDUC', name: 'Changing Room Lockers', code: 'EDUC-LCK', slug: 'changing-room-lockers' },
    { catCode: 'COMM-EDUC', name: 'Auditorium Chair', code: 'EDUC-AUD', slug: 'auditorium-chair' },
    { catCode: 'COMM-EDUC', name: 'Library Book Racks', code: 'EDUC-LIB', slug: 'library-book-racks' },
    { catCode: 'COMM-EDUC', name: 'Office Desks', code: 'EDUC-OFD', slug: 'office-desks' },
    { catCode: 'COMM-EDUC', name: 'Waiting Area Sofa', code: 'EDUC-SOF', slug: 'waiting-area-sofa' },
    { catCode: 'COMM-EDUC', name: 'Podium', code: 'EDUC-POD', slug: 'podium' },
    { catCode: 'COMM-EDUC', name: 'Armchair', code: 'EDUC-ARM', slug: 'armchair' },

    // Under Residential & Outdoors
    { catCode: 'RESI-OUTD', name: 'Outdoor Chairs', code: 'RESI-OCH', slug: 'outdoor-chairs' },
    { catCode: 'RESI-OUTD', name: 'Sofas', code: 'RESI-SOF', slug: 'sofas' },
    { catCode: 'RESI-OUTD', name: 'Outdoor Sofa', code: 'RESI-OSO', slug: 'outdoor-sofa' },
    { catCode: 'RESI-OUTD', name: 'Outdoor Swing', code: 'RESI-OSW', slug: 'outdoor-swing' },
    { catCode: 'RESI-OUTD', name: 'Outdoor Table', code: 'RESI-OTB', slug: 'outdoor-table' },
    { catCode: 'RESI-OUTD', name: 'Outdoor Lounger', code: 'RESI-OLO', slug: 'outdoor-lounger' },
    { catCode: 'RESI-OUTD', name: 'Cane Furniture', code: 'RESI-CNE', slug: 'cane-furniture' },
    { catCode: 'RESI-OUTD', name: 'Wardrobes', code: 'RESI-WDR', slug: 'wardrobes' },
    { catCode: 'RESI-OUTD', name: 'Coffee Tables', code: 'RESI-CFT', slug: 'coffee-tables' },
    { catCode: 'RESI-OUTD', name: 'Shoe Rack', code: 'RESI-SHR', slug: 'shoe-rack' },
    { catCode: 'RESI-OUTD', name: 'Lounge Chair', code: 'RESI-LCH', slug: 'lounge-chair' },
  ];

  const subCategoryMapBySlug = new Map<string, any>();
  const subCategoryMapByCode = new Map<string, any>();

  for (const sDef of subCategoryDefs) {
    const cat = categoryMap.get(sDef.catCode);
    if (!cat) continue;

    const sub = await prisma.subCategory.upsert({
      where: {
        categoryId_code: {
          categoryId: cat.id,
          code: sDef.code,
        },
      },
      update: { name: sDef.name },
      create: {
        name: sDef.name,
        code: sDef.code,
        categoryId: cat.id,
      },
    });

    const key = `${cat.code}:${sDef.slug}`;
    subCategoryMapBySlug.set(key, { ...sub, categoryId: cat.id });
    subCategoryMapBySlug.set(sDef.slug, { ...sub, categoryId: cat.id });
    subCategoryMapByCode.set(sDef.code, { ...sub, categoryId: cat.id });
  }
  console.log(`  ✓ All ${subCategoryDefs.length} sub-categories verified and linked.`);

  // -------------------------------------------------------------
  // STEP 4: UPSERT STANDARD CATALOGUES & SHADES
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Upserting Standard Catalogues for Shades ---');
  const powderCatalogue = await prisma.standardCatalogue.upsert({
    where: { name: 'Powder Coating Shades' },
    update: {},
    create: {
      name: 'Powder Coating Shades',
      description: 'Factory standard RAL and architectural powder coating finishes',
      facets: [{ key: 'finish', name: 'Finish', values: ['Matt', 'Glossy', 'Satin', 'Texture'] }],
    },
  });

  const fabricCatalogue = await prisma.standardCatalogue.upsert({
    where: { name: 'Fabric / Leatherette Swatches' },
    update: {},
    create: {
      name: 'Fabric / Leatherette Swatches',
      description: 'Upholstery fabrics, premium leatherette, and high-traffic mesh options',
      facets: [{ key: 'material', name: 'Material', values: ['Fabric', 'Leatherette', 'Mesh'] }],
    },
  });

  // Extract all shades from scraped attributes and populate catalogue entries
  const shadeValuesFound = new Map<string, { name: string; url: string; catalogueId: string }>();
  for (const prod of productsList) {
    for (const attr of (prod.attributes || [])) {
      const isPowder = attr.name?.toLowerCase().includes('powder coating');
      const isFabric = attr.name?.toLowerCase().includes('fabric') || attr.name?.toLowerCase().includes('leatherette');
      if (isPowder || isFabric) {
        const catId = isPowder ? powderCatalogue.id : fabricCatalogue.id;
        for (const v of (attr.values || [])) {
          if (v.text && !shadeValuesFound.has(v.text)) {
            shadeValuesFound.set(v.text, {
              name: v.text,
              url: v.swatchUrl || '',
              catalogueId: catId,
            });
          }
        }
      }
    }
  }

  console.log(`  Discovered ${shadeValuesFound.size} unique color & fabric swatches.`);
  for (const [name, shade] of shadeValuesFound.entries()) {
    const existing = await prisma.catalogueEntry.findFirst({
      where: { catalogueId: shade.catalogueId, name: shade.name },
    });
    if (!existing) {
      await prisma.catalogueEntry.create({
        data: {
          catalogueId: shade.catalogueId,
          name: shade.name,
          imageUrl: shade.url || null,
          attributes: { shadeName: shade.name },
          materialIds: [],
        },
      });
    }
  }

  // -------------------------------------------------------------
  // STEP 5: UPSERT 282 MASTER PRODUCTS & VARIANTS
  // -------------------------------------------------------------
  console.log('\n--- Step 5: Upserting 282 Master Products & Variants ---');
  let insertedCount = 0;
  const subCatCounter = new Map<string, number>();

  for (const prod of productsList) {
    const primCat = prod.primaryCategory;
    const catSlug = primCat.categorySlug;
    
    // Find matching sub-category
    let subCat = subCategoryMapBySlug.get(catSlug);
    if (!subCat) {
      // Fallback: match by name
      for (const [_, sc] of subCategoryMapBySlug.entries()) {
        if (sc.name.toLowerCase() === primCat.categoryName.toLowerCase()) {
          subCat = sc;
          break;
        }
      }
    }

    if (!subCat) {
      console.warn(`  [!] Could not map subcategory for product "${prod.productName}" (slug: ${catSlug})`);
      continue;
    }

    // Generate sequential code: e.g. WKSP-OCH-0001
    const count = (subCatCounter.get(subCat.code) || 0) + 1;
    subCatCounter.set(subCat.code, count);
    const productCode = `${subCat.code}-${String(count).padStart(4, '0')}`;

    // Dimensions calculation
    const bench = DIMENSION_BENCHMARKS[catSlug] || { l: 1000, w: 600, h: 750 };
    const nakedDimensions = {
      l: bench.l,
      w: bench.w,
      h: bench.h,
    };
    const boxDimensions = {
      l: bench.l + 50,
      w: bench.w + 50,
      h: bench.h + 50,
    };

    // Images payload
    const imagesPayload = (prod.images || []).map((img: any, idx: number) => ({
      slot: `Photo ${idx + 1}`,
      url: img.url,
      name: img.name || `Photo ${idx + 1}`,
      isPrimary: img.isPrimary ?? idx === 0,
    }));
    const primaryThumb = prod.primaryImageUrl || (imagesPayload[0]?.url) || null;

    // Attributes / Specifications payload
    const specEntries = (prod.attributes || []).map((attr: any) => ({
      key: attr.name,
      kind: 'fixed',
      value: (attr.values || []).map((v: any) => v.text).filter(Boolean).join(', '),
      values: (attr.values || []).map((v: any) => ({ name: v.text, swatchUrl: v.swatchUrl })),
    }));

    // B2B Pricing
    const baseSellingRate = PRICE_BENCHMARKS[catSlug] || 15000;

    // Production departments
    const isMetal = ['office-chairs', 'chairs', 'outdoor-chairs', 'lockers', 'mobile-compactors', 'outdoor-swing'].includes(catSlug);
    const assignedDeptIds = isMetal
      ? [
          deptMapByName.get('metal fabrication') || defaultDeptIds[4],
          deptMapByName.get('finishing & polish') || defaultDeptIds[2],
          deptMapByName.get('assembly') || defaultDeptIds[3],
        ].filter(Boolean)
      : [
          deptMapByName.get('carpentry') || defaultDeptIds[0],
          deptMapByName.get('edge banding') || defaultDeptIds[1],
          deptMapByName.get('finishing & polish') || defaultDeptIds[2],
          deptMapByName.get('assembly') || defaultDeptIds[3],
        ].filter(Boolean);

    // Initial Process Chart
    const processChart: Record<string, string[]> = {};
    assignedDeptIds.forEach((dId: string) => {
      processChart[dId] = ['Initial Machining & Cutting', 'Standard Inspection'];
    });

    // Initial BOM structure
    const bomPayload = {
      configured: true,
      sections: [
        {
          name: 'Core Structure',
          items: [
            { name: isMetal ? 'CRCA Steel Tubing / Sheet' : '18mm Prelam MDF / Particle Board', qty: 1, uom: 'NOS' },
          ],
        },
        {
          name: 'Hardware & Fittings',
          items: [
            { name: isMetal ? 'Fasteners & High Tensile Screws' : 'Minifix & Dowels', qty: 1, uom: 'SET' },
          ],
        },
      ],
    };

    // Packing list
    const packingPayload = {
      configured: true,
      boxes: [
        {
          boxNo: 1,
          name: `${prod.productName} Main Box`,
          dimensions: boxDimensions,
          cbm: Number(((boxDimensions.l * boxDimensions.w * boxDimensions.h) / 1e9).toFixed(3)),
          weightKg: 18.5,
        },
      ],
    };

    // Upsert Master Product
    const master = await prisma.masterProduct.upsert({
      where: { code: productCode },
      update: {
        name: prod.productName,
        categoryId: subCat.categoryId,
        subCategoryId: subCat.id,
        departmentIds: assignedDeptIds,
        specifications: specEntries,
        nakedDimensions,
        boxDimensions,
        defaultDeliveryMode: 'Pre-assembled',
        defaultCreationMode: 'In-house',
        unitOfMeasurement: 'NOS',
        baseSellingRate,
        grossMarginTargetPct: 30.0,
        leadTimeDays: 7,
        moq: 1,
        images: imagesPayload,
        thumbnail: primaryThumb,
        processChart,
        bom: bomPayload,
        packingList: packingPayload,
      },
      create: {
        code: productCode,
        name: prod.productName,
        categoryId: subCat.categoryId,
        subCategoryId: subCat.id,
        departmentIds: assignedDeptIds,
        specifications: specEntries,
        nakedDimensions,
        boxDimensions,
        defaultDeliveryMode: 'Pre-assembled',
        defaultCreationMode: 'In-house',
        unitOfMeasurement: 'NOS',
        baseSellingRate,
        grossMarginTargetPct: 30.0,
        leadTimeDays: 7,
        moq: 1,
        images: imagesPayload,
        thumbnail: primaryThumb,
        processChart,
        bom: bomPayload,
        packingList: packingPayload,
      },
    });

    // Upsert Default Variant
    const variantCode = `${productCode}-01`;
    await prisma.variant.upsert({
      where: { code: variantCode },
      update: {
        name: `${prod.productName} Standard`,
        masterProductId: master.id,
        departmentIds: assignedDeptIds,
        specifications: specEntries,
        nakedDimensions,
        boxDimensions,
        defaultDeliveryMode: 'Pre-assembled',
        defaultCreationMode: 'In-house',
        unitOfMeasurement: 'NOS',
        baseSellingRate,
        leadTimeDays: 7,
        moq: 1,
        images: imagesPayload,
        thumbnail: primaryThumb,
        processChart,
        bom: bomPayload,
        packingList: packingPayload,
      },
      create: {
        code: variantCode,
        name: `${prod.productName} Standard`,
        masterProductId: master.id,
        departmentIds: assignedDeptIds,
        specifications: specEntries,
        nakedDimensions,
        boxDimensions,
        defaultDeliveryMode: 'Pre-assembled',
        defaultCreationMode: 'In-house',
        unitOfMeasurement: 'NOS',
        baseSellingRate,
        leadTimeDays: 7,
        moq: 1,
        images: imagesPayload,
        thumbnail: primaryThumb,
        processChart,
        bom: bomPayload,
        packingList: packingPayload,
      },
    });

    insertedCount++;
    if (insertedCount % 50 === 0 || insertedCount === productsList.length) {
      console.log(`  Ingested ${insertedCount} / ${productsList.length} products...`);
    }
  }

  console.log('\n================================================================');
  console.log(`INGESTION COMPLETED SUCCESSFULLY: ${insertedCount} MASTER PRODUCTS INGESTED`);
  console.log('================================================================');
}

main()
  .catch((e) => {
    console.error('Ingestion failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
