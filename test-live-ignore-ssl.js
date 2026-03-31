const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  console.log('Navigating to https://drafts.amesvt.com (ignoring SSL errors)...');
  await page.goto('https://drafts.amesvt.com');

  await page.waitForSelector('#setup-section', { state: 'visible', timeout: 10000 });
  await page.fill('#maildrop-input', 'drafts-test@drafts.io');
  await page.click('#save-maildrop-btn');

  await page.waitForSelector('#capture-section', { state: 'visible', timeout: 5000 });

  await page.evaluate(() => {
    window.__editor.setValue('Live Test Draft\n\nSent via Playwright on live site.\n#live #test');
  });

  const [request] = await Promise.all([
    page.waitForRequest(req => req.url().includes('drafts-ck-proxy.oliverames.workers.dev') && req.method() === 'POST'),
    page.click('.btn-create')
  ]);

  console.log('API Request:', request.url());
  console.log('Payload:', request.postData());

  const alert = await page.waitForSelector('.alert.success', { timeout: 10000 });
  console.log('Final Result:', await alert.innerText());

  await browser.close();
})();
