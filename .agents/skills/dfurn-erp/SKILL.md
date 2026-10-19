---
name: dfurn-erp
description: >-
  Core engineering standard, domain business logic, owner design mandates,
  performance architecture, and verification gates for D'furn Modular Systems ERP
  (Next.js 16, React 19, Prisma, PostgreSQL). Activate whenever creating, modifying,
  or auditing any ERP module (Clients, Quotations, Enquiries, HRM, Products, Inventory),
  APIs, database schemas, or UI components.
---

# D'furn Modular Systems ERP — Engineering & Domain Manual

This skill encodes the locked domain specifications, owner design mandates, performance standards, and security guardrails for the **D'furn Modular Systems ERP** (`optimistic-carson`).

---

## 1. Owner Design Philosophy & UX Commandments

The business owner ("the sir") has tested and refined this ERP through multiple rigorous review rounds. Any code or UI generated **must strictly obey these non-negotiable principles**:

1. **Design for the Least Adaptive User:**
   - The user has zero patience for clutter, dense spreadsheets, or tedious multi-step documentation.
   - Keep the UI ultra-minimalistic. The screen must show only what is essential for the immediate action.
2. **No Em Dashes (`—`) Anywhere in User-Facing Text:**
   - **Strictly banned** in all screen text, toasts, placeholders, tooltips, and server error messages.
   - For empty or uncomputed values, use an **en dash `–`**.
   - For inline value separators, use a middle dot **`·`** (e.g. `DF/C/B2B/00001 · India`).
3. **Selected / Active State is BLACK, Never Orange:**
   - In filter chips, segmented controls, tabs, and toggles, **Black (`#000000` / `var(--color-black)`) is the active/selected state**.
   - Orange (`#FF7700` / `var(--color-orange)`) is strictly reserved for primary CTAs, links, focus rings, and brand marks.
   - Done/Completed states are **Green** (`#27AE60` / `--color-success`) everywhere.
   - The tri-state status pattern across the app is strictly: **Green (Good/Done) · Orange (In-Progress/Attention) · Red (Error/Hold/Lost)**. Never invent a fourth status color.
4. **Dimensions ALWAYS Say `L B H`:**
   - Never join dimensions as plain numbers (e.g. avoid `1200x600x750mm`).
   - Format: `L 1400 × B 700 × H 750 mm`.
   - In form inputs and column headers, the second dimension is **B (Breadth/Depth)**, never W (Width). Stored database keys stay `l`, `w`, `h`.
5. **Multi-Field Creation Flows are Milestone WIZARDS:**
   - Never build a single long scrolling form for creating or editing complex entities (Clients, Quotations, Job Orders, Employees).
   - Multi-field creation must use a stepped wizard (`wizard-modal` / `wizard-stepper` / `wizard-footer`) with clear milestones.
6. **Short Choices are Pill Buttons, Not Dropdowns:**
   - Wherever there are short fixed choices (e.g. B2B / B2C, Yes / No, Payment mode), render horizontal pill buttons (`pillToggle`) to save clicks. Reserve `<select>` dropdowns only for large, dynamic lists.
7. **Long Explanations Live Behind an "i" Popover:**
   - Never place standing instructional paragraphs on a screen. Hide detailed guidance behind an info icon (`UI.info` popover).
8. **Codes are References, Not Headlines:**
   - Company or person names lead in bold. Entity codes (e.g. `DF/C/B2B/00001`) sit faint and small beneath the name. *(Exception: Job Orders list where Job Number leads).*
9. **Never Fabricate an Insight:**
   - If data cannot back a metric or an upstream module is unbuilt, show `–` with a tooltip explanation, **never `0`**. A true zero and an unbuilt feature must never look identical.
10. **Every Save Blocks the Screen:**
    - All data-changing mutations (`POST`, `PUT`, `DELETE`) must show a global overlay/loader to block duplicate clicks and race conditions.

---

## 2. Commercial Domain & Business Rules

### A. Clients (`/clients`)
* **Client Code Scheme:** `DF/C/<mode>/00001` where `<mode>` is `B2B`, `B2B2C`, or `B2C`.
  - Driven by an atomic sequence counter (`findFirst` boundary seek).
  - Once assigned, the client code **never changes**, even if the business mode is changed later.
* **No Duplicate Phone Check on Manual Entry:**
  - **Do NOT reject duplicate phone numbers on manual client creation or edit.** In modular furniture manufacturing, branch offices, partners, and family members often share a phone line. Only Quick Enquiry and CSV bulk import skip duplicate phones.
* **Contact & Address Structure:**
  - Phones are stored as E.164 with international dial-code parsing (`google-libphonenumber`). Include a WhatsApp indicator (`client.whatsappPhone`).
  - Addresses are stored as structured objects (`Line 1`, `Line 2`, `City`, `State`, `Pincode`, `Country`). Full display address is auto-concatenated on read, never stored as a raw static string.
  - State and Pincode are required only for Indian clients.
* **Delete Guard:**
  - A client with any Job Order, Quotation, or Enquiry **cannot be deleted**. The API must return `409 Conflict` explaining what transactions exist.

### B. Quotations (`/quotations`)
* **Numbering Scheme:** `DF/Q/2026-27/0001` (Financial Year based).
  - A quotation is a **Draft with no number** until it is complete and first submitted. It takes its official code only upon first submission.
* **Immutable Multi-Versioning (`v0, v1, v2`):**
  - **Every save creates the NEXT VERSION**, even in draft mode. Drafts are never overwritten in place.
  - Diffs between versions are computed on stable `lineId` UUIDs (never match lines by array position or product name).
* **Exact Calculation Sequence:**
  $$\text{Gross Total} \longrightarrow \text{Overall Discount (flat or \%)} \longrightarrow \text{Discounted Gross} \longrightarrow + \text{Additional Charges} \longrightarrow + \text{GST (18\%)} \longrightarrow \text{Grand Total}$$
  - Unit discounts apply directly to line items. Overall discount applies to the Gross Total before Additional Charges and GST.
* **GST Mandate:**
  - GST is **mandatory** for any Indian business client. It requires a valid 15-character GSTIN, and the "Not Applicable" toggle is locked.
* **Single-Page A4 Printable Document:**
  - Formatted using clean CSS `@media print` rules. No heavy server-side PDF generation libraries.
  - Only **Verified & Approved** versions can print clean. Draft versions print with a `"DRAFT"` watermark.

### C. Enquiries (`/enquiries`)
* **Dual-Axis Funnel Model:**
  - `stage`: `New` $\rightarrow$ `Qualified` $\rightarrow$ `Quoted` $\rightarrow$ `Converted` (Monotonic high-water mark; survives cancellation to accurately measure conversion ratios).
  - `outcome`: `Open` vs `Lost` (with mandatory `lostReasonId` and optional `lostNote`).
* **Qualification Requirement:**
  - A brief or project scope description is **mandatory to qualify** (enforced by the server).
* **Centralized Lead Intake:**
  - Idempotent intake endpoint (`POST /enquiries/intake`) for external leads (Google Ads, Meta, IndiaMART, Website) keyed on `lower(channel:externalId)`.
* **Delete Guard:**
  - An enquiry with any logged communication or linked quotation cannot be deleted (`hasCommunication: true`).

### D. Human Resources (`/hrm`)
* **Workforce Categorization:** In-house staff (`EMP-0001`) vs Contractual labour (`CL-0001`), Contractors (`CON-0001`).
* **Gate Attendance:** Desktop gate entry stamped using the server's clock (`Asia/Kolkata`), never the client device's clock.
* **Pure Attendance Calculation:** What a day amounts to is computed via a pure function (`attendanceCalc.computeDay`).
* **Paid Leave:** Calculated as a derived ledger from historical credit/debit records, never stored as a raw writable integer.
* **Payroll Formulas:** Custom AST parser, **never `eval`**. Approving a monthly run freezes the snapshot and locks that month's in-house attendance.

### E. RBAC & Money Redaction
* Financial values are protected by granular view permissions (`clients.viewValue`, `quotes.viewValue`, `enquiries.viewValue`).
* When a user lacks the value permission, amounts are redacted to `null` with `valueHidden: true`, and the UI displays an en dash `–`.
* `SUPER_ADMIN` bypasses all permission checks. All other roles are strictly fail-closed.

---

## 3. High-Performance Architecture (< 400ms Standard)

To prevent the 3-second loading waterfalls previously identified:

1. **No Client-Side Fetch Waterfalls on Table Routes:**
   - Primary data tables (Clients, Quotations, Enquiries) must NOT be pure `'use client'` pages that mount empty and fetch in `useEffect`.
   - Use Next.js Server Components to fetch initial page-1 data directly via Prisma during SSR.
   - Pass `initialData` into interactive client leaf components (`ClientsClient`, `QuotationsClient`).
2. **Concurrent Database Queries via `Promise.all`:**
   - Never chain independent database queries with sequential `await`. Always group:
     ```typescript
     const [categories, kpis, total, rows] = await Promise.all([
       prisma.sourceCategory.findMany({ orderBy: { name: 'asc' } }),
       getOrComputeKpis(),
       prisma.client.count({ where }),
       prisma.client.findMany({ where, skip, take, include: { _count: true } }),
     ]);
     ```
3. **In-Memory KPI Micro-Caching:**
   - Heavy aggregate statistics (total count, business breakdown, top source) must be cached in server memory with a 30-second TTL.
   - Invalidate the cache immediately upon entity creation or update (`invalidateClientKpiCache()`).
4. **Targeted Relation Fetching:**
   - Avoid joining deep nested models (e.g. `include: { jobOrders: true }`) solely to calculate array lengths or sums. Use Prisma's `_count` or targeted aggregation queries.
5. **Next.js Route Prefetching:**
   - Navigation links in `Sidebar.tsx` and table action buttons must use `<Link href="..." prefetch={true}>` to eliminate route transition latency.

---

## 4. Tech Stack & Database Protocols

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5.
- **ORM & Database**: Prisma 5.20 + PostgreSQL (Supabase / Self-hosted VPS).
- **Connection Pooling**:
  - `DATABASE_URL`: Transaction-mode PgBouncer connection (Port `6543` with `?pgbouncer=true`).
  - `DIRECT_URL`: Session-mode direct connection (Port `5432`) for Prisma migrations and schema push.
  - Enforce the global singleton pattern in `src/lib/prisma.ts` to prevent lambda connection leaks.
- **Timezone**: All business day calculations and timestamps must resolve to `Asia/Kolkata` (`localDay()`).
- **Security**:
  - Session cookies (`auth_token`, `user_role`, `user_name`, `user_id`) verified in `src/middleware.ts`.
  - Passwords hashed using `bcryptjs` (salt rounds $\ge 10$). Tokens signed with `jose` (HS256).
  - Never expose hashed passwords, tokens, or internal secrets in API responses.
  - 100% Prisma parameterized queries (zero raw SQL string concatenation).

---

## 5. Pre-Completion Quality & Verification Gate

Before any task or refactor in this repository is declared complete, the developer or agent **must execute the following verification pipeline**:

```bash
# 1. Validate Prisma schema integrity
npx prisma validate

# 2. Verify strict TypeScript type compliance (0 errors allowed)
npx tsc --noEmit

# 3. Verify Next.js production build and Server Component compilation
npm run build
```

Additionally, review the git diff (`git status`, `git diff`) to ensure:
- No unrelated comments, docstrings, or modules were removed.
- No em dashes (`—`) were introduced into user-facing text.
- No client-side `useEffect` data-fetching waterfalls were introduced.
