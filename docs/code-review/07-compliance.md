# 07 - Compliance, Legal & Regulatory Audit Report

**Auditor:** Principal Compliance & Security Assessor  
**Baseline Git Commit:** `65fc292ae1d79d31e40c8f2d8763d427d3cfc73c`  
**Overall Compliance Rating:** **NON-COMPLIANT (LEGAL & REGULATORY RISK)**

---

## 1. Findings Table

| ID | Severity | Category | Module | File + Symbol (Line) | What's Wrong | Why It Matters / How It Could Fail | Suggested Fix (With Snippet) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CMP-01** | **Critical** | Data Privacy (India DPDP Act) | HRM / Employees | `src/app/api/hrm/employees/route.ts` `GET` | Unencrypted and unauthenticated exposure of Indian National Identifiers (Aadhaar number, PAN) and banking records. | Violates India's Digital Personal Data Protection (DPDP) Act 2023, carrying penalties up to ₹250 Crore for failure to take reasonable security safeguards to prevent personal data breaches. | Restrict identifier fields to authorized HR/SuperAdmin roles only. Store sensitive government IDs with column-level encryption or hashing. | Confirmed |
| **CMP-02** | **High** | Financial Record Immutability | Quotations | `src/app/api/quotations/[id]/route.ts` `PUT` | Approved quotations can be modified in place or deleted without preserving historical versions. | Commercial and tax dispute liability. Once an offer is issued or approved, audit standards require preserving the exact document as presented. | Once status is `APPROVED`, disallow updates. Require generation of a revision document (`DF_QT_000001_R1`) with changelog. | Confirmed |
| **CMP-03** | **Medium** | GST Tax Compliance | Sales / Quotations | `prisma/schema.prisma` `Quotation` | Absence of tax breakdown columns (CGST, SGST, IGST, Place of Supply state code) on Quotation model. | In Indian B2B sales, quotations must declare whether prices are inclusive/exclusive of GST and detail intra-state vs inter-state tax liabilities. | Add tax breakdown fields: `subtotal`, `taxRate`, `cgstAmount`, `sgstAmount`, `igstAmount`, `totalWithTax` as `Decimal` fields. | Gap |
| **CMP-04** | **Low** | Privacy Policy & Cookie Notices | Web App | Root application | Zero privacy policy, terms of service, or cookie consent banners. | If customer-facing or architect portal features are introduced, privacy notices are required under privacy statutes. | Add `/privacy` and `/terms` pages outlining data retention and processing purposes. | Gap |

---

## 2. Supply Chain & License Compliance Review

- **Direct Dependencies:**
  - `@prisma/client` (Apache 2.0) - Compatible
  - `jspdf` (MIT) - Compatible
  - `jspdf-autotable` (MIT) - Compatible
  - `lucide-react` (ISC) - Compatible
  - `next` (MIT) - Compatible
  - `react` / `react-dom` (MIT) - Compatible
- **License Risk Verdict:** **Clean.** All direct dependencies utilize permissible open-source licenses (MIT, Apache 2.0, ISC). No copyleft (GPL / AGPL) contamination detected.
