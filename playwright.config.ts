import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E & Visual Automation Test Configuration for D'furn ERP
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 30000,
  
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://optimistic-carson-blush.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 }
      },
    },
    {
      name: 'tablet-stacked',
      use: {
        viewport: { width: 880, height: 900 } // Below 900px to test the owner's responsive stacking rule
      },
    },
  ],
});
