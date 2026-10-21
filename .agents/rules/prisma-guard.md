---
trigger: glob
globs: "prisma/**,src/app/api/**,src/lib/prisma.ts"
description: "Prisma & Database Query Performance Rules"
---

# Prisma & Database Query Performance Rules

1. **Mandatory Pagination**:
   - Never write an unpaginated `findMany()` on core tables (Clients, Quotations, Enquiries, Attendance).
   - Always enforce `take: limit` and `skip: offset`.

2. **Concurrent Query Execution**:
   - Never chain independent database calls with sequential `await`. Always group them in `Promise.all([ ... ])`.

3. **No Over-Fetching Relations**:
   - Never use `include: { jobOrders: true }` or deep relations solely to calculate array lengths or sums.
   - Use Prisma's `_count: { select: { ... } }` or targeted aggregation queries.

4. **Hardened Singleton**:
   - In serverless / API routes, always import `prisma` from `@/lib/prisma`. Never instantiate `new PrismaClient()` inside a handler.

5. **Index All Filter Columns**:
   - Any column used in `where`, `orderBy`, or relation foreign keys must have an `@@index` in `prisma/schema.prisma`.

6. **Atomic Sequential Identifiers & Conflict Resilience**:
   - Sequential human-readable business codes (`DF/C/...`, `DF/Q/...`, `DF_ENQ_...`) must never rely on unprotected in-memory scans.
   - Code generation MUST be guarded with collision retry loops or database-level transactions so concurrent inserts never crash with unhandled `P2002` 500 errors.

7. **Multi-Environment Migration Discipline**:
   - Before any deployment to Vercel production:
     1. All target database environments (Vercel production DB, staging DB, local `.env`) must be synchronized with `prisma db push` or migrations.
     2. Production serverless regions must match the physical database region (`bom1` for Mumbai).

