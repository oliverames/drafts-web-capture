const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`HTTP ${response.status()} ${response.url()}`);
    }
  });

  await page.goto('http://localhost:8091');
  await page.waitForTimeout(5000);
  await browser.close();
})();
