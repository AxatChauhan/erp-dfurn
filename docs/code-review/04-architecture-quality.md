# 04 - Architecture & Code Quality Audit Report

**Auditor:** Principal Software Architect & Code Quality Assessor  
**Baseline Git Commit:** `65fc292ae1d79d31e40c8f2d8763d427d3cfc73c`  
**Overall Architecture Rating:** **NEEDS SUBSTANTIAL REFACTORING**

---

## 1. Findings Table

| ID | Severity | Category | Module | File + Symbol (Line) | What's Wrong | Why It Matters / How It Could Fail | Suggested Fix (With Snippet) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ARCH-01** | **High** | Code Organization / Modularity | Frontend | `src/app/(dashboard)/enquiries/page.tsx` (1,442 lines), `quotations/page.tsx` (1,107 lines), `clients/page.tsx` (878 lines) | Massive "God Components" combining page routing, Kanban boards, filter logic, modals, form validations, and PDF downloads in single files. | High cognitive complexity, impossible to maintain by multiple developers, high merge conflict frequency, and heavy bundle weight. | Extract modals, tables, and forms into dedicated sub-components under `src/components/sales/` and `src/components/enquiries/`. | Confirmed |
| **ARCH-02** | **High** | Architectural Drift | Documentation vs Code | `docs/SYSTEM_DESIGN.md` vs `prisma/schema.prisma` & APIs | Severe divergence between System Design Documentation and actual codebase: Employee fields diverge, attendance schema diverges, Supabase RLS is missing in code, bcrypt is missing in code. | Misleads engineering team and future builders on system capabilities, security model, and data contracts. | Synchronize `SYSTEM_DESIGN.md` with true architecture or update code to fulfill documented contracts. | Confirmed |
| **ARCH-03** | **Medium** | Type Safety / TypeScript | APIs & Components | All API routes and components | Overuse of `any` types: `(item: any)`, `(err: any)`, `updateData: any = {}`, `(c: any)`. | Bypasses TypeScript compile-time safety, hiding runtime bugs and property mismatches during refactoring. | Define shared domain types in `src/types/` and derive types from Prisma client or Zod schemas. | Confirmed |
| **ARCH-04** | **Medium** | Inconsistent API Contracts | API Design | All route handlers | Inconsistent response envelopes across endpoints: some return `{ error: string }`, some `{ success: boolean, message: string }`, some return raw arrays, some return objects. | Frontend fetch handlers must write bespoke error handling for every individual endpoint. | Implement a standardized response utility (`ApiResponse<T> = { data?: T, error?: string, success: boolean }`). | Confirmed |
| **ARCH-05** | **Low** | UI / Syntax Typo | Users Frontend | `src/app/(dashboard)/users/page.tsx` (L73) | String interpolation typo uses rupee symbol instead of dollar sign: `₹{u.role === 'SUPER_ADMIN' ? 'bg-purple-100...' : ...}`. | Tailwind CSS cannot parse `₹bg-purple-100`, resulting in unstyled role badges in the users administration table. | Fix typo to standard JavaScript template literal `${...}`.<br>```tsx\n<span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>\n``` | Confirmed |
| **ARCH-06** | **Low** | Silent Error Swallowing | Quotations API | `src/app/api/quotations/route.ts` (L97) | Auto-advancing enquiry stage error is swallowed with `console.error` and ignored: `.catch((err) => console.error(...))`. | Failure to update lead stage fails silently, leaving enquiry out of sync with quotation status without notifying user. | Execute quotation creation and enquiry status update in an atomic transaction; throw on failure. | Confirmed |

---

## 2. System Design vs. Implementation Drift Matrix

| Feature / Contract | System Design Doc (`SYSTEM_DESIGN.md`) Claim | Actual Codebase Reality | Drift Severity |
| :--- | :--- | :--- | :--- |
| **Authentication Engine** | Database session cookies validated with Edge middleware, secure token validation. | Edge middleware only checks cookie existence (`if (!token)`). Passwords stored in plaintext. Hardcoded `admin/admin` backdoor exists. | **Critical** |
| **Password Security** | "password: String (Stored securely / Hashed via bcrypt)" | Plaintext string comparison `user.password === password`. No bcrypt or hashing library imported. | **Critical** |
| **Database & RLS** | "PostgreSQL hosted on Supabase... Supabase Auth + RBAC with RLS on EVERY table." | Prisma ORM connects with direct superuser connection string; Supabase SDK not installed; Zero RLS policies exist. | **High** |
| **Employee Master Model** | Fields: `fullName`, `joiningDate`, `monthlySalary`, `dailyRate`. | Prisma schema fields: `name`, `dateOfJoining`, `payType`, `baseRate`. | **Medium** |
| **Monthly Attendance Model** | Aggregated table: `year`, `month`, `presentDays`, `grossSalary`, `netSalary`. | Daily record table: `date`, `status`, `checkInTime`, `overtimeHours`. | **Medium** |
| **Catalog Module** | Listed in prompt as core Sales component ("Clients, Enquiries, Quotations, plus Catalog"). | Marked as "[NEEDS CONFIRMATION] / Not Implemented" in docs; 0% implemented in code. | **High Gap** |
