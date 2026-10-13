# 01 - Security Audit Report

**Auditor:** Principal Code Reviewer & Security Auditor  
**Baseline Git Commit:** `65fc292ae1d79d31e40c8f2d8763d427d3cfc73c`  
**Overall Security Rating:** **CRITICAL RISK (IMMEDIATE REMEDIATION REQUIRED)**

---

## 1. Threat Model & Attacker Profiles

Before assessing specific code lines, we establish the threat landscape for this manufacturing ERP:
1. **Unauthenticated External Attacker:** Can access internet-facing Next.js endpoints hosted on Vercel. Goal: Steal employee identity details, compromise database, or deface operational records.
2. **Malicious or Untrusted Employee (Sales Rep / Clerk):** Has valid low-privilege credentials (`SALES`). Goal: Approve own quotations, alter discount margins, view proprietary cost data, or create backdoor admin users.
3. **Careless AI Agent / Automated Script:** Generates insecure boilerplate or hardcoded credentials during iterative development without security guardrails.

---

## 2. Security Findings Table

| ID | Severity | Category | Module | File + Symbol (Line) | What's Wrong | Why It Matters / How It Could Be Exploited | Suggested Fix (With Snippet) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **Critical** | Authentication / Secrets | Auth | `src/app/api/auth/login/route.ts` `POST` (L13-23) | Hardcoded backdoor account creation for `admin` / `admin`. | Anyone who enters username `admin` and password `admin` triggers automatic creation of a `SUPER_ADMIN` account in the live database. | Remove hardcoded fallback entirely. Seed initial accounts via a secure, one-time CLI script with hashed credentials.<br>```ts\n// REMOVE:\n// if (!user && username === 'admin' && password === 'admin') { ... }\n``` | Confirmed |
| **SEC-02** | **Critical** | Cryptography / Data Protection | Auth | `src/app/api/auth/login/route.ts` `POST` (L25), `src/app/api/users/route.ts` `POST` (L20), `prisma/schema.prisma` `User.password` (L15) | Passwords stored and verified in plaintext (`user.password === password`). | Database leaks or SQL inspection immediately compromise all accounts. Comment in code explicitly states `// In a real app, hash this!`. | Use `argon2` or `bcrypt` with salt rounds >= 12.<br>```ts\nimport bcrypt from 'bcryptjs';\n// Storing:\nconst hashedPassword = await bcrypt.hash(body.password, 12);\n// Verifying:\nconst isValid = await bcrypt.compare(password, user.password);\n``` | Confirmed |
| **SEC-03** | **Critical** | Broken Authentication | Middleware | `src/middleware.ts` `middleware` (L4-18) | Edge middleware only checks cookie presence (`if (!token)`), without validating cryptographic signature, JWT, or database session. | An attacker can set `Cookie: auth_token=bypass` to gain entry to all protected dashboard routes and API endpoints. | Implement signed JWT or Supabase Auth session token verification in middleware.<br>```ts\nimport { verifyJWT } from '@/lib/auth';\nexport async function middleware(req: NextRequest) {\n  const token = req.cookies.get('auth_token')?.value;\n  if (!token || !await verifyJWT(token)) {\n    return NextResponse.redirect(new URL('/login', req.url));\n  }\n}\n``` | Confirmed |
| **SEC-04** | **Critical** | Broken Object / Function Auth | All API Routes | `src/app/api/...` (All route handlers) | Zero server-side authentication verification in route handlers (`/api/clients`, `/api/enquiries`, `/api/quotations`, `/api/hrm/*`, `/api/users`). | If edge middleware is bypassed or direct API calls are made, every route executes with database superuser rights anonymously. Middleware redirect returns 307 HTML instead of 401 JSON. | Add a reusable server-side session guard helper that validates token and extracts authenticated user/role on every API request.<br>```ts\nconst session = await getAuthenticatedUser(req);\nif (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });\n``` | Confirmed |
| **SEC-05** | **Critical** | Privilege Escalation / Tampering | RBAC | `src/app/api/quotations/route.ts` `POST` (L27), `src/app/api/quotations/[id]/route.ts` `PUT` (L10) | API trusts client-provided `user_role` cookie without server validation. | A sales rep can edit their local cookie (`document.cookie = 'user_role=SUPER_ADMIN'`) and directly approve their own quotations. | Never read permissions from client-editable cookies. Store role in signed session JWT or query user role from DB using verified user ID.<br>```ts\nconst user = await prisma.user.findUnique({ where: { id: session.userId } });\nif (user.role !== 'SUPER_ADMIN') { /* reject */ }\n``` | Confirmed |
| **SEC-06** | **Critical** | Privilege Escalation | RBAC / Users | `src/app/api/users/route.ts` `POST` (L14-25) | `POST /api/users` has zero authentication or role validation. | Any anonymous caller can send `{"name": "Attacker", "username": "badactor", "password": "123", "role": "SUPER_ADMIN"}` to create an unmonitored superadmin account. | Enforce that only authenticated `SUPER_ADMIN` users can create new accounts.<br>```ts\nconst session = await requireSuperAdmin(req);\nif (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });\n``` | Confirmed |
| **SEC-07** | **Critical** | PII / Financial Data Exposure | HRM | `src/app/api/hrm/employees/route.ts` `GET` (L47), `src/app/api/hrm/employees/[id]/route.ts` `GET` (L26) | Full banking and identity PII (Aadhaar, PAN, Bank Account, IFSC, Salary) exposed without authentication or role scoping. | Violates India's DPDP Act and basic security. Anyone on the network can view employee financial data. | Strip sensitive PII fields unless the caller is verified `SUPER_ADMIN` or HR Manager.<br>```ts\nconst safe = employees.map(e => ({ id: e.id, name: e.name, department: e.department, employeeCode: e.employeeCode }));\n``` | Confirmed |
| **SEC-08** | **Critical** | Unauthorized Data Destruction | HRM | `src/app/api/hrm/employees/[id]/route.ts` `DELETE` (L83-118) | Unauthenticated hard deletion via `?hard=true` deletes employees and cascades destruction of all biometric punches. | An unauthenticated attacker can wipe out employee master records and compliance punch logs. | Require `SUPER_ADMIN` authentication, prohibit hard deletes of audited employees, and enforce soft-deletion (`isActive = false`). | Confirmed |
| **SEC-09** | **High** | Session Management | Auth | `src/app/api/auth/login/route.ts` `POST` (L27-30) | Predictable session token (`token-${user.id}`) and insecure cookie flags (`httpOnly: false` on `user_role`, no `secure`, no `sameSite`). | Tokens are easily forged if user IDs are discovered. XSS scripts can read and modify `user_role` and `user_name` cookies. | Use cryptographically signed session tokens with strict cookie security flags.<br>```ts\ncookieStore.set('auth_token', signedJwt, {\n  httpOnly: true,\n  secure: process.env.NODE_ENV === 'production',\n  sameSite: 'lax',\n  path: '/',\n  maxAge: 60 * 60 * 8 // 8 hours\n});\n``` | Confirmed |
| **SEC-10** | **High** | Injection / Validation | Core API | All route handlers (`req.json()`) | Absence of server-side schema validation (Zod) on incoming mutation payloads. | Malformed payloads, SQL-breaking types, or unexpected fields are passed directly into Prisma queries. | Enforce Zod validation schemas on all POST and PUT request bodies.<br>```ts\nconst createQuoteSchema = z.object({ clientId: z.string().uuid(), items: z.array(...) });\nconst data = createQuoteSchema.parse(await req.json());\n``` | Confirmed |
| **SEC-11** | **High** | Mass Assignment | Sales | `src/app/api/enquiries/route.ts` `POST` (L99-102) | Clients can supply arbitrary `enteredById` and `salespersonId`. | Allows users to impersonate other employees as lead creators or sales owners. | Server must assign `enteredById` strictly from the verified session identity.<br>```ts\nenteredById: session.userId,\nenteredByName: session.userName\n``` | Confirmed |
| **SEC-12** | **High** | Financial Integrity / Price Tampering | Quotations | `src/app/api/quotations/route.ts` `POST` (L63-65), `PUT` (L29) | Accepts client-supplied `totalAmount` instead of calculating from line items on server. | Malicious client can manipulate `totalAmount` to ₹1.00 regardless of item prices. | Always recompute line-item totals and quotation grand total on the server.<br>```ts\nconst totalAmount = rawItems.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unitPrice)), 0);\n``` | Confirmed |
| **SEC-13** | **High** | Information Disclosure | Core Logging | `src/lib/prisma.ts` (L8) | Prisma query logger enabled (`log: ['query']`). | In production, every database query (including passwords, PII, and financial quotes) is emitted to server logs. | Disable raw query logging in production.<br>```ts\nlog: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']\n``` | Confirmed |
| **SEC-14** | **Medium** | Transport Security | Headers | `next.config.ts` | Zero security headers configured (missing CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). | Leaves application vulnerable to clickjacking, MIME sniffing, and cross-site framing. | Add standard security headers in `next.config.ts`.<br>```ts\nheaders: async () => [{\n  source: '/(.*)',\n  headers: [\n    { key: 'X-Frame-Options', value: 'DENY' },\n    { key: 'X-Content-Type-Options', value: 'nosniff' },\n    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }\n  ]\n}]\n``` | Confirmed |
| **SEC-15** | **Medium** | Rate Limiting / Abuse Protection | Auth / API | All endpoints | Zero rate limiting on login or public endpoints. | Vulnerable to credential stuffing, brute-force attacks, and denial of service. | Implement Upstash Redis or Vercel Edge rate limiting on `/api/auth/login` and mutation routes. | Confirmed |
| **SEC-16** | **Medium** | Supply Chain | Dependencies | `package.json` (`braces`, `fast-glob`) | `npm audit` reports 5 high severity vulnerabilities in build toolchain (`GHSA-vfj7-8cjw-p6xm`). | Stack-exhaustion denial of service during build or pattern processing. | Update devDependencies or run selective overrides in package.json to patch vulnerable transitive dependencies. | Confirmed |

---

## 3. Detailed Exploit Walkthroughs

### Exploit 1: Anonymous SuperAdmin Takeover
1. Attacker opens an API client (e.g. cURL, Postman).
2. Attacker sends:
   ```bash
   curl -X POST https://target-app.vercel.app/api/users \
     -H "Content-Type: application/json" \
     -d '{"name":"Rogue Admin","username":"rogue","password":"Password123!","role":"SUPER_ADMIN"}'
   ```
3. Endpoint responds `200 OK` with created user ID.
4. Attacker signs in with `rogue` / `Password123!` and possesses full administrative control.

### Exploit 2: Self-Approval of Heavily Discounted Quotations
1. A sales representative logs in with valid `SALES` credentials.
2. The representative creates a quotation for a commercial order worth ₹50,00,000, setting `totalAmount: 50000`.
3. The representative opens browser developer tools and executes:
   ```javascript
   document.cookie = "user_role=SUPER_ADMIN; path=/";
   ```
4. The representative clicks "Approve Quotation" in the UI.
5. The request hits `PUT /api/quotations/[id]`. The endpoint checks `cookieStore.get('user_role')?.value`, finds `SUPER_ADMIN`, and permanently commits status `APPROVED`.
