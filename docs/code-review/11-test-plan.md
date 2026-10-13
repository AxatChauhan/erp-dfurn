# 11 - Concrete Test Plan & Verification Suite

**Auditor:** Principal QA & Automation Architect  
**Baseline Git Commit:** `65fc292ae1d79d31e40c8f2d8763d427d3cfc73c`

---

## 1. Unit & Security Tests (Vitest)

### Test Suite 1: Authentication & RBAC Guard (`tests/unit/auth.test.ts`)
1. **Unauthenticated API Access:**
   - Call `GET /api/clients` without `auth_token` cookie -> MUST return `401 Unauthorized`.
   - Call `GET /api/hrm/employees` without `auth_token` cookie -> MUST return `401 Unauthorized`.
   - Call `POST /api/users` without `SUPER_ADMIN` session -> MUST return `403 Forbidden`.
2. **Cookie Role Tampering:**
   - Call `PUT /api/quotations/[id]` with forged cookie `user_role=SUPER_ADMIN` but standard `SALES` session token -> MUST reject direct approval and retain status `PENDING_APPROVAL`.
3. **Password Security:**
   - Verify user registration hashes password with bcrypt salt rounds >= 12.
   - Verify plaintext password string is never returned or stored.

### Test Suite 2: Financial Calculation & Rounding (`tests/unit/quotation-math.test.ts`)
1. **Server-Side Recomputation:**
   - Send quotation payload with 3 items totaling ₹15,000, but client passes `totalAmount: 100` -> Server MUST override and save `totalAmount: 15000.00`.
2. **Decimal Precision:**
   - Verify items with fractional units (e.g. 3.5 meters @ ₹120.25) compute exactly ₹420.88 without IEEE-754 binary floating-point drift.

---

## 2. Integration & Transaction Tests (Vitest / Database Test DB)

### Test Suite 3: Atomic Mutation & Rollback (`tests/integration/transactions.test.ts`)
1. **Quotation Item Update Atomicity:**
   - Simulate a database failure during `tx.quotation.update` (e.g. invalid client foreign key).
   - Assert that existing quotation line items are NOT deleted and remain intact.
2. **Enquiry Stage Monotonicity:**
   - Create an enquiry in stage `Quoted`.
   - Attempt `PUT /api/enquiries/[id]` with `stage: 'New'`.
   - Assert server rejects regression or ignores stage downgrade.

---

## 3. Concurrency & Race Condition Load Tests (k6 / Autocannon)

### Test Suite 4: Sequential Numbering Collision Test (`tests/load/concurrency-numbers.js`)
1. **Simultaneous Quotation Creation:**
   - Spawn 20 concurrent virtual users hitting `POST /api/quotations` within a 50ms window.
   - Assert: Zero `P2002 Unique Constraint Violation` errors.
   - Assert: Exactly 20 distinct, gap-free quotation numbers generated (`DF_QT_000001` through `DF_QT_000020`).
2. **Simultaneous Biometric Punch In:**
   - Send 10 concurrent `POST /api/hrm/attendance/punch` requests for the same employee.
   - Assert: Exactly 1 "In" punch succeeds; subsequent 9 requests receive `400 Bad Request: Already punched in`.

---

## 4. End-to-End User Journey Tests (Playwright)

### Test Suite 5: Complete Sales Pipeline E2E (`tests/e2e/sales-pipeline.spec.ts`)
1. **Step 1:** Log in as `sales_user`.
2. **Step 2:** Open `/enquiries`, click `+ New Enquiry`.
3. **Step 3:** In client picker, click `+ Quick Add New Client`. Enter "Test Enterprises", "+919876543299", "Ahmedabad". Submit modal.
4. **Step 4:** Verify "Test Enterprises" is auto-selected in Enquiry form.
5. **Step 5:** Add 2 custom line items ("Executive Desk", "Credenza Unit"). Save enquiry.
6. **Step 6:** Click "+ Create Quote for Lead". Verify quote form opens pre-filled with enquiry items.
7. **Step 7:** Submit quote with status `DRAFT`. Click "Submit for Approval". Verify status changes to `PENDING_APPROVAL`.
8. **Step 8:** Log out. Log in as `super_admin`.
9. **Step 9:** Open `/quotations`. Click "Pending Review" banner. Review quote. Click "Approve Quotation".
10. **Step 10:** Verify status updates to `APPROVED`. Click "Download PDF" and verify generated PDF blob download.
