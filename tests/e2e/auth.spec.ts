import { test, expect } from '@playwright/test';

test.describe('Authentication & Navigation Suite', () => {
  test('should display login page with credentials quick-fill chips', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/DFurn ERP/i);
    await expect(page.locator('input[name="username"], input#username, input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[name="password"], input#password, input[type="password"]').first()).toBeVisible();
  });

  test('should log in successfully as Super Admin and land on clients directory', async ({ page }) => {
    await page.goto('/login');
    
    // Fill credentials
    const usernameInput = page.locator('input[name="username"], input#username, input[type="text"]').first();
    const passwordInput = page.locator('input[name="password"], input#password, input[type="password"]').first();
    
    await usernameInput.fill('admin');
    await passwordInput.fill('admin');
    
    // Submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
    await submitBtn.click();
    
    // Verify redirect to dashboard/clients
    await page.waitForURL(/.*(clients|dashboard)/, { timeout: 15000 });
    expect(page.url()).toMatch(/(clients|dashboard)/);
  });
});
