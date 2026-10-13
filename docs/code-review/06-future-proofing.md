# 06 - Future-Proofing & Scalability Audit Report

**Auditor:** Principal Enterprise Architect  
**Baseline Git Commit:** `65fc292ae1d79d31e40c8f2d8763d427d3cfc73c`  
**Overall Future-Proofing Rating:** **REQUIRES STRATEGIC RESTRUCTURING**

---

## 1. Findings Table

| ID | Severity | Category | Module | File + Symbol (Line) | What's Wrong | Why It Matters / How It Could Fail | Suggested Fix (With Snippet) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FUT-01** | **High** | Multi-Tenant / Multi-Branch | Data Model | `prisma/schema.prisma` | Zero `companyId` or `branchId` columns across all tables. | When the manufacturing business expands to a second plant, warehouse, or showroom, the entire schema must be destructively refactored to support multi-facility segregation. | Add optional `companyId` and `branchId` foreign keys to all master records (`Client`, `Enquiry`, `Quotation`, `Employee`). | Gap |
| **FUT-02** | **High** | RBAC Scalability | Authorization | `prisma/schema.prisma` `User.role` | Roles hardcoded as flat strings (`SUPER_ADMIN`, `SALES`) without a permissions join table or granular capability flags. | As future modules (Inventory, Procurement, Production, Accounts) are added, a flat 2-role system cannot express "Can view inventory but not salaries" or "Can approve quotes under ₹1,00,000". | Implement a permission-based access control (PBAC) model with `Role` and `Permission` tables (`can_approve_quotation`, `can_view_payroll`). | Gap |
| **FUT-03** | **High** | Product & BOM Decoupling | Catalog / Sales | `prisma/schema.prisma` `QuotationItem` | Quotation items store freeform strings (`description`, `expectedDimensions`, `materialPreference`) without relational links to products or BOM master records. | When Production, Job Orders, and Guillotine Cutting stock modules are implemented, quotations cannot be automatically exploded into Bill of Materials (BOM) or raw material requisition orders. | Introduce `productId` and `variantId` foreign keys on `QuotationItem` and `EnquiryItem`. | Gap |
| **FUT-04** | **Medium** | API Versioning | Architecture | `src/app/api/...` | API routes mounted unversioned directly at `/api/clients`, `/api/quotations`, etc. | Breaking API changes when introducing mobile apps, dealer portals, or accounting webhooks will break existing web clients. | Namespace internal and public APIs under versioned paths (`/api/v1/...`). | Gap |
| **FUT-05** | **Medium** | Soft Deletion Standard | Data Model | `prisma/schema.prisma` | Inconsistent deletion strategy: Hard deletes on `QuotationItem`, `EnquiryItem`, `Department`, while `Employee` and `Client` have boolean flags (`isActive`). | Deletions erase historical context needed for reporting, analytics, and accounting audits. | Standardize across all models with `deletedAt DateTime?` and soft-delete middleware in Prisma. | Gap |

---

## 2. Technical Debt & Module Growth Roadmap

| Module to Add Next | Impact on Current Sales Schema | Required Architectural Foundation | Milestone to Pay Down |
| :--- | :--- | :--- | :--- |
| **1. Catalog & Custom Products** | Quotation & Enquiry line items must link to `productId` and `variantId`. | Implement `Category`, `Product`, and `Variant` models. | **Phase 1 (Immediate)** |
| **2. Inventory & Raw Materials** | Material preferences on quote items must resolve to inventory SKUs for margin costing. | Implement `RawMaterial`, `UnitOfMeasure`, and `StockLedger`. | **Phase 2 (Before Scaling)** |
| **3. Job Orders & Production** | Approved quotation converts into `JobOrder` and `WorkOrder`. | Quotations must have immutable snapshot status and sequential revision history. | **Phase 3 (Next Module)** |
| **4. Invoicing & GST Accounts** | Converts approved quotation to `TaxInvoice` with CGST/SGST/IGST breakdown. | Replace `Float` with `Decimal(12, 2)` across all monetary fields. | **Phase 1 (Immediate)** |
