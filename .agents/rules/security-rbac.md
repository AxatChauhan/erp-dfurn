---
trigger: glob
globs: "src/middleware.ts,src/lib/auth.ts,src/app/api/**"
description: "Security & RBAC Protection Rules"
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

4. **Mandatory Action Role Authorization**:
   - Any endpoint performing sensitive state transitions (`APPROVE`, `REJECT`, `CANCEL`, `DELETE`, `ADMIN_OVERRIDE`) MUST check `session.role === 'SUPER_ADMIN'`.
   - Never assume authentication implies administrative authorization. Block unauthorized roles with `403 Forbidden`.

5. **Zero-Trust Client Cookies & Cryptographic Session Signatures**:
   - Client-facing cookies (`user_role`, `user_id`, `user_name`) are strictly for cosmetic UI convenience and MUST NEVER be trusted for server-side decisions.
   - All server-side authentication and role checks must decode and verify the cryptographically signed `auth_token` (HMAC-SHA256 / JWT).

6. **API Route Middleware Response Format**:
   - Middleware route protection for `/api/*` routes MUST return `401 Unauthorized` JSON (`{ error: 'Unauthorized' }`), NEVER a 307/308 HTML redirect.

