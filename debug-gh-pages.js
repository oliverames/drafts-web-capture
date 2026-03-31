const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to GH Pages...');
  await page.goto('https://oliverames.github.io/drafts-web-capture/');

  await page.fill('#maildrop-input', 'drafts-test@drafts.io');
  await page.click('#save-maildrop-btn');

  await page.evaluate(() => {
    window.__editor.setValue('Debug Draft Content');
  });

  console.log('Clicking create...');
  await page.click('.btn-create');

  await page.waitForTimeout(5000);
  await browser.close();
})();
