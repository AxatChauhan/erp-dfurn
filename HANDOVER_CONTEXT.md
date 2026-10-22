# D'furn Modular Systems ERP – Complete Knowledge Base & Engineering Handover

> **CRITICAL DIRECTIVE FOR NEW AI AGENT / DEVELOPER**:
> This document is the single source of truth for the **D'furn Modular Systems ERP** (`optimistic-carson`).
> You **MUST NOT** deviate from the locked design mandates, commercial domain business rules, or Next.js 16 conventions listed below. Read every section before making any code change or responding to the user.

---

## 1. Core Philosophy & Locked Owner Design Mandates

The business owner has refined and approved these non-negotiable rules. Any violation will be rejected:

### Rule 1: Strictly Zero Em Dashes
* **Rule**: Never use em dashes anywhere in this codebase. This applies to UI labels, table columns, toasts, placeholders, code comments, server error responses, and assistant chat messages.
* **Fallback for empty or uncalculated values**: Use an en dash `–`.
* **Fallback for inline value separators**: Use a middle dot `·` (e.g. `DF/C/B2B/00001 · India`).
* **Explanation**: The owner explicitly mandated: *"please remove them dashes, whole app, and a rule for the future."*

### Rule 2: Active / Selected State is Strictly BLACK (`#000000`), Never Orange
* **Rule**: In filter chips, segmented controls, tabs, category pills, and toggle buttons, **Black (`#000000`) is the selected/active state**.
* **Orange (`#FF7700`)**: Strictly reserved for primary CTAs (buttons like "+ Create Enquiry", "Save Draft", "Add to Scope"), focus rings, and brand marks.
* **Status Tri-State Colors**:
  - **Green (`#27AE60`)**: Done, Verified, Approved, Won, Converted.
  - **Orange (`#FF7700`)**: In-Progress, Draft, Action Needed, Follow-up Required.
  - **Red (`#E74C3C`)**: Lost, Rejected, Error, Hold, Deleted.
  - **Never invent a fourth status color.**

### Rule 3: Dimensions Always Read `L B H` in mm
* **Rule**: Dimensions must never be joined as plain numbers (avoid `1200x600x750mm`) and must never use `W` (Width).
* **Format**: `L 1400 × B 700 × H 750 mm`.
* **Field naming**: In UI inputs, tables, and modal headers, the second dimension is always **B (Breadth)**. Database schema keys remain `l`, `w`, `h` for historical compatibility.

### Rule 4: Multi-Field Creation Flows are Milestone Wizards
* **Rule**: Never build a single long scrolling form for creating or editing complex entities (Clients, Enquiries, Quotations, Job Orders, Employees).
* **Format**: Stepped milestone wizards (`wizard-modal`, `wizard-stepper`) with distinct milestones (e.g., Client → Interest → Scope → Source).

### Rule 5: Short Choices are Pill Buttons, Not Dropdowns
* **Rule**: Wherever there are short fixed choices (e.g., B2B / B2B2C / B2C, Yes / No, Daily Wage / Monthly Salary), render horizontal pill toggles (`pillToggle`) to save clicks. Reserve `<select>` dropdowns only for large dynamic lists.

### Rule 6: Codes are Secondary References, Not Headlines
* **Rule**: Company or person names lead in bold font. Entity codes (e.g. `DF/C/B2B/00001`, `ENQ-00014`) sit faint and smaller beneath the name. *(Exception: Job Orders list where Job Number leads).*

### Rule 7: Never Fabricate Insights
* **Rule**: If an upstream module is unbuilt or data cannot back a metric, show `–` with a tooltip explanation, **never `0`**. A true zero and an unbuilt feature must never look identical.

### Rule 8: Every Mutation Blocks the Screen
* **Rule**: All data-changing mutations (`POST`, `PUT`, `DELETE`) must display a screen-blocking overlay loader to prevent duplicate clicks and race conditions.

---

## 2. Technical Stack & Architectural Architecture

* **Framework**: Next.js 16.4.0 (App Router, Turbopack, Partial Prerendering / Cache Components enabled)
* **Runtime**: React 19, Node.js 20+
* **Styling**: Tailwind CSS v4, Lucide React icons, Sonner toasts
* **Database**: PostgreSQL hosted on Supabase, managed via Prisma ORM
* **Local Server**: Running on `0.0.0.0:3000` (LAN accessible via `http://192.168.0.10:3000`)
* **Dev Origin Policy**: `next.config.ts` includes `allowedDevOrigins: ['192.168.0.10', '192.168.0.*', '192.168.*.*', 'localhost', '127.0.0.1', '100.68.*.*']` to eliminate Turbopack cross-origin HMR WebSocket dropouts on mobile devices.

### Next.js 16 Architectural Gotchas & Quirks
1. **Dynamic Route Segment Config**:
   - `export const dynamic = 'force-dynamic'` **conflicts** with `nextConfig.cacheComponents: true` in Next.js 16 and causes runtime build failures.
   - For routes that read uncached headers or cookies outside of `<Suspense>`, use:
     ```typescript
     export const instant = false;
     ```
2. **Viewport Export in Next.js 16**:
   - Next.js 16 requires a dedicated `viewport` export from `src/app/layout.tsx`. Without it, mobile browsers emulate desktop 980px viewports:
     ```typescript
     export const viewport: Viewport = {
       width: 'device-width',
       initialScale: 1,
       maximumScale: 5,
       viewportFit: 'cover',
       themeColor: '#FF7700',
     };
     ```
3. **Root Body Styling**:
   - Root `<body>` in `src/app/layout.tsx` must **never** have `overflow-hidden` or `flex` without `flex-col`. Locking `overflow-hidden` at the root traps scrolling when the mobile virtual keyboard pops up, pushing the Sign In button and form inputs offscreen.
4. **Setting Cookies in Route Handlers**:
   - In Next.js 16 Route Handlers, set cookies directly on `res.cookies.set(...)` with `path: '/'`, `sameSite: 'lax'`, `maxAge: 604800`.
   - Do **not** mix `(await cookies()).set(...)` and `res.cookies.set(...)` in the same handler, as Next.js internal AsyncLocalStorage can strip pending response headers.

---

## 3. Commercial Domain & Business Rules

### A. Clients (`/clients`)
* **Numbering Scheme**: `DF/C/<mode>/00001` where `<mode>` is `B2B`, `B2B2C`, or `B2C`. Driven by an atomic sequence counter. Once assigned, client code **never changes**, even if business mode is modified later.
* **No Duplicate Phone Check on Manual Entry**:
  - In modular furniture manufacturing, branch offices, partners, and family members often share a phone line. Do **not** reject duplicate phone numbers on manual client creation or edit.
* **Address Structure**:
  - Structured fields (`Line 1`, `Line 2`, `City`, `State`, `Pincode`, `Country`). Display address is auto-concatenated on read, never stored as a raw static string. State and Pincode are required only for Indian clients.
* **Delete Guard**:
  - A client with any Job Order, Quotation, or Enquiry cannot be deleted (`409 Conflict`).

### B. Enquiries (`/enquiries` and Mobile `/app/enquiries`)
* **Dual-Axis Funnel**:
  - `stage`: `New` → `Qualified` → `Quoted` → `Converted` (monotonic high-water mark; survives cancellation to measure conversion accurately).
  - `outcome`: `Open` vs `Lost` (with mandatory `lostReasonId` and optional `lostNote`).
* **Lead Intake**: Centralized idempotent intake endpoint at `POST /api/enquiries/intake` keyed on `lower(channel:externalId)`.
* **Product Scope Integration**:
  - Enquiries support line item scoping via `ProductCatalogPickerModal`.
  - Captures `refType` (`MasterProduct` | `Variant`), `refId`, dimensions (`L B H mm`), unit prices, quantities, and auto-derives `opportunityValue = sum(qty * rate)`.
* **Delete Guard**: An enquiry with any logged communication or linked quotations cannot be deleted (`hasCommunication: true`).

### C. Quotations (`/quotations` and Mobile `/app/quotations`)
* **Numbering Scheme**: `DF/Q/2026-27/0001` (Financial Year based). Quotations remain unnumbered drafts until first submitted.
* **Immutable Multi-Versioning (`v0`, `v1`, `v2`)**:
  - Every save creates the next version. Drafts are never overwritten in place. Diffs between versions are computed on stable UUID `lineId`s (never match by array index).
* **Exact Calculation Sequence**:
  $$\text{Gross Total} \longrightarrow - \text{Overall Discount} \longrightarrow \text{Discounted Gross} \longrightarrow + \text{Additional Charges} \longrightarrow + \text{GST (18\%)} \longrightarrow \text{Grand Total}$$
  - Unit discounts apply directly to line items. Overall discount applies to Gross Total before Additional Charges and GST.
* **Scope Inheritance**: When creating a quotation from a qualified enquiry, all scoped products, thumbnails, dimensions, and base rates are auto-inherited.
* **Standard Catalogues Swatch Integration**: Visual swatch pickers for Laminates, Edge Banding, and Powder Coating are linked to line items.
* **Margin Guard**: Director Approval is enforced if discounts reduce gross margin below 25%.
* **Printable Document**: Single-page A4 formatted with clean `@media print` rules. Verified and approved versions print clean; draft versions display a `"DRAFT"` watermark.

### D. Products Module (`/products`)
* **282 Master Products** synced from factory catalogs.
* Master Product Schema: Code (`DF-CAT-001`), Category, Subcategory, Base Selling Rate, Standard Dimensions (`L B H`), UOM, Thumbnail, BOM.
* Component: `ProductCatalogPickerModal.tsx`:
  - Instant search across name, code, category.
  - Category filter pills with Black (`#000000`) active state.
  - Chunky 44px quantity steppers.
  - Pre-filled standard dimensions in mm.
  - Responsive layout (stacks dimensions on mobile, single row on desktop).

### E. Human Resources Management (`/hrm`)
* **Routes**: `/hrm/employees`, `/hrm/attendance`, `/hrm/attendance-register`.
* **Workforce Categorization**: In-house staff (`EMP-0001`) vs Contractual labour (`CL-0001`), Contractors (`CON-0001`).
* **Gate Attendance**:
  - Daily 3-bucket floor board: *Not Checked In*, *On-Going / Working*, *Checked Out*.
  - Stamped using the server's clock (`Asia/Kolkata`), never the client device clock.
* **Muster Roll Register**: Monthly matrix grid (1..31 days) with Present (`P`), Absent (`A`), Half-day (`H`), and Overtime hours tracking.

### F. Mobile Portal & PWA (`/app/*`)
* Dedicated mobile view for showroom sales staff and field reps:
  - `/app/enquiries`: Search, pipeline filters, card feed, bottom sheet details, quick enquiry wizard.
  - `/app/quotations`: Quotation listing, status tabs, and version inspector.
* **Device Auto-Routing**:
  - `src/app/page.tsx` inspects User-Agent: mobile devices redirect to `/app/enquiries`, desktop browsers redirect to `/clients`.
  - `src/middleware.ts` routes authenticated mobile logins directly to `/app/enquiries`.
* **PWA Compliance**:
  - Manifest (`public/manifest.json`): `"scope": "/"`, `"start_url": "/app/enquiries"`.
  - Icons: Square brand icons `icon-192.png` and `icon-512.png` with `"purpose": "any maskable"`.
  - Service Worker: `public/sw.js` registered on load via `ServiceWorkerRegister.tsx`.

---

## 4. Authentication, Roles & Test Credentials

* **Session Token**: Tamper-proof HMAC-SHA256 cryptographic token (`auth_token`) signed via Web Crypto API in `src/lib/session.ts`.
* **Client Fallback**: `src/app/(auth)/login/page.tsx` returns `token` in the JSON response and sets `document.cookie` fallback for LAN HTTP IP access.
* **Roles**:
  - `SUPER_ADMIN`: Full access across all modules, user administration, and director approval overrides.
  - `SALES`: Restricted to Enquiries, Quotations, Clients, and Products.
  - `MANAGER`: Access to HRM, Factory Floor Attendance, and Inventory.
  - `USER`: Read-only or basic operational access.
* **Pre-seeded Accounts (Salted PBKDF2 Password Hash)**:
  - Super Admin: `admin` / `admin123`
  - Sales Representative: `Tester_User` / `Tester_User` or `sales` / `sales123`
  - Factory Manager: `manager` / `manager123`

---

## 5. File & Directory Reference

```text
optimistic-carson/
├── public/
│   ├── icon-192.png               # 192x192 square PWA brand icon
│   ├── icon-512.png               # 512x512 square PWA brand icon
│   ├── logo.png                   # Header monogram logo
│   ├── manifest.json              # Web App Manifest (scope: /)
│   └── sw.js                      # PWA Pass-Through Service Worker
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx     # Responsive login page with LAN cookie fallback
│   │   ├── (dashboard)/           # Desktop ERP portal
│   │   │   ├── layout.tsx         # Desktop layout (sidebar, topbar, horizontal scroller)
│   │   │   ├── Sidebar.tsx        # 72px expandable left sidebar
│   │   │   ├── clients/           # Client Directory & Wizard
│   │   │   ├── enquiries/         # Enquiry Funnel, Cards & Scope Wizard
│   │   │   ├── quotations/        # Quotation Multi-Versioning & Costing
│   │   │   ├── hrm/               # Employee Directory & Muster Roll
│   │   │   └── products/          # 282 Master Products catalog
│   │   ├── app/                   # Mobile PWA portal
│   │   │   ├── layout.tsx         # Mobile Shell (MobileTopBar, MobileBottomNav)
│   │   │   ├── enquiries/         # Mobile Enquiries feed & quick wizard
│   │   │   └── quotations/        # Mobile Quotations list & sheets
│   │   ├── api/                   # REST API route handlers
│   │   │   ├── auth/              # Login / Logout / Me
│   │   │   ├── clients/           # Client CRUD & validation
│   │   │   ├── enquiries/         # Enquiry CRUD & qualification
│   │   │   ├── quotations/        # Quotation drafting & versioning
│   │   │   ├── hrm/               # Departments, attendance & punches
│   │   │   └── products/          # Master products & catalogues
│   │   ├── layout.tsx             # Root layout with viewport metadata & SW register
│   │   ├── page.tsx               # Root auto-routing (mobile -> /app, desktop -> /clients)
│   │   └── globals.css            # Tailwind v4 theme & custom scrollbars
│   ├── components/
│   │   ├── products/
│   │   │   └── ProductCatalogPickerModal.tsx  # Reusable product picker
│   │   └── ServiceWorkerRegister.tsx          # Client SW registration
│   ├── lib/
│   │   ├── auth.ts                # Session retrieval & password PBKDF2 hashing
│   │   ├── session.ts             # HMAC-SHA256 Web Crypto signing & verification
│   │   └── prisma.ts              # Global Prisma client singleton
│   └── middleware.ts              # Authentication route guards & device routing
├── prisma/
│   └── schema.prisma              # Database schema definitions
├── next.config.ts                 # Turbopack allowedDevOrigins & cache config
└── HANDOVER_CONTEXT.md            # This master documentation file
```

---

## 6. Verification Protocol

Before declaring any coding task complete or committing code:

1. **Prisma Validation**:
   ```bash
   npx prisma validate
   ```
   Must exit with code 0.
2. **TypeScript Type Check**:
   ```bash
   npx tsc --noEmit
   ```
   Must exit with code 0 without any type violations.
3. **Next.js Production Build**:
   ```bash
   npm run build
   ```
   Must compile all 46/46 pages cleanly with code 0.
4. **Owner Mandate Compliance Audit**:
   - Check that **zero em dashes** exist in newly written code or messages.
   - Verify active filter states are Black (`#000000`).
   - Verify dimensions read `L B H mm`.
   - Ensure all responsive layouts wrap cleanly on 360px mobile viewports.
