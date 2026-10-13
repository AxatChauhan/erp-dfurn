# 09 - Documentation, ADRs & Team-Readiness Audit Report

**Auditor:** Principal Developer Experience & Knowledge Architect  
**Baseline Git Commit:** `65fc292ae1d79d31e40c8f2d8763d427d3cfc73c`  
**Overall Documentation Rating:** **NEEDS SUBSTANTIAL UPDATE**

---

## 1. Findings Table

| ID | Severity | Category | Module | File + Symbol (Line) | What's Wrong | Why It Matters / How It Could Fail | Suggested Fix (With Snippet) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DOC-01** | **High** | Repository Documentation | Project Root | `README.md` | `README.md` is default `create-next-app` boilerplate; lacks project overview, setup steps, environment variable lists, or deployment instructions. | New engineers or contractors onboarding to the project will take days to guess setup requirements and database prerequisites. | Rewrite `README.md` with complete architecture overview, `.env.example`, prerequisites, and seed instructions. | Confirmed |
| **DOC-02** | **High** | Dangerous Build Script | Scripts | `generate_docs.py` | Python script contains hardcoded outdated markdown string that overwrites `docs/SYSTEM_DESIGN.md` if executed, clobbering HRM documentation and latest updates. | Running the script accidentally wipes out documentation maintained by other team members or agents. | Remove `generate_docs.py` or refactor it into an automated documentation generator that reads live Prisma schema and route comments. | Confirmed |
| **DOC-03** | **Medium** | Architecture Decision Records | Architecture | `docs/adr/` | Zero Architecture Decision Records (ADRs) explaining key choices (e.g. why Prisma over direct Supabase client, why Turbopack, why PostgreSQL over Firestore). | Team members lack rationale for past decisions, leading to circular debates or accidental architectural regressions. | Create `docs/adr/` directory with records for ORM selection, authentication strategy, and state management. | Gap |
| **DOC-04** | **Medium** | Environment Variable Documentation | Configuration | Project Root | Absence of `.env.example` defining required environment variables (`DATABASE_URL`, `DIRECT_URL`). | Developers cannot easily spin up fresh local instances without inspecting source code. | Provide `.env.example` with masked dummy values and connection string configuration guides. | Gap |

---

## 2. Onboarding & Bus-Factor Risk Assessment

- **Current Developer Onboarding Time:** ~3-4 days due to undocumented database schema steps and lack of automated seed data scripts.
- **Target Onboarding Time:** < 30 minutes with a single command: `npm install && npx prisma migrate dev && npm run seed && npm run dev`.
- **Bus Factor:** High. Domain knowledge regarding the manufacturing cutting optimizer and product configurator from the reference system is documented in `COMPARATIVE_AUDIT_REPORT.md`, but not yet formalized into system user stories.
