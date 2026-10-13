# ERP-DFurn: Comprehensive Code Review, Security Audit & Production-Readiness Assessment

**Review Baseline (Git Commit):** `65fc292ae1d79d31e40c8f2d8763d427d3cfc73c`  
**Review Date:** October 12, 2026  
**Auditor:** Principal Code Reviewer, Security Auditor & Production-Readiness Assessor  
**Audit Scope:** Full repository, database schema, API route handlers, authentication/RBAC, frontend components, configuration, compliance, and infrastructure.  
**Groups Audited:** All Groups Completed (Group 1: A+B, Group 2: C+D, Group 3: E through I).

---

## 1. Executive Summary & Verdict

### Production Go / No-Go Verdict
> [!CAUTION]
> **VERDICT: HARD NO-GO FOR PRODUCTION DEPLOYMENT**  
> Under no circumstances should this application be deployed to production or exposed to external users or real client/employee data in its current state. Multiple critical security vulnerabilities allow complete authentication bypass, privilege escalation to `SUPER_ADMIN`, plaintext credential theft, unauthorized data destruction, and unrestricted harvesting of sensitive employee financial and identity PII (Aadhaar, PAN, bank accounts).

---

## 2. Review Metrics & Finding Breakdown

| Severity | Count | Summary of Risk Level |
| :--- | :---: | :--- |
| **CRITICAL** | **8** | Immediate exploitability; complete auth bypass; plaintext passwords; backdoor admin; data destruction; PII leak. |
| **HIGH** | **11** | Concurrency race conditions in document numbering; un-transactional item deletion; client-side price tampering; missing RLS; lack of server-side pagination. |
| **MEDIUM** | **14** | Missing indexes on foreign keys; memory-heavy table scans; WCAG AA contrast failures; floating-point money calculations; documentation drift. |
| **LOW** | **8** | Typo in CSS utility class (`₹{...}`); missing HTTP security headers; unpinned dependency versions; lack of soft deletion. |
| **INFO / GAP** | **6** | Complete absence of Catalog/Products module; missing automated test suite; missing Sentry error monitoring; missing multi-tenant `companyId`. |
| **TOTAL** | **47** | **System requires comprehensive remediation before go-live.** |

---

## 3. Top 10 Production-Blocking Issues

1. **[SEC-01] Hardcoded Backdoor & Plaintext Password Storage (`src/app/api/auth/login/route.ts` L14-25)**  
   Hardcoded fallback creates an active `SUPER_ADMIN` with credentials `admin` / `admin`. All passwords across the entire system are stored in plaintext in PostgreSQL and evaluated using `user.password === password`.
2. **[SEC-02] Complete Authentication Bypass in Edge Middleware (`src/middleware.ts` L5-11)**  
   Edge middleware only checks whether the cookie `auth_token` is present. It performs zero signature, JWT, or database validation. Supplying any cookie string (e.g. `Cookie: auth_token=bypass`) allows full unauthenticated access to the entire application.
3. **[SEC-03] Universal Absence of Server-Side Auth on API Routes (`src/app/api/...`)**  
   Every API route (`/api/clients`, `/api/clients/[id]`, `/api/enquiries`, `/api/enquiries/[id]`, `/api/users`, `/api/hrm/*`) completely lacks server-side session, token, or permission checks. Any caller can execute arbitrary GET, POST, PUT, and DELETE operations.
4. **[SEC-04] Client-Controlled Privilege Escalation to `SUPER_ADMIN` (`src/app/api/quotations/route.ts` L27, `src/app/api/quotations/[id]/route.ts` L10)**  
   Quotation approval logic reads `user_role` directly from an unsigned client cookie. Setting `document.cookie = 'user_role=SUPER_ADMIN'` grants any user full superadmin approval power. Furthermore, `POST /api/users` has zero authentication and allows anyone to create `SUPER_ADMIN` accounts.
5. **[SEC-05] Unrestricted Leak of Employee Identity & Financial PII (`src/app/api/hrm/employees/route.ts` L114-126)**  
   `GET /api/hrm/employees` returns Aadhaar numbers, PAN numbers, bank account numbers, IFSC codes, and base salary figures for all employees with zero authentication or role filtering.
6. **[COR-01] Permanent Data Loss via Non-Transactional Deletion (`src/app/api/quotations/[id]/route.ts` L21, `src/app/api/enquiries/[id]/route.ts` L87)**  
   When updating quotations or enquiries, line items are deleted with `deleteMany` outside of a database transaction. If the subsequent `update` fails, all line items are permanently lost.
7. **[COR-02] Concurrency Race Condition & O(N) Table Scans in Document Numbering (`/api/quotations`, `/api/enquiries`, `/api/clients`, `/api/hrm/employees`)**  
   Every sequence generator (`DF_QT_`, `DF_ENQ_`, `DF_CL_`, `HR-`) executes an unbounded `findMany` across the entire database table and computes `maxSeq + 1` in JavaScript memory. Concurrent requests generate identical numbers, resulting in 500 crash collisions.
8. **[COR-03] Unsafe Database Mutations inside HTTP GET Handlers (`src/app/api/enquiries/route.ts` L28-38, `src/app/api/clients/route.ts` L29-37)**  
   Calling `GET /api/enquiries` or `GET /api/clients` triggers sequential database writes (`prisma.update`) to backfill IDs, violating HTTP GET idempotency and creating race conditions during concurrent page loads.
9. **[PERF-01] Missing Server-Side Pagination & Unbounded Memory Loading (`/api/clients`, `/api/enquiries`, `/api/quotations`)**  
   All core listings fetch all records without `limit`, `take`, or `cursor`. Query parameters `search` and `type` are parsed in `/api/clients` but completely discarded, pushing filtering to the client browser.
10. **[ARCH-01] Zero Database Migrations & Supabase Architecture Drift (`prisma/schema.prisma`)**  
    The repository has no `prisma/migrations` directory; changes are applied manually via `db push`. The system design document claims Supabase Auth and Row Level Security (RLS) are in place, but the code uses direct Prisma connection poolers with superuser privileges, completely bypassing RLS.

---

## 4. Notable Architectural Strengths

While the system is not yet production-ready, several foundational aspects are well executed:
- **Relational Domain Integrity:** Shifting from the legacy Firestore NoSQL model to PostgreSQL and Prisma has correctly structured complex manufacturing relationships (e.g. Enquiries to Quotations with cascaded line items).
- **TypeScript Strictness:** Strict typing is enabled in `tsconfig.json`, and `npx tsc --noEmit` compiles cleanly with zero type errors.
- **High-Utility Domain Helpers:** Modules such as `src/lib/clientUtils.ts` (GSTIN regex parsing, PAN extraction, state mapping, phone normalization) and `src/lib/enquiryUtils.ts` (lead aging calculation, status synchronization) show strong domain alignment.
- **Modern Clean UI Aesthetics:** The Tailwind CSS interface is modern, clean, responsive, and tailored to factory and office workflows.
