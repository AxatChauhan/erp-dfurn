Execute the complete production-hardening implementation across the commercial pipeline (Clients, Enquiries, Quotations, and portable Self-Hosted Auth). Everything has already been planned; execute all file updates and terminal commands now in one run without stopping.

### SCOPE & CONSTRAINTS:
1. Focus EXCLUSIVELY on: `Clients`, `Enquiries`, `Quotations`, and `Auth/RBAC`. Do NOT modify HRM, Inventory, or any other modules.
2. ZERO DEPENDENCY on Supabase Auth. Use self-hosted, portable JWT auth (`jose` + `bcryptjs` + HTTP-only cookies) so the system runs on any standard VPS, Docker, or PostgreSQL database.
3. Keep all existing UI, styling, and business rules 100% intact.

---

### TERMINAL COMMANDS (RUN IN SEQUENCE):
```bash
npm install jose bcryptjs && npm install -D @types/bcryptjs
npx prisma db push
npx prisma generate
npx tsc --noEmit
npm run build
```

---

### COMPLETE CODE SPECIFICATIONS & FILE TARGETS:

#### 1. Add SequenceCounter Model to `prisma/schema.prisma`
Add this model to `prisma/schema.prisma` and run `npx prisma db push`:
```prisma
model SequenceCounter {
  id        String   @id
  lastSeq   Int      @default(0)
  updatedAt DateTime @updatedAt
}
```

#### 2. Create `src/lib/auth.ts` (Portable Signed JWT & Passwords)
Create `src/lib/auth.ts`:
```typescript
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dfurn-erp-secure-production-jwt-secret-key-32chars!'
);

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return await bcrypt.compare(password, hashed);
}

export async function signSessionToken(payload: { userId: string; role: string; name: string }): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<{ userId: string; role: string; name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: string; role: string; name: string };
  } catch {
    return null;
  }
}

export async function getCurrentSession(): Promise<{ userId: string; role: string; name: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}
```

#### 3. Update `src/app/api/auth/login/route.ts` & `src/middleware.ts`
- In `src/app/api/auth/login/route.ts`:
  - Remove all in-memory hardcoded accounts (`BUILTIN_FALLBACKS: admin/admin123`).
  - Query DB `prisma.user.findFirst`. Verify password using `verifyPassword`. If user password in DB is unhashed legacy text and matches, update DB with `await hashPassword(password)` for auto-migration.
  - Sign JWT using `await signSessionToken({ userId: user.id, role: user.role, name: user.name })`.
  - Set `auth_token` as HTTP-only, SameSite=Lax cookie. Set informational `user_role`, `user_name`, `user_id` cookies for frontend UI read hints.
- In `src/middleware.ts`:
  - Import `jwtVerify` from `'jose'`.
  - Validate `auth_token` cryptographically using `JWT_SECRET`.
  - If token is invalid/missing on API paths (`/api/...`), return `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` instead of a 307 redirect to `/login`.

#### 4. Create `src/lib/sequences.ts` (Atomic Locking Engine)
Create `src/lib/sequences.ts` to eliminate race conditions (`P2002`) under concurrent creates:
```typescript
import { prisma } from '@/lib/prisma';

export async function getNextAtomicSequence(counterKey: string, initialSeq: number = 0): Promise<number> {
  return await prisma.$transaction(async (tx) => {
    const result = await tx.$queryRaw<{ lastSeq: number }[]>`
      INSERT INTO "SequenceCounter" ("id", "lastSeq", "updatedAt")
      VALUES (${counterKey}, GREATEST(1, ${initialSeq} + 1), NOW())
      ON CONFLICT ("id") DO UPDATE
      SET "lastSeq" = "SequenceCounter"."lastSeq" + 1, "updatedAt" = NOW()
      RETURNING "lastSeq";
    `;
    return result[0].lastSeq;
  });
}
```

#### 5. Hardening `src/app/api/clients/route.ts` & `src/app/api/clients/[id]/route.ts`
- **Fix `take: 200` Phone Bug in `src/app/api/clients/route.ts`**:
  - Remove `prisma.client.findMany({ take: 200 })`.
  - Query all active clients or perform direct SQL search to check if normalized phone is in `phones` JSON array. Return `409 Conflict` if duplicate phone found.
- **Atomic Client Code**:
  - In `generateNextClientCode(mode: 'B2B' | 'B2C')`, replace `findMany` sequence parse with:
    `const nextSeq = await getNextAtomicSequence("CLIENT_" + mode);`
    `return "DF/C/" + mode + "/" + String(nextSeq).padStart(5, '0');`
- **Soft Delete in `src/app/api/clients/[id]/route.ts`**:
  - In `DELETE`, perform soft delete `await prisma.client.update({ where: { id }, data: { isActive: false } })` instead of hard delete, preserving relational links and preventing FK cascade errors.

#### 6. Hardening `src/app/api/enquiries/route.ts`
- **IST Timezone & Atomic Code**:
  - Format date parts with `timeZone: 'Asia/Kolkata'` using `Intl.DateTimeFormat` so codes between 12:00 AM and 5:30 AM IST do not get yesterday's UTC date.
  - In `generateNextEnquiryCode()`, fetch `nextSeq = await getNextAtomicSequence("ENQ_" + codeDate)`. Format as `DF_ENQ_${codeDate}_${String(nextSeq).padStart(2, '0')}` (3+ digits if `nextSeq >= 100`).
- **SQL-Level Pagination in `GET /api/enquiries`**:
  - Push `stage`, `outcome`, `salespersonId`, and `search` filters down into Prisma's `where` query.
  - Implement `take` and `skip` using query params `page` (default 1) and `limit` (default 50). Do not load the entire database into Node.js memory.
- **Targeted Intake Phone Deduplication**:
  - In `POST /api/enquiries`, remove full-table client scan. Execute targeted lookup for existing clients matching the normalized phone number.

#### 7. Hardening `src/app/api/quotations/...` & `src/lib/quotations/quoteService.ts`
- **Server RBAC in `src/app/api/quotations/[id]/action/route.ts`**:
  - Verify session via `await getCurrentSession()`.
  - On `action === 'APPROVE'`, enforce:
    `if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });`
  - Populate `approvedById: session.userId` and `approvedByName: session.name` strictly from verified token.
- **Transactional Versioning in `src/app/api/quotations/[id]/route.ts`**:
  - Wrap version superseding, new version creation, and parent `Quotation.currentVersionNo` update inside `prisma.$transaction(async (tx) => { ... })`.
- **Atomic Quote Numbering in `src/lib/quotations/quoteService.ts`**:
  - In `nextQuoteNumber()`, fetch `nextSeq = await getNextAtomicSequence("QUOTE_" + fiscalYear)`. Format as `DF/Q/${fiscalYear}/${String(nextSeq).padStart(4, '0')}`.
- **Two-Decimal Financial Precision**:
  - Enforce `round2(n) = Math.round((Number(n) + Number.EPSILON) * 100) / 100` across all item totals and 18% GST calculations.

---

### EXECUTION CHECKLIST:
Execute all changes, run `npx prisma db push && npx prisma generate && npx tsc --noEmit && npm run build`, and confirm all builds pass with 0 errors.
