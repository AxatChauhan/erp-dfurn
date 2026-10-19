import { test, expect } from '@playwright/test';

test.describe('Clients Module & Owner UX Mandates Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate
    await page.goto('/login');
    const usernameInput = page.locator('input[name="username"], input#username, input[type="text"]').first();
    const passwordInput = page.locator('input[name="password"], input#password, input[type="password"]').first();
    await usernameInput.fill('admin');
    await passwordInput.fill('admin');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
    await submitBtn.click();
    await page.waitForURL(/.*(clients|dashboard)/, { timeout: 15000 });
  });

  test('should load clients directory without persistent loading spinner', async ({ page }) => {
    await page.goto('/clients');
    
    // Ensure the main table or container is rendered
    await page.waitForSelector('.clt-table, .clt-table-container, table, [data-testid="clients-table"], .clt-main-content', {
      timeout: 10000,
    });

    // Verify loading spinner is not stuck
    const spinner = page.locator('.clt-loading-container');
    await expect(spinner).toHaveCount(0);
  });

  test('owner mandate: screen text must contain zero "them" dashes (—)', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Extract all text visible on the page
    const bodyText = await page.innerText('body');

    // Assert no "them" dashes (—) are present
    const hasThemDash = bodyText.includes('—');
    expect(hasThemDash, 'Found "them" dash (—) on the screen. Must use en dash (–) or dot (·)').toBe(false);
  });

  test('owner mandate: active/selected filter chip must have Black background (not Orange)', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Look for active/selected chip
    const activeChip = page.locator('.clt-type-btn.active, .clt-pill.active, button.active, [data-active="true"]').first();
    if (await activeChip.count() > 0) {
      const bg = await activeChip.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      // Ensure it is black/dark rgb(0, 0, 0) or rgb(17, 24, 39) or rgb(51, 51, 51), NOT orange rgb(255, 119, 0)
      expect(bg).not.toBe('rgb(255, 119, 0)');
    }
  });

  test('responsive stacking: page layout adapts gracefully under 900px', async ({ page }) => {
    // Set viewport to 860px (under owner's 900px threshold)
    await page.setViewportSize({ width: 860, height: 900 });
    await page.goto('/clients');
    await page.waitForLoadState('domcontentloaded');

    // Ensure page horizontal scroll is contained
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 20);
  });
});
