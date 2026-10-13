# 08 - Testing, UX & Accessibility Audit Report

**Auditor:** Principal Quality & UX Engineer  
**Baseline Git Commit:** `65fc292ae1d79d31e40c8f2d8763d427d3cfc73c`  
**Overall Testing & UX Rating:** **HIGH TESTING DEFICIT & ACCESSIBILITY GAPS**

---

## 1. Findings Table

| ID | Severity | Category | Module | File + Symbol (Line) | What's Wrong | Why It Matters / How It Could Fail | Suggested Fix (With Snippet) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-01** | **Critical** | Automated Testing Deficit | Entire Repository | Project root | Zero automated tests in codebase (0 unit tests, 0 integration tests, 0 E2E tests). No test runner (Vitest, Jest, Playwright) installed. | Regressions, authorization bypasses, and arithmetic bugs cannot be detected automatically before deploying to production. | Install Vitest for unit/integration tests and Playwright for E2E tests. Add CI test execution script. | Gap |
| **UX-01** | **Medium** | Accessibility (WCAG 2.1 AA) | Auth UI | `src/app/(auth)/login/page.tsx` (L85) | Login submit button uses white text on beige background: `bg-[#e3d7c5] text-white/90`. Contrast ratio is ~1.4:1 (WCAG AA requires minimum 4.5:1). | Button text is virtually illegible for users with visual impairments or on low-contrast screens, failing accessibility compliance. | Increase contrast by using dark text or a high-contrast accent button color.<br>```tsx\nclassName="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded ..."\n``` | Confirmed |
| **UX-02** | **Medium** | Accessibility / Modals | Frontend Modals | All modals (`QuickClientModal`, `QuotationForm`, `EnquiryForm`) | Modals lack keyboard focus traps, `aria-modal="true"`, and `Escape` key listeners. | Keyboard-only and screen-reader users get lost behind modals or cannot exit opened forms via standard keyboard interactions. | Use `@radix-ui/react-dialog` or implement custom focus trapping and `onKeyDown` Escape listener. | Confirmed |
| **UX-03** | **Low** | Destructive Action Confirmation | HRM / Sales | `src/app/(dashboard)/enquiries/page.tsx`, `clients/page.tsx` | Delete operations trigger immediate deletion without confirmation dialog or undo toast. | A single misclick by a shop-floor or office user immediately deletes client or enquiry records. | Implement a confirmation dialog ("Are you sure you want to delete?") and a 5-second undo toast. | Confirmed |

---

## 2. Testing Priority Roadmap (Highest-Value Tests First)

1. **Authentication & Authorization Unit Tests (Vitest):**
   - Verify unauthenticated requests to `/api/clients`, `/api/enquiries`, `/api/quotations`, `/api/hrm/*` return 401 Unauthorized.
   - Verify non-admin role (`SALES`) cannot approve quotations or create superadmin accounts.
2. **Approval Workflow State Machine Tests (Vitest):**
   - Verify quotation status transitions: `DRAFT` -> `PENDING_APPROVAL` -> `APPROVED`.
   - Verify sales reps cannot jump directly to `APPROVED`.
   - Verify editing an approved quote invalidates approval.
3. **Financial Rounding & Total Calculation Tests (Vitest):**
   - Verify server-side total recomputation matches quantity × unit price across line items.
4. **End-to-End Sales Pipeline Test (Playwright):**
   - Full journey: Log in as Sales Rep -> Quick-create Client in Enquiry -> Save Enquiry -> Create Quote -> Submit for Approval -> Log in as SuperAdmin -> Review and Approve Quote -> Verify PDF download.
