const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to https://oliverames.github.io/drafts-web-capture/...');
  await page.goto('https://oliverames.github.io/drafts-web-capture/');

  console.log('Checking for Setup section...');
  await page.waitForSelector('#setup-section', { state: 'visible', timeout: 10000 });
  
  console.log('Entering test Mail Drop address...');
  await page.fill('#maildrop-input', 'drafts-test@drafts.io');
  await page.click('#save-maildrop-btn');

  console.log('Verifying transition to Capture section...');
  await page.waitForSelector('#capture-section', { state: 'visible', timeout: 5000 });

  console.log('Creating test draft content...');
  await page.evaluate(() => {
    window.__editor.setValue('GitHub Pages Test\n\nSent via Playwright on GH Pages.\n#gh #test');
  });

  console.log('Submitting draft...');
  const [request] = await Promise.all([
    page.waitForRequest(req => req.url().includes('drafts-ck-proxy.oliverames.workers.dev') && req.method() === 'POST'),
    page.click('.btn-create')
  ]);

  console.log('API Request:', request.url());
  console.log('Payload:', request.postData());

  const alert = await page.waitForSelector('.alert.success', { timeout: 15000 });
  console.log('Final Result:', await alert.innerText());

  await browser.close();
  console.log('Test completed successfully!');
})();
