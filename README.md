# D'furn Modular Systems ERP

An enterprise-grade ERP and manufacturing operations platform built specifically for modular furniture manufacturing, sales pipelines, client relationships, quoting workflows, and factory shop-floor human resource management.

🚀 **Live Production URL:** [https://optimistic-carson-blush.vercel.app](https://optimistic-carson-blush.vercel.app)

---

## 🔑 Demo Access Credentials

The system comes pre-configured with multi-tier role-based authentication. You can log in using any of the following credentials (or use the 1-click Quick-Fill buttons on the login page):

| Role | Username | Password | Permissions & Capabilities |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `admin` | Full system access; directly creates, saves, approves, and rejects quotations; manages users |
| **Sales Rep** | `Tester_User` | `Tester_User` | Creates enquiries & draft quotes; submits quotations for admin verification |
| **Sales Rep** | `sales` | `sales` | Standard sales workflow and client interaction |
| **Factory Manager** | `manager` | `manager` | Factory floor operations, attendance registers, and job orders |

*Note: Username matching is case-insensitive and trims whitespace automatically.*

---

## 🏗️ Core Modules

### 1. Clients Management (`/clients`)
- **Intelligent Client Directory**: High-density view with responsive insight metrics (Total Clients, Active Pipeline, GST Registered, Pending Followups).
- **In-Place Row Expansion**: Smooth CSS Grid transition drawer for client details without layout shift.
- **1-Click WhatsApp & Phone Calling**: Instant communication triggers directly from contact pills.
- **GSTIN & PAN Parsing**: Auto-detects state code and validates tax ID format.
- **Duplicate Detection**: Real-time validation preventing duplicate phone numbers.
- **Bulk CSV Import & Template**: Downloadable schema template and validation commit engine.

### 2. Quotations & Pricing Workflow (`/quotations`)
- **Role-Based Approval Workflow**:
  - **Super Admin**: Saves and approves quotes directly without requiring verification.
  - **Sales Users**: Quotes default to `PENDING_APPROVAL` and require Super Admin approval.
- **Multi-Version Quoting**: Create revisions (V1, V2...) while maintaining historical audit records.
- **Financial Calculations**: Real-time discount (percentage or fixed amount), extra costs, and GST calculation.

### 3. Enquiries Pipeline (`/enquiries`)
- Lead tracking board with status stages (`NEW`, `IN_PROGRESS`, `QUALIFIED`, `CONVERTED`, `DROPPED`).
- Instant 1-click conversion from qualified lead to a draft Quotation.

### 4. Human Resource Management (`/hrm`)
- **Department Management**: Carpentry, Edge Banding, Finishing & Polish, Assembly, Metal Fabrication, Office & Sales.
- **Daily Attendance Floor Board**: Real-time status buckets (Not Checked In, On-Going / Working, Checked Out).
- **Monthly Mustard Roll Register**: Grid matrix (1–31 days) with quick attendance toggles (Present, Absent, Half-Day) and overtime hour tracking.

### 5. Layout & Ergonomics
- **Hover-Expand Navigation**: Sidebar expands smoothly on hover with 0ms dashboard layout shift using a fixed anchor.
- **Non-Scrollable Chrome**: Factory desktop ergonomics designed for ultra-wide monitors and high contrast shop-floor viewing.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16.4 (App Router)](https://nextjs.org/)
- **Runtime**: React 19 / Turbopack
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS
- **Database ORM**: [Prisma ORM 5.20](https://www.prisma.io/)
- **Database**: PostgreSQL (Supabase Connection Pooler)
- **Deployment**: Vercel Serverless Platform

---

## 💻 Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AxatChauhan/erp-dfurn.git
   cd erp-dfurn
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create `.env` in the root directory:
   ```env
   DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://user:password@host:5432/postgres"
   ```

4. **Initialize Prisma Client:**
   ```bash
   npx prisma generate
   ```

5. **Start Dev Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License

Proprietary — Built for D'furn Modular Systems.
