const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to GH Pages...');
  await page.goto('https://oliverames.github.io/drafts-web-capture/');

  await page.waitForSelector('#setup-section', { state: 'visible' });
  await page.fill('#maildrop-input', 'drafts-test@drafts.io');
  await page.click('#save-maildrop-btn');

  // Use the Submit button inside the Capture Form specifically
  const submitBtn = page.locator('#capture-form button[type="submit"]');
  await submitBtn.waitFor({ state: 'visible' });

  await page.evaluate(() => {
    window.__editor.setValue('GitHub Pages Test V2\n\nContent for testing.');
  });

  console.log('Submitting draft via #capture-form button...');
  const [request] = await Promise.all([
    page.waitForRequest(req => req.url().includes('drafts-ck-proxy.oliverames.workers.dev') && req.method() === 'POST'),
    submitBtn.click()
  ]);

  console.log('API Request:', request.url());
  console.log('Payload:', request.postData());

  const alert = await page.waitForSelector('.alert.success', { timeout: 15000 });
  console.log('Final Result:', await alert.innerText());

  await browser.close();
  console.log('Test completed successfully!');
})();
