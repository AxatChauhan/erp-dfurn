# D'furn Modular Systems ERP - Agent Handoff Document

> **Purpose:** This file provides complete, unambiguous context for any AI assistant (OpenCode, Roo Code, Claude Code, Cursor, or Aider) taking over work on this repository.
> **Last Verified:** October 19, 2026 · Tests Passing: 85/85 (100%) · Zero Bloat Data

---

## 1. Project Overview & Architecture

* **Framework:** Next.js 16.0+ (Turbopack, React 19, App Router, Server Components).
* **Database & ORM:** Prisma 5.20.0 with PostgreSQL hosted on **Supabase Mumbai Pooler** (`aws-0-ap-south-1.pooler.supabase.com`).
* **Deployment:** Vercel Production (`https://optimistic-carson-one.vercel.app`), Region: `bom1` (Mumbai).
* **Core Commercial Modules:**
  1. **Clients (`/clients`):** B2B, B2B2C, and B2C modular furniture client accounts with GSTINs and E.164 phones.
  2. **Enquiries (`/enquiries`):** 8-step monotonic opportunity funnel (`New` → `Qualified` → `Quoted` → `Converted` / `Lost`).
  3. **Quotations (`/quotations`):** Multi-versioned commercial proposals (`v0, v1`) with strict commercial math.
  4. **HRM (`/hrm`):** Shop-floor attendance board, employee roster, and monthly attendance register.

---

## 2. Inviolable Design & Business Rules (Owner Mandates)

Whenever modifying code, adding features, or editing UI, you MUST follow these 5 rules:

### Rule 1: STRICT ZERO "Them" Dashes / Em Dashes (`—`)
* **Never** use em dashes (`—`) in screen text, placeholders, tooltips, toasts, or error messages.
* For empty / uncomputed values, use an **en dash `–`**.
* For separators, use a middle dot **`·`** (e.g. `DF/C/B2B/00001 · India`).

### Rule 2: Strict Factory Ergonomics & Color Palette
* Background: `#F4F3ED` (Warm off-white).
* Cards & Modals: `#FFFFFF`.
* High Contrast Text & Active State: `#1A1A1A` (Black).
* Primary Brand & In-Progress Accent: `#FF7700` (Orange).
* Status Colors: Strictly Tri-state: **Green (Done/Active) · Orange (In-Progress/Attention) · Red (Error/Hold/Lost)**. Never invent a fourth status color.
* Inputs: Chunky 48px height (`h-12`) for shop-floor touch usability.
* Layout: Wide FOV (`max-w-[1720px]`). Responsive stacking under `900px`.

### Rule 3: Commercial Arithmetic Precision (18% GST)
* Modular furniture GST is strictly **18%**.
* Mathematical invariants:
  1. `item.total = item.quantity * item.unitPrice - (item.discountAmount || 0)`
  2. `version.grossTotal = sum(items.map(i => i.total))`
  3. `version.extraCostsTotal = sum(additionalCharges.map(c => c.amount))`
  4. `taxableBase = version.grossTotal - version.overallDiscountAmt + version.extraCostsTotal`
  5. `version.gstAmount = round(taxableBase * 0.18)`
  6. `version.grandTotal = taxableBase + version.gstAmount`
  7. `quotation.totalAmount = activeVersion.grandTotal`

### Rule 4: Referential Integrity & State Monotonicity
* `Quotation.clientId` **MUST STRICTLY EQUAL** `Quotation.enquiry.clientId`. Never allow quotation client leakage.
* An enquiry at stage `New` must have **0 quotations**.
* An enquiry at stage `Quoted` must have **at least 1 quotation**.
* An enquiry at stage `Converted` must have at least 1 quotation with status **`Converted` (Won)**.
* An enquiry with outcome `Lost` must have a non-empty `lostReason` or `lostReasonId`.

### Rule 5: Next.js 16 Asynchronous Route Parameters
* In Next.js 16 App Router, `params` and `searchParams` passed to pages and layouts are **Promises**.
* Always `await params` (e.g., `const { id } = await params;`).

---

## 3. Mandatory Verification Commands

Before declaring any task or code change complete, run these commands in your terminal:

```bash
# 1. Type-checking & Prisma schema validation
npm run verify

# 2. Fast Tri-Module Cross-Sync Test (Runs in ~3 seconds)
npm run test:sync

# 3. Visual Diagnostic Terminal Summary
npm run audit:sync

# 4. Full Core Logic & Security Test Suite
npm test
```

> **Note:** A Git pre-push hook (`.githooks/pre-push`) is active. If `npm run test:sync` fails, git push is automatically blocked.

---

## 4. Quick Starter Prompt for New AI Sessions

Copy and paste this one sentence when starting in OpenCode, Roo Code, or any external tool:

> *"Read `HANDOFF.md` completely. Follow all 5 owner mandates, use Next.js 16 conventions, and verify all code changes using `npm run test:sync` and `npm run verify`."*
