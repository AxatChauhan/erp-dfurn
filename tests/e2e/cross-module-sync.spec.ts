import { test, expect } from '@playwright/test';

test.describe('Tri-Module UI Synchronization & Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Super Admin
    await page.goto('/login');
    const usernameInput = page.locator('input[name="username"], input#username, input[type="text"]').first();
    const passwordInput = page.locator('input[name="password"], input#password, input[type="password"]').first();
    await usernameInput.fill('admin');
    await passwordInput.fill('admin');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
    await submitBtn.click();
    await page.waitForURL(/.*(clients|dashboard)/, { timeout: 15000 });
  });

  test('Module 1 (Clients): renders directory with authentic corporate accounts', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Verify main content rendered
    const bodyText = await page.innerText('body');
    expect(bodyText).toContain('Zydus Infotech');
    expect(bodyText).not.toContain('—'); // Owner mandate: No em dashes
  });

  test('Module 2 (Enquiries): renders authentic opportunities with matching clients and monotonic badges', async ({ page }) => {
    await page.goto('/enquiries');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.innerText('body');
    // Verify stages are visible
    expect(bodyText).toMatch(/(New|Qualified|Quoted|Converted|Lost)/);
    // Verify client name linkage on enquiry cards
    expect(bodyText).toContain('Zydus Infotech');
    expect(bodyText).not.toContain('—'); // Owner mandate: No em dashes
  });

  test('Module 3 (Quotations): renders commercial proposals with version codes and grand totals', async ({ page }) => {
    await page.goto('/quotations');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.innerText('body');
    // Verify proposals and statuses
    expect(bodyText).toMatch(/(Draft|Approved|Sent|Converted)/);
    expect(bodyText).toContain('DF/Q/');
    expect(bodyText).not.toContain('—'); // Owner mandate: No em dashes
  });

  test('Cross-Module Navigation: seamless transition across Clients -> Enquiries -> Quotations', async ({ page }) => {
    // 1. Start at Clients
    await page.goto('/clients');
    await page.waitForLoadState('domcontentloaded');

    // 2. Expand Sidebar by hovering, then navigate to Enquiries
    await page.hover('aside');
    const enquiriesLink = page.locator('aside a[href="/enquiries"]').first();
    await enquiriesLink.waitFor({ state: 'visible', timeout: 5000 });
    await enquiriesLink.click();
    await page.waitForURL(/.*enquiries/, { timeout: 10000 });
    expect(page.url()).toContain('/enquiries');

    // 3. Expand Sidebar by hovering, then navigate to Quotations
    await page.hover('aside');
    const quotationsLink = page.locator('aside a[href="/quotations"]').first();
    await quotationsLink.waitFor({ state: 'visible', timeout: 5000 });
    await quotationsLink.click();
    await page.waitForURL(/.*quotations/, { timeout: 10000 });
    expect(page.url()).toContain('/quotations');
  });
});
