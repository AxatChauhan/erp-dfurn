import os

md_content = """# ERP-DFurn: Complete System Documentation (V2)

## 1. Project Overview
**ERP-DFurn** is a specialized Enterprise Resource Planning (ERP) platform built for manufacturing and sales (specifically designed with furniture/cabinet manufacturing in mind). 
**Target Users**: Sales Representatives, Managers, and Super Admins.
**Problem Solved**: Centralizing client management, streamlining the sales pipeline (from lead to converted order), standardizing quotation generation, and enforcing rigorous approval workflows to prevent unauthorized discounts or unapproved specs.

### What is Built So Far:
- **Authentication & RBAC**: Complete user session management with `SUPER_ADMIN` and `SALES` roles.
- **Client Management**: Creation and tracking of B2B and B2C clients, including multiple contacts and addresses.
- **Enquiries (CRM/Kanban)**: A visual pipeline for managing sales leads, including quick-add for clients, status tracking, drag-and-drop state management, and an automated audit trail.
- **Quotations (Approval Engine)**: Generation of financial quotes from enquiries, with a strict role-based approval pipeline preventing sales reps from finalizing unapproved quotes.
- **Audit Trails**: Visual, timestamped timelines for both Enquiries and Quotations.

*(Note: The requested "Catalog / customizable cabinet sample product" module does not currently exist as a standalone feature in the codebase or database schema. It has been marked for future implementation.)*

---

## 2. Tech Stack and Architecture

**Tech Stack**:
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons. (Chosen for SSR performance, rapid UI development, and component modularity).
- **Backend/API**: Next.js Route Handlers (`/api/...`). (Chosen for seamless full-stack monorepo architecture).
- **Database**: PostgreSQL hosted on **Supabase**.
- **ORM**: Prisma (Chosen for type-safe database queries and automated migrations).
- **Bundler**: Turbopack (Chosen for ultra-fast local HMR and compile times).
- **Deployment**: Vercel (Frontend & Serverless APIs) + Supabase (DB).

### System Architecture Diagram

```mermaid
flowchart TD
    Browser[Client Browser]
    
    subgraph Vercel [Vercel Deployment]
        UI[Next.js React Client Components]
        API[Next.js Serverless Route Handlers]
        PrismaClient[Prisma Client (Node.js)]
    end
    
    subgraph Supabase [Supabase Infrastructure]
        Postgres[(PostgreSQL Database)]
        PgBouncer[Connection Pooler]
    end
    
    Browser <-->|HTTP/JSON| UI
    UI <-->|Fetch API| API
    API <-->|Local Invocation| PrismaClient
    PrismaClient <-->|TCP (Port 6543)| PgBouncer
    PgBouncer <--> Postgres
```
**Speed Choices**:
- **Connection Pooling**: Supabase provides PgBouncer (usually on port 6543) which is critical for Serverless environments (like Vercel) where thousands of ephemeral lambdas might otherwise exhaust the DB connections.
- **Optimistic UI**: Client components use React state to immediately reflect changes (like Kanban drag-and-drop) before the API confirms the write, making the app feel instantaneous.

---

## 3. Authentication and Roles

Login is handled natively (currently mapped through `api/auth/login`).
Access is enforced:
- **UI Level**: Components read the `userRole` and conditionally render buttons (e.g., hiding "Approve Quotation" for Sales users).
- **API Level**: Endpoints check session tokens/headers to authorize mutations.

### Permissions Table

| Feature / Action | `SALES` Role | `SUPER_ADMIN` Role |
| :--- | :--- | :--- |
| **Login** | Yes | Yes |
| **View Clients** | Yes (Own / All depending on scope) | Yes (All) |
| **Create Enquiries** | Yes | Yes |
| **Move Kanban Cards**| Yes | Yes |
| **Create Quotes** | Yes (Status: `DRAFT`) | Yes |
| **Submit for Approval**| Yes | Yes |
| **Approve Quotes** | No | Yes |

---

## 4. Database (In Full Detail)

### 4.1 Complete Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    User {
        String id PK
        String name
        String username UK
        String password
        String role
        DateTime createdAt
        DateTime updatedAt
    }

    Client {
        String id PK
        String clientType
        String name
        String contactPerson
        Json emails
        Json phones
        Json addresses
        String sourceCategory
        String sourceName
        String taxId
        String paymentTerms
        Float creditLimit
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
    }

    Enquiry {
        String id PK
        String enquiryNumber UK
        String clientId FK
        String status
        String expectedTimeline
        Float estimatedBudget
        String propertyType
        DateTime nextFollowUp
        String notes
        String sourceCategory
        String sourceName
        Json attachments
        DateTime createdAt
        DateTime updatedAt
    }

    EnquiryItem {
        String id PK
        String enquiryId FK
        String description
        Int quantity
        Float unitPrice
        Float total
        String expectedDimensions
        String materialPreference
    }

    Quotation {
        String id PK
        String quotationNumber UK
        String clientId FK
        String enquiryId FK
        String status
        Float totalAmount
        DateTime createdAt
        DateTime updatedAt
    }

    QuotationItem {
        String id PK
        String quotationId FK
        String description
        Int quantity
        Float unitPrice
        Float total
    }

    User ||--o{ Enquiry : "manages (implied)"
    Client ||--o{ Enquiry : "places"
    Client ||--o{ Quotation : "receives"
    Enquiry ||--o{ EnquiryItem : "contains"
    Enquiry ||--o| Quotation : "converts into"
    Quotation ||--o{ QuotationItem : "contains"
```

### 4.2 Table Dictionary

#### `User`
Manages application access.
- `id`: UUID (PK)
- `name`: String
- `username`: String (Unique, Indexed)
- `password`: String (Hashed via bcrypt)
- `role`: String (Default: `SALES`)

#### `Client`
Stores B2B/B2C profiles.
- `id`: UUID (PK)
- `clientType`: String (Default: `BUSINESS`)
- `name`: String (Required)
- `emails`, `phones`, `addresses`: JSON arrays for flexible multi-contact mapping.
- `taxId`: String (e.g., GSTIN).
- `creditLimit`: Float (Default: 0.00).

#### `Enquiry`
The core CRM lead record.
- `id`: UUID (PK)
- `enquiryNumber`: String (Unique auto-generated ID like ENQ-1001)
- `clientId`: UUID (FK to Client)
- `status`: String (Default: `NEW`). Permitted values: `NEW`, `IN_PROGRESS`, `QUALIFIED`, `DROPPED`, `CONVERTED`.
- `estimatedBudget`: Float.
- `createdAt` / `updatedAt`: DateTime (Drives the Audit Log timeline).

#### `EnquiryItem`
Line items for an enquiry.
- `enquiryId`: UUID (FK to Enquiry, `onDelete: Cascade`)
- `expectedDimensions`: String (e.g. "1200x600x750mm")
- `materialPreference`: String (e.g. "Teak Wood")

#### `Quotation` & `QuotationItem`
Financial projection based on Enquiries.
- `status`: String (Default: `DRAFT`). Permitted values: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`.
- `totalAmount`: Float (Calculated sum of child items).

---

## 5. Every Feature (Chronological Build Order)

### 5.1 Clients Module
- **Purpose**: Directory of all potential and active buyers.
- **Workflow**: User visits `/clients`, clicks "New Client", fills out name, type, and JSON contact arrays.
- **Components**: `src/app/(dashboard)/clients/page.tsx`
- **API**: `GET /api/clients`, `POST /api/clients`

### 5.2 Enquiries (Kanban CRM)
- **Purpose**: Visual tracking of sales leads.
- **Workflow**: 
  1. Click "+ New Enquiry".
  2. If the client is new, use the embedded "+ Quick Add" feature directly inside the modal to spawn a client record without losing context.
  3. Lead appears in the "NEW" column.
  4. Drag and Drop lead across columns.
  5. Click card to view details or click "View Log" for the timeline.
- **Components**: `src/app/(dashboard)/enquiries/page.tsx` (Contains `EnquiriesPage`, `EnquiryForm`, `EnquiryDetailsModal`).
- **Database impact**: Writes to `Enquiry`, `EnquiryItem`, and optionally `Client`.

### 5.3 Quotations (Approval Engine)
- **Purpose**: Financial proposal generation with strict oversight.
- **Workflow**:
  1. Triggered from an Enquiry clicking "Create Quote", or manually.
  2. Sales Rep adds line items and pricing.
  3. Status is `DRAFT`. Rep clicks "Submit for Approval".
  4. SuperAdmin logs in, views `PENDING_APPROVAL` quote, clicks "Approve Quotation".
- **Components**: `src/app/(dashboard)/quotations/page.tsx` (Contains `QuotationsPage`, `QuotationForm`, `QuotationViewCard`).

### 5.4 Catalog / Custom Cabinet Product
- **Status**: **[NEEDS CONFIRMATION]**. While requested in the prompt, there is currently no `Catalog` or `Product` table in the database, nor a `/catalog` route. Future implementation requires scoping.

---

## 6. End-to-End Business Workflow

```mermaid
stateDiagram-v2
    state "Lead Generation" as Lead {
        [*] --> Enquiry_Created
        Enquiry_Created --> Requirements_Gathered
        Requirements_Gathered --> Qualified
    }
    
    state "Quoting Phase" as Quote {
        Qualified --> Draft_Quote_Generated
        Draft_Quote_Generated --> Pending_Approval : Sales Submits
    }
    
    state "Finalization" as Final {
        Pending_Approval --> Approved : SuperAdmin Approves
        Pending_Approval --> Rejected : SuperAdmin Rejects
        Rejected --> Draft_Quote_Generated : Revisions
    }
    
    Lead --> Quote
    Quote --> Final
```
*Plain English: A lead enters the system as an Enquiry. Once qualified, it transitions into a Draft Quote. A sales rep must submit this quote for approval, effectively locking it until a SuperAdmin reviews and approves it.*

---

## 7. Design System and UI

- **Typography**: Inter (Next.js default font).
- **Styling**: Tailwind CSS. Heavy use of `bg-slate-50`, `bg-white`, `text-slate-900`.
- **Rounding**: `rounded-xl` and `rounded-2xl` for modals and cards to give a modern, friendly SaaS appearance.
- **Interactions**: `hover:scale-95`, `transition-all`, and `animate-slide-up` are used extensively to provide physical feedback to button presses and modal spawns.

---

## 8. Performance

- **Turbopack**: Used for local dev to compile massive React components in milliseconds.
- **Optimistic Updates**: Implemented across Kanban drag-and-drop and Status changes. The UI updates instantly while the `fetch` request resolves silently in the background.
- **Future Improvements**: Data fetching is currently client-side (`useEffect`). Refactoring to React Server Components (RSC) and Server Actions would drastically reduce client JS payload.

---

## 9. Security

- **Protections**: API routes require valid sessions. UUIDs prevent ID-guessing (Insecure Direct Object Reference).
- **Weaknesses**: 
  - `password` in the Prisma schema is marked to be hashed, but full Auth.js/NextAuth implementation details need to be strictly enforced.
  - Rate limiting is not currently implemented on the API routes.

---

## 10. Setup and Deployment

**Local Development**:
1. `npm install`
2. `npx prisma generate`
3. `npx prisma db push` (Requires `DATABASE_URL` in `.env`)
4. `npm run dev`

**Vercel / Supabase Deployment**:
1. Provision a Supabase PostgreSQL instance.
2. Obtain the Transaction Pooler URL (Port 6543) and assign it to `DATABASE_URL` in Vercel.
3. Assign the Direct URL (Port 5432) to `DIRECT_URL` in Vercel.
4. Link the Vercel project to the GitHub repo. Vercel will automatically build and deploy `master` branches.

---

## 11. Known Issues and Next Steps

- **Catalog Module Missing**: Needs full specification, DB Schema (`Product`, `Category`, `Variant`), and UI implementation.
- **Next Steps**:
  1. Implement PDF Generation on the server using `puppeteer` or `jspdf` for the "Download PDF" buttons.
  2. Add email integrations (SendGrid/Resend) for "Send to Client" functionalities.

---

## 12. Glossary

- **Enquiry**: A sales lead or initial request from a client.
- **Quotation**: A formal financial document offering a specific price for goods/services.
- **Kanban**: A visual board divided into columns (New, In Progress, etc.) used to track work items.
- **RBAC**: Role-Based Access Control (e.g. Super Admin vs Sales).
- **UUID**: Universally Unique Identifier. A long, random string used as a secure ID instead of 1, 2, 3.
- **Optimistic UI**: A frontend pattern that updates the screen immediately before the database confirms the save, making the app feel incredibly fast.
"""

# Ensure docs directory exists
os.makedirs("docs", exist_ok=True)

with open("docs/SYSTEM_DESIGN.md", "w", encoding="utf-8") as f:
    f.write(md_content)
