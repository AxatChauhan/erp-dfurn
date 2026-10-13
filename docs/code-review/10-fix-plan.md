# 10 - Ordered Remediation Plan (Fix Plan)

**Auditor:** Principal Code Reviewer & Security Auditor  
**Baseline Git Commit:** `65fc292ae1d79d31e40c8f2d8763d427d3cfc73c`  
**Execution Strategy:** Multi-phase remediation ordered strictly by production criticality.

---

## Phase 0: Blocks Production (Immediate P0 Pre-Requisites)
*Deploying to production or inviting real users is prohibited until 100% of these items are resolved.*

| Phase | Finding ID | Remediation Task Description | Suggested File / Area | Effort | Assigned Module Owner |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **P0** | **SEC-01** | Remove hardcoded `admin/admin` backdoor creation in login handler. | `src/app/api/auth/login/route.ts` | **S** | Auth Agent |
| **P0** | **SEC-02** | Implement bcrypt / argon2 password hashing. Hash all existing user passwords. | `src/app/api/auth/login/route.ts`, `src/app/api/users/route.ts` | **M** | Auth Agent |
| **P0** | **SEC-03** | Fix Edge Middleware to cryptographically verify signed JWT tokens instead of merely checking cookie existence. | `src/middleware.ts` | **M** | Auth Agent |
| **P0** | **SEC-04** | Implement server-side authentication and role guard helper on ALL `/api/...` route handlers. Return 401 Unauthorized for invalid sessions. | `src/lib/auth.ts`, All API routes | **L** | Backend Core Agent |
| **P0** | **SEC-05** | Eliminate client-controlled `user_role` cookie trust. Read verified role strictly from authenticated session token or DB. | `src/app/api/quotations/route.ts`, `[id]/route.ts` | **S** | Quotations Agent |
| **P0** | **SEC-06** | Restrict `POST /api/users` and `GET /api/users` exclusively to verified `SUPER_ADMIN` sessions. | `src/app/api/users/route.ts` | **S** | Auth Agent |
| **P0** | **SEC-07** | Strip employee identity (Aadhaar, PAN) and banking records from public `GET /api/hrm/employees` API; restrict to authorized HR roles. | `src/app/api/hrm/employees/route.ts` | **S** | HRM Agent |
| **P0** | **COR-01** | Wrap quotation item deletion and quotation update within an atomic `prisma.$transaction`. | `src/app/api/quotations/[id]/route.ts` | **S** | Quotations Agent |
| **P0** | **COR-02** | Wrap enquiry item deletion and enquiry update within an atomic `prisma.$transaction`. | `src/app/api/enquiries/[id]/route.ts` | **S** | Enquiries Agent |
| **P0** | **COR-03** | Replace full-table memory scans for sequential IDs (`DF_QT_`, `DF_ENQ_`, `DF_CL_`, `HR-`) with atomic PostgreSQL sequences or locked counter table. | All sequence generators | **M** | Database Agent |
| **P0** | **COR-04** | Remove database update side-effects from HTTP `GET` handlers in `/api/enquiries` and `/api/clients`. | `src/app/api/enquiries/route.ts`, `clients/route.ts` | **S** | CRM Agent |
| **P0** | **OPS-01** | Initialize formal versioned migrations directory (`prisma/migrations`) and integrate `prisma migrate deploy` into CI/Vercel build. | `prisma/migrations` | **M** | DevOps Agent |

---

## Phase 1: Before Scaling (P1 Scalability & Security Hardening)
*Required before scaling beyond the initial pilot phase or taking more than 5 concurrent sales reps.*

| Phase | Finding ID | Remediation Task Description | Suggested File / Area | Effort | Assigned Module Owner |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **P1** | **PERF-01** | Add server-side cursor/offset pagination to `GET /api/clients`, `/api/enquiries`, and `/api/quotations`. | Core API route handlers | **M** | Backend Core Agent |
| **P1** | **PERF-02** | Wire up `search` and `type` query parameters into Prisma database `where` clauses instead of discarding them. | `src/app/api/clients/route.ts` | **S** | Clients Agent |
| **P1** | **PERF-04** | Add composite indexes (`@@index`) on all foreign key columns and frequently filtered columns (`clientId`, `salespersonId`, `stage`, `status`). | `prisma/schema.prisma` | **S** | Database Agent |
| **P1** | **COR-05** | Lock `APPROVED` quotations against direct modification. Require creating a new revision (`_R1`) or invalidating status back to `DRAFT`. | `src/app/api/quotations/[id]/route.ts` | **M** | Quotations Agent |
| **P1** | **COR-06** | Migrate all financial `Float` columns in Prisma schema to `Decimal(12, 2)` for exact currency arithmetic. | `prisma/schema.prisma` | **M** | Database Agent |
| **P1** | **SEC-09** | Enforce `httpOnly`, `secure`, and `sameSite: 'lax'` on all authentication cookies with signed JWT payload. | `src/app/api/auth/login/route.ts` | **S** | Auth Agent |
| **P1** | **SEC-10** | Implement Zod request payload validation schemas on all mutation routes. | All API routes | **M** | Backend Core Agent |
| **P1** | **SEC-14** | Configure standard HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) in `next.config.ts`. | `next.config.ts` | **S** | DevOps Agent |
| **P1** | **SEC-15** | Implement rate limiting on `/api/auth/login` and mutation routes using Upstash or Vercel KV. | `src/middleware.ts` | **M** | DevOps Agent |
| **P1** | **TEST-01** | Establish automated unit and integration test suite using Vitest (covering auth, RBAC, and quotation calculations). | `tests/` | **L** | QA Agent |
| **P1** | **OPS-03** | Integrate `@sentry/nextjs` for serverless exception monitoring and real-time alerts. | Project Root | **M** | DevOps Agent |

---

## Phase 2: Before Adding Next Module (P2 Architectural Modularization)
*Required before developing Inventory, Cutting Stock Optimizer, or Production modules.*

| Phase | Finding ID | Remediation Task Description | Suggested File / Area | Effort | Assigned Module Owner |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **P2** | **COR-07** | Implement the missing Catalog module: `Category`, `Product`, and `Variant` models with customizable dimensions and materials. | `prisma/schema.prisma`, `/catalog` | **L** | Catalog Agent |
| **P2** | **ARCH-01** | Refactor massive "God Components" (`enquiries/page.tsx`, `quotations/page.tsx`, `clients/page.tsx`) into modular component directories. | `src/components/sales/` | **L** | Frontend UI Agent |
| **P2** | **FUT-01** | Add multi-branch / multi-tenant foundation (`companyId`, `branchId`) to master entity tables. | `prisma/schema.prisma` | **M** | Database Agent |
| **P2** | **FUT-02** | Transition from 2 flat roles to granular permission capabilities (`can_approve_quote`, `can_view_payroll`). | Auth & RBAC | **L** | Auth Agent |
| **P2** | **FUT-03** | Add `productId` and `variantId` links to `QuotationItem` and `EnquiryItem` to enable downstream BOM and cutting optimization. | `prisma/schema.prisma` | **M** | Quotations Agent |
| **P2** | **ARCH-02** | Reconcile and update `docs/SYSTEM_DESIGN.md` to perfectly match the implemented production architecture. | `docs/SYSTEM_DESIGN.md` | **S** | Documentation Agent |

---

## Phase 3: Nice to Have (P3 Polish & Enhancement)

| Phase | Finding ID | Remediation Task Description | Suggested File / Area | Effort | Assigned Module Owner |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **P3** | **ARCH-05** | Fix typo in `src/app/(dashboard)/users/page.tsx` line 73: replace `₹{...}` with standard `${...}`. | `src/app/(dashboard)/users/page.tsx` | **S** | Frontend UI Agent |
| **P3** | **UX-01** | Fix WCAG AA contrast ratio failure on login button (`bg-[#e3d7c5] text-white`). | `src/app/(auth)/login/page.tsx` | **S** | Frontend UI Agent |
| **P3** | **UX-02** | Add keyboard focus traps and Escape key dismissal to all form modals. | Form modal components | **M** | Frontend UI Agent |
| **P3** | **PERF-05** | Dynamically import `jspdf` on demand or offload PDF generation to a dedicated server route. | `src/app/(dashboard)/quotations/page.tsx` | **S** | Frontend UI Agent |
| **P3** | **DOC-01** | Rewrite `README.md` with full developer setup guide and environment variable dictionary. | `README.md` | **S** | Documentation Agent |
| **P3** | **DOC-02** | Remove dangerous `generate_docs.py` script to prevent accidental clobbering of system documentation. | Project Root | **S** | Documentation Agent |
