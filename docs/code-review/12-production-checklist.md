# 12 - Production Go-Live Checklist

**Project:** ERP-DFurn (Manufacturing & Sales ERP)  
**Assessor:** Principal Code Reviewer & Production-Readiness Assessor  
**Deployment Target:** Vercel (Edge & Serverless) + Supabase (PostgreSQL with PgBouncer)  
**Current Status:** 🔴 **BLOCKED (0 / 25 Passed)**

---

## 1. Security & Access Control (P0 Blockers)
- [ ] **SEC-01:** Hardcoded `admin/admin` creation logic removed from `src/app/api/auth/login/route.ts`.
- [ ] **SEC-02:** Password hashing with `bcrypt` / `argon2` enforced on all user accounts; plaintext comparisons removed.
- [ ] **SEC-03:** Edge middleware verifies signed JWT cryptographic tokens; arbitrary cookie values rejected.
- [ ] **SEC-04:** Server-side authentication and session validation enforced on EVERY `/api/...` route handler.
- [ ] **SEC-05:** Client-provided `user_role` cookie ignored; role retrieved strictly from verified server session.
- [ ] **SEC-06:** User creation (`POST /api/users`) restricted strictly to authenticated `SUPER_ADMIN` sessions.
- [ ] **SEC-07:** Employee identity (Aadhaar, PAN) and banking records stripped from unauthenticated/sales responses.
- [ ] **SEC-08:** Unauthenticated hard delete (`DELETE /api/hrm/employees?hard=true`) disabled.
- [ ] **SEC-09:** Session cookies configured with `httpOnly: true`, `secure: true`, and `sameSite: 'lax'`.
- [ ] **SEC-10:** HTTP Security Headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) configured in `next.config.ts`.
- [ ] **SEC-11:** Rate limiting implemented on `/api/auth/login` to prevent credential stuffing.

---

## 2. Business Logic & Transactional Integrity (P0 Blockers)
- [ ] **COR-01:** Quotation item deletion and quotation updates wrapped inside atomic `prisma.$transaction`.
- [ ] **COR-02:** Enquiry item deletion and enquiry updates wrapped inside atomic `prisma.$transaction`.
- [ ] **COR-03:** Document sequence numbers (`DF_QT_`, `DF_ENQ_`, `DF_CL_`, `HR-`) generated via PostgreSQL sequences or atomic locked counter tables (O(N) memory scans eliminated).
- [ ] **COR-04:** Database mutation side-effects removed from HTTP `GET` handlers in `/api/enquiries` and `/api/clients`.
- [ ] **COR-05:** Approved quotations locked against direct edits; approval status protected.
- [ ] **COR-06:** Financial fields in Prisma schema converted from `Float` to `Decimal(12, 2)`.

---

## 3. Performance & Infrastructure
- [ ] **PERF-01:** Server-side pagination (`limit`/`cursor`) implemented across all list endpoints.
- [ ] **PERF-02:** Client search parameters (`search`, `type`) wired directly into database `where` clauses.
- [ ] **PERF-03:** Composite database indexes added on all relation foreign keys and filter columns.
- [ ] **PERF-04:** Heavy client libraries (`jspdf`) dynamically imported or offloaded to server-side generation.
- [ ] **PERF-05:** Stable Next.js configuration verified; experimental caching flags evaluated.

---

## 4. DevOps, Observability & Disaster Recovery
- [ ] **OPS-01:** Formal versioned database migrations initialized in `prisma/migrations`; `prisma migrate deploy` added to deployment pipeline.
- [ ] **OPS-02:** Startup environment variable validation implemented with Zod.
- [ ] **OPS-03:** Sentry exception tracking integrated and verified with test error capture.
- [ ] **OPS-04:** Health check route (`/api/health`) created and monitored with external ping.
- [ ] **OPS-05:** Supabase Point-In-Time Recovery (PITR) enabled and restore runbook documented.
