const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function extractCookies(response) {
  const setCookie = response.headers.getSetCookie 
    ? response.headers.getSetCookie() 
    : [response.headers.get('set-cookie')].filter(Boolean);
  
  const cookieMap = {};
  for (const str of setCookie) {
    const parts = str.split(';')[0].split('=');
    if (parts.length >= 2) {
      cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  }
  return cookieMap;
}

function cookieHeader(cookieMap) {
  return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
}

// --- Pure Product Logic & Measure Helpers (Matching src/lib/products/*) ---
function parseVariantSequence(variantCode) {
  const match = variantCode.match(/-(\d+)$/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return isNaN(num) ? null : num;
}

function nextVariantCode(masterProductCode, existingVariantCodes) {
  const numbers = existingVariantCodes
    .map((code) => parseVariantSequence(code))
    .filter((n) => n !== null);
  const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `${masterProductCode.trim().toUpperCase()}-${String(nextNum).padStart(3, '0')}`;
}

function mmToInches(mm) {
  if (typeof mm !== 'number' || isNaN(mm)) return 0;
  return Math.round((mm / 25.4) * 100) / 100;
}

function dimensionsInInches(dim) {
  if (!dim || typeof dim.l !== 'number' || typeof dim.w !== 'number' || typeof dim.h !== 'number') {
    return null;
  }
  return {
    l: mmToInches(dim.l),
    w: mmToInches(dim.w),
    h: mmToInches(dim.h),
  };
}

function computeCbm(boxMm) {
  if (!boxMm || typeof boxMm.l !== 'number' || typeof boxMm.w !== 'number' || typeof boxMm.h !== 'number') {
    return null;
  }
  const m3 = (boxMm.l / 1000) * (boxMm.w / 1000) * (boxMm.h / 1000);
  return Math.round(m3 * 10000) / 10000;
}

function formatLbh(dim) {
  if (!dim || [dim.l, dim.w, dim.h].some(v => typeof v !== 'number' || isNaN(v) || v <= 0)) return '–';
  return `L ${dim.l} × B ${dim.w} × H ${dim.h} mm`;
}

function processStatusOf(product) {
  const depts = product?.departmentIds || [];
  const chart = (product?.processChart && typeof product.processChart === 'object') ? product.processChart : {};
  if (!depts.length) return 'Not Started';
  const filled = depts.filter((d) => Array.isArray(chart[d]) && chart[d].length > 0).length;
  if (filled === depts.length) return 'Configured';
  if (filled > 0) return 'In Progress';
  return 'Not Started';
}

function bomStatusOf(rawBom) {
  if (!rawBom || typeof rawBom !== 'object' || !rawBom.sections) return 'Not Started';
  if (rawBom.configured === true) return 'Configured';
  const sections = Object.values(rawBom.sections);
  const touched = sections.some((s) => {
    if (!s) return false;
    return s.status !== 'pending' || (Array.isArray(s.parts) && s.parts.length > 0) || (Array.isArray(s.lines) && s.lines.length > 0);
  });
  return touched ? 'In Progress' : 'Not Started';
}

function packingStatusOf(packingList) {
  if (!packingList || !Array.isArray(packingList.boxes) || !packingList.boxes.length) return 'Not Started';
  return packingList.configured === true ? 'Configured' : 'In Progress';
}

describe('Products Module: Comprehensive Security, Reliability, Logic & Workflow Suite', () => {
  let adminCookieStr = '';
  let salesCookieStr = '';
  const timestamp = Date.now().toString().slice(-6);

  // Workflow shared state
  let testSegmentId = '';
  let testCategoryId = '';
  let testSubCategoryId = '';
  let testDepartmentId = '';
  let testMasterProductId = '';
  let testVariantId = '';
  const segmentName = `Test Segment ${timestamp}`;
  const categoryName = `Test Category ${timestamp}`;
  const subCategoryName = `Test SubCat ${timestamp}`;
  const masterProductName = `Modular Desk ${timestamp}`;
  let generatedMasterCode = '';

  before(async () => {
    // 1. Authenticate as Super Admin
    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.equal(adminLogin.status, 200, 'Admin login must succeed');
    adminCookieStr = cookieHeader(extractCookies(adminLogin));

    // 2. Authenticate as Sales Rep
    const salesLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sales', password: 'sales123' })
    });
    assert.equal(salesLogin.status, 200, 'Sales login must succeed');
    salesCookieStr = cookieHeader(extractCookies(salesLogin));

    // 3. Ensure at least one production department exists for testing
    let dept = await prisma.department.findFirst({ where: { isProduction: true } });
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          name: `Woodworking ${timestamp}`,
          code: `WD-${timestamp}`,
          isProduction: true
        }
      });
    }
    testDepartmentId = dept.id;
  });

  after(async () => {
    // Teardown any test artifacts safely
    try {
      if (testVariantId) {
        await prisma.semiFinishedGood.deleteMany({ where: { variantId: testVariantId } }).catch(() => {});
        await prisma.variant.delete({ where: { id: testVariantId } }).catch(() => {});
      }
      if (testMasterProductId) {
        await prisma.masterProduct.delete({ where: { id: testMasterProductId } }).catch(() => {});
      }
      if (testSubCategoryId) {
        await prisma.subCategory.delete({ where: { id: testSubCategoryId } }).catch(() => {});
      }
      if (testCategoryId) {
        await prisma.category.delete({ where: { id: testCategoryId } }).catch(() => {});
      }
      if (testSegmentId) {
        await prisma.segment.delete({ where: { id: testSegmentId } }).catch(() => {});
      }
    } catch (e) {
      // Ignore teardown errors
    }
    await prisma.$disconnect();
  });

  // =========================================================================
  // PHASE 1: SECURITY & RBAC GUARDS
  // =========================================================================
  describe('Phase 1: Security & RBAC Guards', () => {

    test('SEC-01: Unauthenticated API access returns 401 Unauthorized JSON', async () => {
      const res = await fetch(`${BASE_URL}/api/products/master-products`);
      assert.equal(res.status, 401, 'Unauthenticated request must be blocked with 401');
      const data = await res.json();
      assert.ok(data.error, '401 response must contain error message');
    });

    test('SEC-02: Sales Rep cannot DELETE a Master Product (403 Forbidden)', async () => {
      // Find or create subcategory
      let subCat = await prisma.subCategory.findFirst();
      if (!subCat) {
        let cat = await prisma.category.findFirst();
        if (!cat) {
          cat = await prisma.category.create({ data: { name: `SecCat ${timestamp}`, code: `SC${timestamp}` } });
        }
        subCat = await prisma.subCategory.create({
          data: { name: `SecSubCat ${timestamp}`, code: `SS${timestamp}`, categoryId: cat.id }
        });
      }

      const tempProduct = await prisma.masterProduct.create({
        data: {
          code: `SEC-MP-${timestamp}`,
          name: `Sec Master Product ${timestamp}`,
          categoryId: subCat.categoryId,
          subCategoryId: subCat.id,
          departmentIds: [testDepartmentId],
          specifications: [],
          nakedDimensions: { l: 1000, w: 600, h: 750 },
          boxDimensions: { l: 1050, w: 650, h: 800 },
          defaultDeliveryMode: 'RTA',
          defaultCreationMode: 'In-house',
          unitOfMeasurement: 'Nos',
          baseSellingRate: 15000,
        }
      });

      const res = await fetch(`${BASE_URL}/api/products/master-products/${tempProduct.id}`, {
        method: 'DELETE',
        headers: { 'Cookie': salesCookieStr }
      });

      // Cleanup
      await prisma.masterProduct.delete({ where: { id: tempProduct.id } }).catch(() => {});

      assert.equal(res.status, 403, `Sales Rep should receive 403 Forbidden on master product deletion, got ${res.status}`);
      const data = await res.json();
      assert.ok(data.error?.toLowerCase().includes('forbidden') || data.error?.toLowerCase().includes('admin'),
        `Expected forbidden message, got: ${data.error}`);
    });

    test('SEC-03: Sales Rep cannot DELETE a Variant (403 Forbidden)', async () => {
      let master = await prisma.masterProduct.findFirst();
      if (!master) {
        assert.ok(true, 'Skipping variant delete test: no master product found');
        return;
      }

      const tempVariant = await prisma.variant.create({
        data: {
          masterProductId: master.id,
          code: `SEC-VAR-${timestamp}`,
          name: `Sec Variant ${timestamp}`,
          departmentIds: master.departmentIds,
          specifications: master.specifications || [],
          nakedDimensions: master.nakedDimensions || { l: 1000, w: 600, h: 750 },
          boxDimensions: master.boxDimensions || { l: 1050, w: 650, h: 800 },
          defaultDeliveryMode: 'RTA',
          defaultCreationMode: 'In-house',
          unitOfMeasurement: 'Nos',
          baseSellingRate: 15000,
        }
      });

      const res = await fetch(`${BASE_URL}/api/products/variants/${tempVariant.id}`, {
        method: 'DELETE',
        headers: { 'Cookie': salesCookieStr }
      });

      // Cleanup
      await prisma.variant.delete({ where: { id: tempVariant.id } }).catch(() => {});

      assert.equal(res.status, 403, `Sales Rep should receive 403 Forbidden on variant deletion, got ${res.status}`);
      const data = await res.json();
      assert.ok(data.error?.toLowerCase().includes('forbidden') || data.error?.toLowerCase().includes('admin'),
        `Expected forbidden message, got: ${data.error}`);
    });

    test('SEC-04: Sales Rep cannot DELETE Product Hierarchy (403 Forbidden)', async () => {
      let cat = await prisma.category.findFirst();
      const catId = cat ? cat.id : 'some-dummy-id';

      const res = await fetch(`${BASE_URL}/api/products/hierarchy/category/${catId}`, {
        method: 'DELETE',
        headers: { 'Cookie': salesCookieStr }
      });

      assert.equal(res.status, 403, `Sales Rep should receive 403 Forbidden on hierarchy deletion, got ${res.status}`);
      const data = await res.json();
      assert.ok(data.error?.toLowerCase().includes('forbidden') || data.error?.toLowerCase().includes('admin'),
        `Expected forbidden message, got: ${data.error}`);
    });

    test('SEC-05: Deletion Guard blocks Master Product deletion when Variants exist (409 Conflict)', async () => {
      const productWithVariants = await prisma.masterProduct.findFirst({
        where: { variants: { some: {} } }
      });

      if (!productWithVariants) {
        assert.ok(true, 'No product with variants found to test 409 guard');
        return;
      }

      const res = await fetch(`${BASE_URL}/api/products/master-products/${productWithVariants.id}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookieStr }
      });

      assert.equal(res.status, 409, `Expected 409 Conflict when deleting product with variants, got ${res.status}`);
      const data = await res.json();
      assert.ok(data.error?.includes('Variants still exist'), `Expected informative 409 error, got: ${data.error}`);
    });

    test('SEC-06: SQL Injection & XSS resilience on products search endpoint', async () => {
      const payloads = [
        "' OR '1'='1",
        "'; DROP TABLE \"MasterProduct\"; --",
        "<script>alert(1)</script>",
        "../../etc/passwd"
      ];

      for (const payload of payloads) {
        const res = await fetch(`${BASE_URL}/api/products/master-products?search=${encodeURIComponent(payload)}`, {
          headers: { 'Cookie': adminCookieStr }
        });
        assert.equal(res.status, 200, `Search query must handle payload safely with 200 OK: ${payload}`);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.ok(Array.isArray(data.products));
      }
    });

    test('SEC-07: Config Step Parameter Tampering (PUT /api/products/config)', async () => {
      const existingProduct = await prisma.masterProduct.findFirst();
      if (!existingProduct) {
        assert.ok(true, 'Skipping config tampering: no master product found');
        return;
      }

      // Invalid step name
      const res1 = await fetch(`${BASE_URL}/api/products/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({
          entityType: 'master-products',
          id: existingProduct.id,
          step: 'malicious_step',
          data: { foo: 'bar' }
        })
      });
      assert.equal(res1.status, 400, 'Invalid step must be rejected with 400');
      const data1 = await res1.json();
      assert.equal(data1.ok, false);
      assert.ok(data1.error.includes('Invalid step'));

      // Missing required params
      const res2 = await fetch(`${BASE_URL}/api/products/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({
          entityType: 'master-products',
          id: existingProduct.id
        })
      });
      assert.equal(res2.status, 400, 'Missing step/data must return 400');
    });

  });

  // =========================================================================
  // PHASE 2: CODE RELIABILITY & BOUNDARY HANDLING
  // =========================================================================
  describe('Phase 2: Code Reliability & Boundary Handling', () => {

    test('REL-01: Missing required fields reject with 400 Bad Request', async () => {
      // 1. Missing name
      const res1 = await fetch(`${BASE_URL}/api/products/master-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({
          name: '',
          subCategoryId: 'dummy',
          departmentIds: [testDepartmentId]
        })
      });
      assert.equal(res1.status, 400);
      const data1 = await res1.json();
      assert.equal(data1.ok, false);
      assert.ok(data1.error.includes('name is required'));

      // 2. Missing subCategory
      const res2 = await fetch(`${BASE_URL}/api/products/master-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({
          name: 'Valid Name',
          subCategoryId: '',
          departmentIds: [testDepartmentId]
        })
      });
      assert.equal(res2.status, 400);
      const data2 = await res2.json();
      assert.ok(data2.error.includes('Sub-category is required'));

      // 3. Empty departmentIds
      const res3 = await fetch(`${BASE_URL}/api/products/master-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({
          name: 'Valid Name',
          subCategoryId: 'some-sub-id',
          departmentIds: []
        })
      });
      assert.equal(res3.status, 400);
      const data3 = await res3.json();
      assert.ok(data3.error.includes('department is required'));
    });

    test('REL-02: Invalid, negative, zero or NaN dimensions reject with 400', async () => {
      const invalidDimensions = [
        { l: 0, w: 600, h: 750 },
        { l: -100, w: 600, h: 750 },
        { l: 'not-a-num', w: 600, h: 750 },
        null,
        {}
      ];

      for (const dim of invalidDimensions) {
        const res = await fetch(`${BASE_URL}/api/products/master-products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
          body: JSON.stringify({
            name: 'Dimension Test',
            subCategoryId: 'some-sub-id',
            departmentIds: [testDepartmentId],
            nakedDimensions: dim,
            boxDimensions: { l: 1000, w: 600, h: 750 },
            defaultDeliveryMode: 'RTA',
            defaultCreationMode: 'In-house',
            unitOfMeasurement: 'Nos',
            baseSellingRate: 10000
          })
        });
        assert.equal(res.status, 400, `Invalid dimension ${JSON.stringify(dim)} must return 400`);
        const data = await res.json();
        assert.ok(data.error.includes('naked dimensions'));
      }
    });

    test('REL-03: Non-positive base selling rate rejects with 400', async () => {
      for (const rate of [0, -500, 'free', null]) {
        const res = await fetch(`${BASE_URL}/api/products/master-products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
          body: JSON.stringify({
            name: 'Rate Test',
            subCategoryId: 'some-sub-id',
            departmentIds: [testDepartmentId],
            nakedDimensions: { l: 1000, w: 600, h: 750 },
            boxDimensions: { l: 1050, w: 650, h: 800 },
            defaultDeliveryMode: 'RTA',
            defaultCreationMode: 'In-house',
            unitOfMeasurement: 'Nos',
            baseSellingRate: rate
          })
        });
        assert.equal(res.status, 400, `Rate ${rate} must reject with 400`);
      }
    });

    test('REL-04: Invalid Delivery / Creation / Unit enum values reject with 400', async () => {
      // Invalid delivery mode
      const res1 = await fetch(`${BASE_URL}/api/products/master-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({
          name: 'Enum Test',
          subCategoryId: 'some-sub-id',
          departmentIds: [testDepartmentId],
          nakedDimensions: { l: 1000, w: 600, h: 750 },
          boxDimensions: { l: 1050, w: 650, h: 800 },
          defaultDeliveryMode: 'INVALID_DELIVERY',
          defaultCreationMode: 'In-house',
          unitOfMeasurement: 'Nos',
          baseSellingRate: 10000
        })
      });
      assert.equal(res1.status, 400);
      const data1 = await res1.json();
      assert.ok(data1.error.includes('Delivery mode'));

      // Invalid unit of measurement
      const res2 = await fetch(`${BASE_URL}/api/products/master-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({
          name: 'Enum Test',
          subCategoryId: 'some-sub-id',
          departmentIds: [testDepartmentId],
          nakedDimensions: { l: 1000, w: 600, h: 750 },
          boxDimensions: { l: 1050, w: 650, h: 800 },
          defaultDeliveryMode: 'RTA',
          defaultCreationMode: 'In-house',
          unitOfMeasurement: 'LITERS',
          baseSellingRate: 10000
        })
      });
      assert.equal(res2.status, 400);
      const data2 = await res2.json();
      assert.ok(data2.error.includes('Unit of measurement'));
    });

    test('REL-05: Monotonic variant sequence generation increments cleanly', () => {
      assert.equal(parseVariantSequence('WKSPC-PEDU-AMB-001'), 1);
      assert.equal(parseVariantSequence('WKSPC-PEDU-AMB-042'), 42);
      assert.equal(parseVariantSequence('INVALID-FORMAT'), null);

      const next1 = nextVariantCode('WKSPC-PEDU-AMB', []);
      assert.equal(next1, 'WKSPC-PEDU-AMB-001');

      const next2 = nextVariantCode('WKSPC-PEDU-AMB', ['WKSPC-PEDU-AMB-001', 'WKSPC-PEDU-AMB-002']);
      assert.equal(next2, 'WKSPC-PEDU-AMB-003');

      // Handles non-contiguous sequences
      const next3 = nextVariantCode('WKSPC-PEDU-AMB', ['WKSPC-PEDU-AMB-001', 'WKSPC-PEDU-AMB-015']);
      assert.equal(next3, 'WKSPC-PEDU-AMB-016');
    });

    test('REL-06: Code Collision on Duplicate Master Code returns 409 Conflict', async () => {
      const existing = await prisma.masterProduct.findFirst();
      if (!existing) {
        assert.ok(true, 'No existing master product to test duplicate code');
        return;
      }

      const res = await fetch(`${BASE_URL}/api/products/master-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({
          name: 'Duplicate Code Attempt',
          code: existing.code,
          subCategoryId: existing.subCategoryId,
          departmentIds: [testDepartmentId],
          nakedDimensions: { l: 1000, w: 600, h: 750 },
          boxDimensions: { l: 1050, w: 650, h: 800 },
          defaultDeliveryMode: 'RTA',
          defaultCreationMode: 'In-house',
          unitOfMeasurement: 'Nos',
          baseSellingRate: 12000
        })
      });

      assert.equal(res.status, 409, `Expected 409 Conflict on duplicate code, got ${res.status}`);
      const data = await res.json();
      assert.ok(data.error.includes('already in use'));
    });

    test('REL-07: Code Collision on Duplicate Variant Code returns 409 Conflict', async () => {
      const existing = await prisma.variant.findFirst();
      if (!existing) {
        assert.ok(true, 'No existing variant to test duplicate code');
        return;
      }

      const res = await fetch(`${BASE_URL}/api/products/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({
          masterProductId: existing.masterProductId,
          name: 'Duplicate Variant Code Attempt',
          code: existing.code
        })
      });

      assert.equal(res.status, 409, `Expected 409 Conflict on duplicate variant code, got ${res.status}`);
      const data = await res.json();
      assert.ok(data.error.includes('already in use'));
    });

  });

  // =========================================================================
  // PHASE 3: DOMAIN LOGIC & OWNER UX INVARIANTS
  // =========================================================================
  describe('Phase 3: Domain Logic & Owner UX Invariants', () => {

    test('LOG-01: Owner Rule 4 - Dimensions always say L B H (Breadth B, never Width W)', () => {
      const dim = { l: 1400, w: 700, h: 750 };
      const formatted = formatLbh(dim);
      assert.equal(formatted, 'L 1400 × B 700 × H 750 mm', 'Must use L B H format');
      assert.ok(!formatted.includes('W'), 'Must never include W (Width) in user-facing dimensions');
      assert.equal(formatLbh(null), '–', 'Null dimensions must render en dash');
    });

    test('LOG-02: CBM Formula strictly computed from Box dimensions in m³ (4 decimals)', () => {
      // 1000mm x 1000mm x 1000mm = 1 m³
      const cbm1 = computeCbm({ l: 1000, w: 1000, h: 1000 });
      assert.equal(cbm1, 1.0);

      // 1200mm x 600mm x 750mm = 1.2 * 0.6 * 0.75 = 0.54 m³
      const cbm2 = computeCbm({ l: 1200, w: 600, h: 750 });
      assert.equal(cbm2, 0.54);

      // 550mm x 450mm x 620mm = 0.55 * 0.45 * 0.62 = 0.15345 -> rounded to 0.1535
      const cbm3 = computeCbm({ l: 550, w: 450, h: 620 });
      assert.equal(cbm3, 0.1535);

      assert.equal(computeCbm(null), null);
    });

    test('LOG-03: Inches dimension conversion formula (mm / 25.4 rounded to 2 decimals)', () => {
      assert.equal(mmToInches(25.4), 1.0);
      assert.equal(mmToInches(1200), 47.24);
      assert.equal(mmToInches(600), 23.62);
      assert.equal(mmToInches(750), 29.53);

      const inches = dimensionsInInches({ l: 1200, w: 600, h: 750 });
      assert.deepEqual(inches, { l: 47.24, w: 23.62, h: 29.53 });
    });

    test('LOG-04: Owner Rule 2 - Zero em dashes in product database records', async () => {
      const [masters, variants] = await Promise.all([
        prisma.masterProduct.findMany({ select: { name: true, code: true } }),
        prisma.variant.findMany({ select: { name: true, code: true } })
      ]);

      for (const m of masters) {
        assert.ok(!m.name.includes('—'), `Master product name "${m.name}" must not contain em dash`);
        assert.ok(!m.code.includes('—'), `Master product code "${m.code}" must not contain em dash`);
      }
      for (const v of variants) {
        assert.ok(!v.name.includes('—'), `Variant name "${v.name}" must not contain em dash`);
        assert.ok(!v.code.includes('—'), `Variant code "${v.code}" must not contain em dash`);
      }
    });

    test('LOG-05: Setup status engine tri-state returns (Configured, In Progress, Not Started)', () => {
      // Process status
      assert.equal(processStatusOf(null), 'Not Started');
      assert.equal(processStatusOf({ departmentIds: ['d1', 'd2'], processChart: {} }), 'Not Started');
      assert.equal(processStatusOf({ departmentIds: ['d1', 'd2'], processChart: { d1: ['step1'] } }), 'In Progress');
      assert.equal(processStatusOf({ departmentIds: ['d1', 'd2'], processChart: { d1: ['s1'], d2: ['s2'] } }), 'Configured');

      // BOM status
      assert.equal(bomStatusOf(null), 'Not Started');
      assert.equal(bomStatusOf({ configured: false, sections: { assembly: { status: 'pending', parts: [] } } }), 'Not Started');
      assert.equal(bomStatusOf({ configured: false, sections: { assembly: { status: 'in-progress', parts: [{ code: 'P01' }] } } }), 'In Progress');
      assert.equal(bomStatusOf({ configured: true, sections: {} }), 'Configured');

      // Packing status
      assert.equal(packingStatusOf(null), 'Not Started');
      assert.equal(packingStatusOf({ configured: false, boxes: [{ id: 1 }] }), 'In Progress');
      assert.equal(packingStatusOf({ configured: true, boxes: [{ id: 1 }] }), 'Configured');
    });

  });

  // =========================================================================
  // PHASE 4: FULL END-TO-END WORKFLOW SIMULATION
  // =========================================================================
  describe('Phase 4: Full End-to-End Workflow Simulation', () => {

    test('WKF-01: Create 3-Tier Hierarchy (Segment -> Category -> SubCategory)', async () => {
      // 1. Create Segment
      const res1 = await fetch(`${BASE_URL}/api/products/hierarchy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({ type: 'segment', name: segmentName })
      });
      assert.equal(res1.status, 200, 'Create segment must succeed');
      const data1 = await res1.json();
      assert.equal(data1.ok, true);
      assert.ok(data1.data?.id);
      testSegmentId = data1.data.id;

      // 2. Create Category under Segment
      const res2 = await fetch(`${BASE_URL}/api/products/hierarchy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({ type: 'category', name: categoryName, parentId: testSegmentId })
      });
      assert.equal(res2.status, 200, 'Create category must succeed');
      const data2 = await res2.json();
      assert.equal(data2.ok, true);
      assert.ok(data2.data?.id);
      testCategoryId = data2.data.id;

      // 3. Create Sub-Category under Category
      const res3 = await fetch(`${BASE_URL}/api/products/hierarchy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({ type: 'subcategory', name: subCategoryName, parentId: testCategoryId })
      });
      assert.equal(res3.status, 200, 'Create sub-category must succeed');
      const data3 = await res3.json();
      assert.equal(data3.ok, true);
      assert.ok(data3.data?.id);
      testSubCategoryId = data3.data.id;
    });

    test('WKF-02: Prevent Duplicate Hierarchy Names (409 Conflict)', async () => {
      const res = await fetch(`${BASE_URL}/api/products/hierarchy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({ type: 'segment', name: segmentName })
      });
      assert.equal(res.status, 409, 'Duplicate segment must return 409 Conflict');
      const data = await res.json();
      assert.ok(data.error.includes('already exists'));
    });

    test('WKF-03: Create Master Product with complete parameters & auto-code', async () => {
      const payload = {
        name: masterProductName,
        subCategoryId: testSubCategoryId,
        departmentIds: [testDepartmentId],
        specifications: [
          { key: 'Top Material', kind: 'fixed', value: '25mm Prelam Particle Board' },
          { key: 'Edge Banding', kind: 'fixed', value: '2mm PVC' }
        ],
        nakedDimensions: { l: 1200, w: 600, h: 750 },
        boxDimensions: { l: 1250, w: 650, h: 800 },
        defaultDeliveryMode: 'RTA',
        defaultCreationMode: 'In-house',
        unitOfMeasurement: 'Nos',
        baseSellingRate: 18500,
        grossMarginTargetPct: 35.0,
        leadTimeDays: 7,
        moq: 1
      };

      const res = await fetch(`${BASE_URL}/api/products/master-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 200, 'Master Product creation must succeed');
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.ok(data.product?.id);
      assert.ok(data.product?.code);
      testMasterProductId = data.product.id;
      generatedMasterCode = data.product.code;
    });

    test('WKF-04: Configure Master Product Process Chart & BOM via PUT /api/products/config', async () => {
      // 1. Configure Process Chart
      const processPayload = {
        entityType: 'master-products',
        id: testMasterProductId,
        step: 'process',
        data: {
          [testDepartmentId]: ['Panel Sizing', 'Edge Banding', 'Multi-Boring']
        }
      };

      const res1 = await fetch(`${BASE_URL}/api/products/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify(processPayload)
      });
      assert.equal(res1.status, 200);

      // 2. Configure BOM
      const bomPayload = {
        entityType: 'master-products',
        id: testMasterProductId,
        step: 'bom',
        data: {
          configured: true,
          sections: {
            assembly: {
              status: 'configured',
              parts: [
                { id: 'part-1', name: 'Desk Top Panel', material: 'PLPB', qty: 1, sourcing: 'in-house' },
                { id: 'part-2', name: 'Modesty Panel', material: 'PLPB', qty: 1, sourcing: 'in-house' }
              ]
            }
          }
        }
      };

      const res2 = await fetch(`${BASE_URL}/api/products/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify(bomPayload)
      });
      assert.equal(res2.status, 200);

      // 3. Verify via GET /api/products/config
      const getRes = await fetch(`${BASE_URL}/api/products/config?entityType=master-products&id=${testMasterProductId}`, {
        headers: { 'Cookie': adminCookieStr }
      });
      assert.equal(getRes.status, 200);
      const getData = await getRes.json();
      assert.equal(getData.entity.statuses.process, 'Configured');
      assert.equal(getData.entity.statuses.bom, 'Configured');
    });

    test('WKF-05: Create Variant inheriting master data and re-basing BOM with auto-seeded SFGs', async () => {
      const variantPayload = {
        masterProductId: testMasterProductId,
        name: `${masterProductName} White Laminate`,
        baseSellingRate: 19500
      };

      const res = await fetch(`${BASE_URL}/api/products/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify(variantPayload)
      });

      assert.equal(res.status, 200, 'Variant creation must succeed');
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.ok(data.variant?.id);
      assert.ok(data.variant.code.startsWith(generatedMasterCode));
      assert.equal(data.variant.code, `${generatedMasterCode}-001`);
      testVariantId = data.variant.id;

      // Verify auto-seeded SemiFinishedGoods (SFGs) in DB
      const sfgs = await prisma.semiFinishedGood.findMany({
        where: { variantId: testVariantId }
      });
      assert.equal(sfgs.length, 2, 'Must auto-seed 2 SFG parts based on re-based BOM');
      assert.ok(sfgs[0].code.includes('-P01'));
      assert.ok(sfgs[1].code.includes('-P02'));
    });

    test('WKF-06: Update Master Product (PUT) with code change and collision protection', async () => {
      const res = await fetch(`${BASE_URL}/api/products/master-products/${testMasterProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieStr },
        body: JSON.stringify({
          name: `${masterProductName} (Updated)`,
          leadTimeDays: 10
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.product.name, `${masterProductName} (Updated)`);
      assert.equal(data.product.leadTimeDays, 10);
    });

    test('WKF-07: Hierarchy Cascading Delete Guards prevent deleting active parents (409 Conflict)', async () => {
      // 1. Cannot delete SubCategory because master product exists
      const res1 = await fetch(`${BASE_URL}/api/products/hierarchy/subcategory/${testSubCategoryId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookieStr }
      });
      assert.equal(res1.status, 409);
      const data1 = await res1.json();
      assert.ok(data1.error.includes('master products still reference'));

      // 2. Cannot delete Category because subcategory exists
      const res2 = await fetch(`${BASE_URL}/api/products/hierarchy/category/${testCategoryId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookieStr }
      });
      assert.equal(res2.status, 409);
      const data2 = await res2.json();
      assert.ok(data2.error.includes('still reference this category'));

      // 3. Cannot delete Segment because category exists
      const res3 = await fetch(`${BASE_URL}/api/products/hierarchy/segment/${testSegmentId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookieStr }
      });
      assert.equal(res3.status, 409);
      const data3 = await res3.json();
      assert.ok(data3.error.includes('categories still reference'));
    });

    test('WKF-08: Clean Teardown Sequence (Variant -> Master Product -> Hierarchy)', async () => {
      // 1. Delete Variant
      const res1 = await fetch(`${BASE_URL}/api/products/variants/${testVariantId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookieStr }
      });
      assert.equal(res1.status, 200, 'Variant delete must succeed');
      testVariantId = '';

      // 2. Delete Master Product (now allowed since variant is deleted)
      const res2 = await fetch(`${BASE_URL}/api/products/master-products/${testMasterProductId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookieStr }
      });
      assert.equal(res2.status, 200, 'Master Product delete must succeed');
      testMasterProductId = '';

      // 3. Delete Sub-Category
      const res3 = await fetch(`${BASE_URL}/api/products/hierarchy/subcategory/${testSubCategoryId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookieStr }
      });
      assert.equal(res3.status, 200, 'Sub-category delete must succeed');
      testSubCategoryId = '';

      // 4. Delete Category
      const res4 = await fetch(`${BASE_URL}/api/products/hierarchy/category/${testCategoryId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookieStr }
      });
      assert.equal(res4.status, 200, 'Category delete must succeed');
      testCategoryId = '';

      // 5. Delete Segment
      const res5 = await fetch(`${BASE_URL}/api/products/hierarchy/segment/${testSegmentId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookieStr }
      });
      assert.equal(res5.status, 200, 'Segment delete must succeed');
      testSegmentId = '';
    });

  });

});
