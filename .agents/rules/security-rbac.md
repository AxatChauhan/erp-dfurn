---
trigger:
  glob: "src/middleware.ts,src/lib/auth.ts,src/app/api/**"
---

# Security & RBAC Protection Rules

1. **Authentication Enforcement**:
   - All protected dashboard routes and mutating APIs must verify session tokens (`auth_token`, `user_role`) through `src/middleware.ts` or session cookies.
   - Passwords must be hashed with `bcryptjs` (salt rounds $\ge 10$). Never store or log plaintext passwords.
   - Tokens must be signed with secret key validation (`jose` HS256).

2. **Money Redaction (RBAC Permission)**:
   - Financial figures are protected by `*.viewValue` permissions (`clients.viewValue`, `quotes.viewValue`, `enquiries.viewValue`).
   - If unauthorized, values must return `null` with `valueHidden: true`, and the UI renders an en dash `–`.

3. **Zero SQL Injections**:
   - 100% of queries must pass through Prisma parameterized queries.
   - Never use raw SQL string interpolation.
