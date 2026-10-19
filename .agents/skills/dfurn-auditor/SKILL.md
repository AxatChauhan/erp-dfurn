---
name: dfurn-auditor
description: >-
  Pre-flight compliance scanner and auditor for D'furn Modular Systems ERP.
  Audits code, UI components, API routes, and PR diffs strictly against
  the owner's locked design mandates, calculations, and performance architecture.
  Activate before committing code, creating pull requests, or reviewing ERP modules.
---

# D'furn ERP Compliance Auditor Manual

This skill acts as a dedicated audit persona to inspect any file, diff, or proposed change strictly from the perspective of the business owner ("the sir") and our engineering performance standard.

---

## 1. The 10-Point Owner Compliance Audit Checklist

Whenever reviewing a feature, pull request, or file modification, execute this 10-point audit:

| # | Check Item | Owner Mandate / Exact Rule | Violation Trigger |
|---|---|---|---|
| 1 | **No "Them" Dashes** | Screen text, toasts, placeholders, and tooltips must NOT contain `—`. Empty values must use `–`, separators use `·`. | Any occurrence of `—` in user-facing string literals. |
| 2 | **Active Color is Black** | Selected/active state in filter chips, segmented tabs, and buttons must be Black (`#000000`). | Orange used as the active background for a chip or tab. |
| 3 | **Dimensions Format** | All dimensions must say `L B H` (e.g. `L 1400 × B 700 × H 750 mm`). Second dimension is Breadth (`B`), never `W`. | Joining numbers as `1200x600x750` or using `W` in labels. |
| 4 | **Milestone Steppers** | Multi-field creation flows must use a stepped wizard (`wizard-modal`). | Long, single-page scrolling forms for complex entities. |
| 5 | **Pill Buttons for Choices** | Short fixed choices (B2B/B2C, Yes/No, Cash/Bank) must be horizontal pill buttons. | Using `<select>` dropdowns for $\le 5$ fixed options. |
| 6 | **Long Text Behind "i"** | Instructions must live behind an info icon popover (`UI.info`). | Standing explanatory paragraphs cluttering forms. |
| 7 | **Codes Faint Under Names** | Company or person names lead in bold; codes (`DF/C/...`) sit faint below. | Code displayed larger or more prominently than the name. |
| 8 | **No Fabricated Insights** | Missing data or unbuilt modules must show `–` with an explainer, never `0`. | Showing `0` for uncalculated metrics or empty states. |
| 9 | **Shared Phone Allowed** | Manual client creation must NOT reject duplicate phone numbers. | Rejecting a manual client creation with `409` on phone match. |
| 10 | **Quotation Calculation Order** | $\text{Gross} \rightarrow \text{Overall Discount} \rightarrow \text{Discounted} + \text{Charges} + \text{GST} \rightarrow \text{Total}$. | Calculating GST on raw gross before discounts or charges. |
| 11 | **Cryptographic Session Integrity** | Server must verify HMAC/JWT signed `auth_token`. Raw `user_role` cookies must never be trusted. | Reading and acting on unverified `user_role` cookie in backend handlers. |
| 12 | **Action RBAC Gate** | Administrative actions (`APPROVE`, `REJECT`) require verified `SUPER_ADMIN` role. | Permitting non-admin roles to approve or reject commercial transactions. |

---

## 2. Performance Architecture Audit Checklist

| Performance Check | Target Standard | Anti-Pattern to Reject |
|---|---|---|
| **Data Fetch Waterfall** | Table routes must render initial page-1 data via Server Components during SSR. | `'use client'` page mounting empty with a full-screen loading spinner while waiting for `useEffect`. |
| **Query Concurrency** | Independent database calls must execute concurrently via `Promise.all([ ... ])`. | Chaining independent `await prisma.<model>...` calls sequentially. |
| **Relation Scoping** | Only select essential fields; use `_count` for lengths. | `include: { jobOrders: true }` solely to calculate array lengths or sums. |
| **Route Transitions** | Internal links must include `prefetch={true}`. | Bare `<a>` tags or `<Link>` without prefetching on main navigation. |
| **KPI Caching** | Aggregate statistics must use a 30-second in-memory micro-cache. | Scanning the whole table on every single HTTP GET request. |

---

## 3. Automated Audit Execution Procedure

When asked to audit a file or module:

1. **Step 1: String & Pattern Scan**
   - Check all new/modified `.tsx`, `.ts`, and `.css` files for `—` ("them dashes").
   - Search for dimension regex `\b\d+\s*[xX*×]\s*\d+\s*[xX*×]\s*\d+\b` and ensure it is formatted with `L B H`.
   - Check Tailwind classes on selected elements for `bg-orange-500` (must be `bg-black` or `bg-slate-900`).

2. **Step 2: Typecheck & Schema Validation**
   - Execute the verification gate:
     ```bash
     npm run verify
     ```
   - Must return exit code 0 with 0 errors.

3. **Step 3: Verification Report Generation**
   - Output an Audit Scorecard with:
     - `STATUS`: **PASS** or **FAIL (Remediation Required)**
     - List of violations with exact file paths and line numbers.
     - Concrete code fix for each violation.
