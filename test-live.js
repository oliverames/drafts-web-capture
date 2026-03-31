const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to https://drafts.amesvt.com...');
  await page.goto('https://drafts.amesvt.com');

  // 1. Check if Setup card is visible
  console.log('Checking for Setup section...');
  await page.waitForSelector('#setup-section', { state: 'visible', timeout: 10000 });
  
  // 2. Input a test mail drop address
  console.log('Entering test Mail Drop address...');
  await page.fill('#maildrop-input', 'drafts-test@drafts.io');
  await page.click('#save-maildrop-btn');

  // 3. Check if Capture form is visible
  console.log('Verifying transition to Capture section...');
  await page.waitForSelector('#capture-section', { state: 'visible', timeout: 5000 });

  // 4. Fill in a test draft
  console.log('Creating test draft content...');
  // Since we use CodeMirror, we might need to click or use a fallback for automation
  // but our app.js still syncs the hidden textarea, so we can try to fill it directly
  // or use CM's public API if we evaluate script.
  await page.evaluate(() => {
    window.__editor.setValue('Test Draft Title\n\nThis is a test draft sent via GUI automation.\n#automation #test');
  });

  // 5. Submit the draft
  console.log('Submitting draft...');
  // Intercept the fetch call to verify it goes to the correct proxy URL
  const [request] = await Promise.all([
    page.waitForRequest(req => req.url().includes('drafts-ck-proxy.oliverames.workers.dev') && req.method() === 'POST'),
    page.click('.btn-create')
  ]);

  console.log('Fetch request detected:', request.url());
  const postData = JSON.parse(request.postData());
  console.log('Payload:', JSON.stringify(postData, null, 2));

  // 6. Wait for success alert
  console.log('Waiting for success alert...');
  const alert = await page.waitForSelector('.alert.success', { timeout: 10000 });
  const alertText = await alert.innerText();
  console.log('Alert text:', alertText);

  await browser.close();
  console.log('Test completed successfully!');
})();
