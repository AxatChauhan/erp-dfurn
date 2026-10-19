---
trigger:
  glob: "prisma/**,src/app/api/**,src/lib/prisma.ts"
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
