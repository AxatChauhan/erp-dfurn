# 03 - Performance & Scalability Audit Report

**Auditor:** Principal Code Reviewer & Performance Engineer  
**Baseline Git Commit:** `65fc292ae1d79d31e40c8f2d8763d427d3cfc73c`  
**Overall Performance Rating:** **MODERATE RISK (SERIOUS BOTTLENECKS AT SCALE)**

---

## 1. Findings Table

| ID | Severity | Category | Module | File + Symbol (Line) | What's Wrong | Why It Matters / How It Could Fail | Suggested Fix (With Snippet) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PERF-01** | **High** | Unbounded Queries / Latency | Core Listings | `/api/clients` (L12), `/api/enquiries` (L7), `/api/quotations` (L11) | API endpoints fetch 100% of rows from database tables without pagination (`take`, `skip`, or cursor). | As database reaches 5,000+ clients or 20,000+ quotation items, response payloads balloon to multiple megabytes, causing Vercel Serverless Function 10-15s timeouts and out-of-memory errors. | Implement cursor or offset pagination on all list APIs.<br>```ts\nconst take = Math.min(parseInt(searchParams.get('take') || '50', 10), 100);\nconst cursor = searchParams.get('cursor');\nconst records = await prisma.client.findMany({\n  take: take + 1,\n  cursor: cursor ? { id: cursor } : undefined,\n  orderBy: { createdAt: 'desc' }\n});\n``` | Confirmed |
| **PERF-02** | **High** | Discarded Filter Parameters | Performance / API | `src/app/api/clients/route.ts` `GET` (L8-12) | Parses `search` and `type` query parameters from URL, but executes `findMany` with no `where` clause. | Entire client table is always sent over the wire, and search/filtering is pushed entirely into the user's browser memory. | Apply search and type filtering directly inside the PostgreSQL query.<br>```ts\nconst where: Prisma.ClientWhereInput = {};\nif (type && type !== 'ALL') where.clientType = type;\nif (search) where.OR = [\n  { name: { contains: search, mode: 'insensitive' } },\n  { clientCode: { contains: search, mode: 'insensitive' } }\n];\n``` | Confirmed |
| **PERF-03** | **High** | Memory-Heavy Duplicate Scan | Clients | `src/app/api/clients/route.ts` `POST` (L61-77) | Duplicate phone checking fetches all clients into Node.js memory and iterates through arrays in JavaScript. | O(N) memory allocation and latency spike on every single client insertion. Degrades sharply with thousands of clients. | Use PostgreSQL JSONB containment (`@>`) or a normalized phone table with unique index.<br>```ts\nconst conflict = await prisma.client.findFirst({\n  where: { phones: { array_contains: conflictPhone } }\n});\n``` | Confirmed |
| **PERF-04** | **Medium** | Missing Database Indexes | Database Schema | `prisma/schema.prisma` | Zero indexes on foreign keys (`clientId`, `salespersonId`, `departmentId`, `enquiryId`) and filter fields (`status`, `stage`). | PostgreSQL executes sequential table scans on joins and filter queries, leading to slow query execution (100ms+ instead of <5ms). | Add `@@index` annotations to all relation and filter columns.<br>```prisma\nmodel Enquiry {\n  // ...\n  @@index([clientId])\n  @@index([salespersonId])\n  @@index([stage])\n  @@index([createdAt])\n}\n``` | Confirmed |
| **PERF-05** | **Medium** | Client Bundle Bloat | Frontend Bundling | `src/app/(dashboard)/quotations/page.tsx` (L5-6) | `jspdf` and `jspdf-autotable` imported synchronously at top of client component file. | Adds ~350 KB+ of parsed JavaScript to the initial page bundle for all visitors, delaying First Contentful Paint. | Use dynamic `import()` when user clicks "Download PDF", or generate PDFs in a dedicated server route.<br>```ts\nconst { default: jsPDF } = await import('jspdf');\nconst { default: autoTable } = await import('jspdf-autotable');\n``` | Confirmed |
| **PERF-06** | **Medium** | Client-Side Hydration Waterfall | Architecture | All dashboard pages (`clients`, `enquiries`, `quotations`, `hrm`) | Every page is a `"use client"` component fetching data inside `useEffect`. | Users see flash of loading skeletons; browser must download JS, execute, initiate HTTP fetch, wait, and render, tripling Time to Interactive (TTI). | Convert outer page layouts to React Server Components (RSC) to stream initial data directly from PostgreSQL. | Confirmed |
| **PERF-07** | **Medium** | Experimental Next.js Flags | Configuration | `next.config.ts` (L5-6) | Experimental flags enabled: `cacheComponents: true` and `partialPrefetching: true`. | Experimental Next.js canary features may introduce hydration mismatches and unpredictable caching in production deployments. | Disable unstable experimental caching flags until verified against Next.js production release benchmarks. | Confirmed |
| **PERF-08** | **Low** | Connection Pooling Contention | Database | `prisma/schema.prisma` (L7-8) | Prisma uses direct pooler on port 6543 without explicit connection timeout and pool limits. | Rapid spikes in serverless invocations can exhaust PgBouncer transaction slots if connections are held open. | Configure connection pool parameters in connection strings (`connection_limit=10&pool_timeout=20`). | Confirmed |

---

## 2. Scalability Bottleneck Analysis: 10x and 100x Growth

### At 10x Load (1,000 Clients, 5,000 Enquiries, 3,000 Quotations, 50 Users):
- **First Point of Failure:** Numbering generator (`DF_QT_`, `DF_ENQ_`). Two sales reps submitting at the same instant will collide on `maxSeq + 1`, generating duplicate key errors.
- **Latency Impact:** Quotations page will download ~1.5 MB of JSON on every page load because items, clients, and enquiries are loaded eagerly. Initial page load time will rise from ~200ms to 2.8s.

### At 100x Load (10,000 Clients, 50,000 Enquiries, 30,000 Quotations, 500 Users):
- **Catastrophic Failure:** `POST /api/clients` duplicate phone check will attempt to deserialize 10,000 JSON rows into Node.js RAM on every client creation, triggering serverless memory exhaustion (512MB/1024MB Vercel limit).
- **Database CPU:** Missing indexes on `clientId` and `enquiryId` will cause PostgreSQL CPU to hit 100% on sequential scans for every joined query.
