const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG [' + msg.type() + ']:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message, err.stack));

  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="username"]', 'sales');
  await page.fill('input[name="password"]', 'sales123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  console.log('Navigating to /quotations...');
  await page.goto('http://localhost:3000/quotations');
  await page.waitForTimeout(3000);

  console.log('Testing Add Quotation modal...');
  const newBtn = await page.$('button:has-text("New Quotation"), .clt-primary-btn');
  if (newBtn) {
    await newBtn.click();
    await page.waitForTimeout(1000);
    console.log('Modal opened!');
    const addCatalogBtn = await page.$('button:has-text("Add from Product Catalog")');
    if (addCatalogBtn) {
      await addCatalogBtn.click();
      await page.waitForTimeout(2000);
      console.log('Product catalog opened!');
    }
  }

  console.log('Current URL:', page.url());
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
